import Foundation
import AppKit
import ScreenCaptureKit
import CoreMedia
import CoreImage
import ImageIO
import UniformTypeIdentifiers

// Read-only phase-zero comparison: persistent SCStream for one exact Feishu
// window. It never activates windows, injects input, or records audio.
final class Frames: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let directory: URL
    let context = CIContext()
    var count = 0
    var lastSaved = 0.0
    var statuses: [Int: Int] = [:]
    init(directory: URL) { self.directory = directory }
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("{\"event\":\"capture-stopped\"}")
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let raw = attachments.first?[.status] as? Int else { return }
        statuses[raw, default: 0] += 1
        guard raw == SCFrameStatus.complete.rawValue,
              let pixelBuffer = sampleBuffer.imageBuffer else { return }
        count += 1
        let now = ProcessInfo.processInfo.systemUptime
        guard now - lastSaved >= 0.2 else { return }
        lastSaved = now
        let image = CIImage(cvPixelBuffer: pixelBuffer)
        guard let cgImage = context.createCGImage(image, from: image.extent) else { return }
        let bytes = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(bytes, UTType.png.identifier as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(destination, cgImage, nil)
        guard CGImageDestinationFinalize(destination) else { return }
        do {
            try (bytes as Data).write(to: directory.appendingPathComponent("latest.png"), options: .atomic)
            let record: [String: Any] = ["frames": count, "receivedAt": Date().timeIntervalSince1970,
                "presentationTime": sampleBuffer.presentationTimeStamp.seconds, "width": cgImage.width, "height": cgImage.height]
            try JSONSerialization.data(withJSONObject: record).write(to: directory.appendingPathComponent("latest.json"), options: .atomic)
            if count == 1 { print("{\"event\":\"first-frame\"}"); fflush(stdout) }
        } catch { print("{\"event\":\"frame-write-failed\"}") }
    }
}

@main struct StreamProbe {
    static func main() async throws {
        _ = NSApplication.shared
        let args = CommandLine.arguments
        guard (5...6).contains(args.count), let pid = Int32(args[1]), let windowID = UInt32(args[2]),
              let seconds = UInt64(args[4]), seconds > 0, seconds <= 600 else {
            throw NSError(domain: "StreamProbeUsage: pid windowID outputDirectory seconds", code: 1)
        }
        guard CGPreflightScreenCaptureAccess() else {
            throw NSError(domain: "ScreenRecordingPermissionRequired", code: 1)
        }
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let window = content.windows.first(where: { $0.windowID == windowID && $0.owningApplication?.processID == pid
            && $0.owningApplication?.bundleIdentifier == "com.electron.lark" }) else {
            throw NSError(domain: "ExactFeishuWindowUnavailable", code: 1)
        }
        let directory = URL(fileURLWithPath: args[3], isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700])
        let mode = args.count == 6 ? args[5] : "independent"
        let filter: SCContentFilter
        if mode == "display" {
            guard let display = content.displays.first(where: { $0.frame.contains(window.frame) }) else {
                throw NSError(domain: "TargetWindowMustFitDisplayForComparison", code: 1)
            }
            filter = SCContentFilter(display: display, including: [window])
        } else if mode == "independent" {
            filter = SCContentFilter(desktopIndependentWindow: window)
        } else { throw NSError(domain: "UnknownFilterMode", code: 1) }
        let config = SCStreamConfiguration()
        if mode == "display" {
            config.sourceRect = CGRect(x: window.frame.minX - filter.contentRect.minX,
                y: window.frame.minY - filter.contentRect.minY, width: window.frame.width, height: window.frame.height)
        }
        let scale = min(2, 1440 / max(window.frame.width, window.frame.height))
        config.width = Int(window.frame.width * scale)
        config.height = Int(window.frame.height * scale)
        config.minimumFrameInterval = CMTime(value: 1, timescale: 10)
        config.queueDepth = 3
        config.capturesAudio = false
        config.showsCursor = false
        config.ignoreShadowsSingleWindow = true
        config.shouldBeOpaque = true
        let frames = Frames(directory: directory)
        let stream = SCStream(filter: filter, configuration: config, delegate: frames)
        let queue = DispatchQueue(label: "syntropic.capture-probe")
        try stream.addStreamOutput(frames, type: .screen, sampleHandlerQueue: queue)
        try await stream.startCapture()
        print("{\"event\":\"started\",\"windowId\":\"\(windowID)\",\"mode\":\"\(mode)\"}"); fflush(stdout)
        try await Task.sleep(nanoseconds: seconds * 1_000_000_000)
        do { try await stream.stopCapture() }
        catch {
            // Closing the source window can stop the stream before this bounded
            // probe finishes. Report that lifecycle outcome instead of crashing.
            let failure = error as NSError
            guard failure.domain == "com.apple.ScreenCaptureKit.SCStreamErrorDomain",
                  failure.code == -3808 else { throw error }
            print("{\"event\":\"already-stopped\"}")
        }
        queue.sync {
            let record: [String: Any] = ["event": "finished", "completeFrames": frames.count,
                "statuses": frames.statuses.mapKeysToStrings()]
            if let data = try? JSONSerialization.data(withJSONObject: record), let line = String(data: data, encoding: .utf8) { print(line) }
        }
    }
}

extension Dictionary where Key == Int, Value == Int {
    func mapKeysToStrings() -> [String: Int] { Dictionary<String, Int>(uniqueKeysWithValues: map { (String($0.key), $0.value) }) }
}
