import AppKit
import ScreenCaptureKit
import CoreMedia
import CoreImage
import ImageIO
import UniformTypeIdentifiers

// A read-only helper. Inputs select one existing window; the host owns its
// stdin lifetime. No app activation, input injection, audio, or disk frames.
private let outputLock = NSLock()
private func emit(_ value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
    outputLock.lock(); defer { outputLock.unlock() }
    FileHandle.standardOutput.write(data + Data([10]))
}

private final class Lifetime: @unchecked Sendable {
    private let lock = NSLock()
    private var stopped = false
    func stop() { lock.lock(); stopped = true; lock.unlock() }
    var isStopped: Bool { lock.lock(); defer { lock.unlock() }; return stopped }
}

private final class WindowFrames: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let lifetime: Lifetime
    let context = CIContext()
    var lastEmitted = 0.0
    var sequence = 0
    init(_ lifetime: Lifetime) { self.lifetime = lifetime }
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        emit(["event": "error", "code": "stream_stopped_\((error as NSError).code)"])
        lifetime.stop()
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard !lifetime.isStopped, type == .screen, buffer.isValid,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(buffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let status = attachments.first?[.status] as? Int,
              status == SCFrameStatus.complete.rawValue, let pixels = buffer.imageBuffer else { return }
        let now = ProcessInfo.processInfo.systemUptime
        guard now - lastEmitted >= 0.19 else { return }
        lastEmitted = now
        let source = CIImage(cvPixelBuffer: pixels)
        guard let image = context.createCGImage(source, from: source.extent) else { return }
        let bytes = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(bytes, UTType.jpeg.identifier as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return }
        sequence += 1
        emit(["event": "frame", "sequence": sequence, "width": image.width, "height": image.height,
              "receivedAt": Date().timeIntervalSince1970 * 1000, "data": (bytes as Data).base64EncodedString()])
    }
}

@main private struct WindowStream {
    @MainActor static func run() async throws {
        _ = NSApplication.shared
        let args = CommandLine.arguments
        guard args.count == 3, let pid = Int32(args[1]), let windowID = UInt32(args[2]),
              NSRunningApplication(processIdentifier: pid)?.bundleIdentifier == "com.electron.lark" else {
            throw NSError(domain: "invalid_target", code: 1)
        }
        guard CGPreflightScreenCaptureAccess() else { throw NSError(domain: "screen_recording_required", code: 1) }
        let lifetime = Lifetime()
        // EOF also stops capture when the parent exits unexpectedly.
        DispatchQueue.global(qos: .utility).async { while let line = readLine() { if line == "stop" { break } }; lifetime.stop() }
        let frames = WindowFrames(lifetime)
        let queue = DispatchQueue(label: "syntropic.window-stream.frames")
        var stream: SCStream?
        var lastBounds: CGRect?
        var lastDisplay: CGDirectDisplayID?
        defer { lifetime.stop() }
        do {
            while !lifetime.isStopped {
                guard NSRunningApplication(processIdentifier: pid)?.bundleIdentifier == "com.electron.lark",
                      let rows = CGWindowListCopyWindowInfo([.optionIncludingWindow], windowID) as? [[String: Any]],
                      let row = rows.first(where: { ($0[kCGWindowNumber as String] as? UInt32) == windowID }),
                      (row[kCGWindowOwnerPID as String] as? Int32) == pid,
                      (row[kCGWindowIsOnscreen as String] as? Bool) == true,
                      let rawBounds = row[kCGWindowBounds as String] as? NSDictionary,
                      let bounds = CGRect(dictionaryRepresentation: rawBounds), bounds.width > 0, bounds.height > 0 else {
                    throw NSError(domain: "target_unavailable", code: 1)
                }
                if bounds != lastBounds {
                    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
                    guard let window = content.windows.first(where: { $0.windowID == windowID && $0.owningApplication?.processID == pid }),
                          let display = content.displays.first(where: { $0.frame.contains(window.frame) }) else {
                        throw NSError(domain: "target_outside_display", code: 1)
                    }
                    let filter = SCContentFilter(display: display, including: [window])
                    let config = SCStreamConfiguration()
                    config.sourceRect = CGRect(x: window.frame.minX - filter.contentRect.minX,
                        y: window.frame.minY - filter.contentRect.minY, width: window.frame.width, height: window.frame.height)
                    // Match Cua's screenshot geometry (round, not truncate),
                    // preserving the actual display density on non-Retina screens.
                    let scale = min(CGFloat(filter.pointPixelScale), 1440 / max(window.frame.width, window.frame.height))
                    config.width = Int((window.frame.width * scale).rounded())
                    config.height = Int((window.frame.height * scale).rounded())
                    config.minimumFrameInterval = CMTime(value: 1, timescale: 10)
                    config.queueDepth = 3
                    config.capturesAudio = false
                    config.showsCursor = false
                    config.shouldBeOpaque = true
                    config.ignoreShadowsSingleWindow = true
                    emit(["event": "geometry", "x": bounds.minX, "y": bounds.minY, "width": bounds.width, "height": bounds.height])
                    if let active = stream {
                        if lastDisplay != display.displayID { try await active.updateContentFilter(filter) }
                        try await active.updateConfiguration(config)
                    } else {
                        let active = SCStream(filter: filter, configuration: config, delegate: frames)
                        try active.addStreamOutput(frames, type: .screen, sampleHandlerQueue: queue)
                        try await active.startCapture()
                        stream = active
                    }
                    lastDisplay = display.displayID
                    lastBounds = bounds
                }
                emit(["event": "alive"])
                try await Task.sleep(nanoseconds: 500_000_000)
            }
        } catch {
            emit(["event": "error", "code": (error as NSError).domain])
        }
        lifetime.stop()
        if let active = stream { try? await active.stopCapture() }
        queue.sync {}
        emit(["event": "stopped"])
    }
    static func main() async {
        do { try await run() }
        catch { emit(["event": "error", "code": (error as NSError).domain]); exit(1) }
    }
}
