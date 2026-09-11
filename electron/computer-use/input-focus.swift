import AppKit
import ApplicationServices
import Darwin

// Cua 0.26.1 sends a synthetic deactivation to the user's front process before
// raw background clicks. WindowServer still considers that process frontmost,
// so Cua's foreground-PID restore test misses its now non-key NSWindow.
// Restore the current window only while the actual front process stays unchanged.
// Never change WindowServer's front process, raise windows, or post global input.
// SkyLight record layouts follow trycua/cua (MIT), revision b4e3cae:
// libs/cua-driver/rust/crates/platform-macos/src/input/skylight.rs.
private typealias Front = @convention(c) (UnsafeMutableRawPointer) -> Int32
private typealias Post = @convention(c) (UnsafeRawPointer, UnsafeRawPointer) -> Int32
private typealias ProcessPSN = @convention(c) (Int32, UnsafeMutableRawPointer) -> Int32
private typealias ProcessID = @convention(c) (UnsafeRawPointer, UnsafeMutablePointer<Int32>) -> Int32
private typealias WindowID = @convention(c) (AXUIElement, UnsafeMutablePointer<UInt32>) -> Int32

private func emit(_ value: [String: Any]) {
    if let bytes = try? JSONSerialization.data(withJSONObject: value) {
        FileHandle.standardOutput.write(bytes + Data([10]))
    }
}

@main private struct InputFocus {
    @MainActor static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.prohibited)
        let args = CommandLine.arguments
        guard args.count == 3, let targetPID = Int32(args[1]), let targetID = UInt32(args[2]),
              NSRunningApplication(processIdentifier: targetPID)?.bundleIdentifier == "com.electron.lark",
              let targetRows = CGWindowListCopyWindowInfo(.optionIncludingWindow, targetID) as? [[String: Any]],
              targetRows.contains(where: { ($0[kCGWindowOwnerPID as String] as? Int32) == targetPID }),
              let handle = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_LAZY),
              let frontSymbol = dlsym(handle, "_SLPSGetFrontProcess"),
              let postSymbol = dlsym(handle, "SLPSPostEventRecordTo"),
              let psnSymbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "GetProcessForPID"),
              let pidSymbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "GetProcessPID"),
              let windowSymbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "_AXUIElementGetWindow") else {
            emit(["event": "error", "code": "focus_unavailable"]); return
        }
        let getFront = unsafeBitCast(frontSymbol, to: Front.self)
        let post = unsafeBitCast(postSymbol, to: Post.self)
        let getPSN = unsafeBitCast(psnSymbol, to: ProcessPSN.self)
        let getPID = unsafeBitCast(pidSymbol, to: ProcessID.self)
        let getWindowID = unsafeBitCast(windowSymbol, to: WindowID.self)
        func front() -> [UInt32]? {
            var psn = [UInt32](repeating: 0, count: 2)
            return getFront(&psn) == 0 ? psn : nil
        }
        func focusedWindow(_ pid: Int32) -> AXUIElement? {
            var value: CFTypeRef?
            guard AXUIElementCopyAttributeValue(AXUIElementCreateApplication(pid), kAXFocusedWindowAttribute as CFString, &value) == .success,
                  let value, CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
            return (value as! AXUIElement)
        }
        // NSWorkspace can reflect synthetic AppKit activation instead of the
        // actual WindowServer front process. Resolve that process directly.
        guard var savedFront = front() else {
            emit(["event": "error", "code": "focus_unavailable"]); return
        }
        var previousPID: Int32 = 0
        guard getPID(&savedFront, &previousPID) == 0,
              let previous = NSRunningApplication(processIdentifier: previousPID) else {
            emit(["event": "error", "code": "focus_unavailable"]); return
        }
        // There is no borrowed focus when the user is already in Feishu.
        if previous.processIdentifier == targetPID {
            emit(["event": "ready", "guarded": false]); return
        }
        var previousPSN = [UInt32](repeating: 0, count: 2)
        var previousID: UInt32 = 0
        guard getPSN(previous.processIdentifier, &previousPSN) == 0, previousPSN == savedFront,
              let window = focusedWindow(previous.processIdentifier), getWindowID(window, &previousID) == 0,
              previousID > 0 else {
            emit(["event": "error", "code": "focus_snapshot_unavailable"]); return
        }

        var userChangedFocus = false
        func checkFront() { if front() != savedFront { userChangedFocus = true } }
        let observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { _ in MainActor.assumeIsolated { checkFront() } }
        let timer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { _ in MainActor.assumeIsolated { checkFront() } }
        func postRecord(_ record: inout [UInt8]) -> Bool { post(&previousPSN, &record) == 0 }
        func finish() {
            checkFront(); timer.invalidate()
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            var result = "unchanged"
            // Keep Feishu's editing focus: deactivating it closes its time
            // input before the next AX write. Restore only the user's window.
            if !userChangedFocus, !previous.isTerminated {
                // Follow the current window within this still-frontmost app;
                // never pull the user back to its previously selected window.
                var currentID: UInt32 = 0
                if let current = focusedWindow(previous.processIdentifier) { _ = getWindowID(current, &currentID) }
                if currentID > 0, let rows = CGWindowListCopyWindowInfo(.optionIncludingWindow, currentID) as? [[String: Any]],
                        rows.contains(where: { ($0[kCGWindowOwnerPID as String] as? Int32) == previous.processIdentifier && ($0[kCGWindowIsOnscreen as String] as? Bool) == true }),
                        front() == savedFront {
                    var record = [UInt8](repeating: 0, count: 0xF8)
                    record[0x04] = 0xF8; record[0x08] = 0x0D; record[0x8A] = 0x01
                    withUnsafeBytes(of: currentID.littleEndian) { record.replaceSubrange(0x3C..<0x40, with: $0) }
                    var ok = postRecord(&record)
                    // The activation record alone still swallows the first click.
                    // Re-establish the exact native key window with paired records.
                    for kind: UInt8 in [0x01, 0x02] {
                        record = [UInt8](repeating: 0, count: 0xF8)
                        record[0x04] = 0xF8; record[0x08] = kind; record[0x3A] = 0x10
                        record.replaceSubrange(0x20..<0x30, with: repeatElement(UInt8(0xFF), count: 16))
                        withUnsafeBytes(of: currentID.littleEndian) { record.replaceSubrange(0x3C..<0x40, with: $0) }
                        ok = postRecord(&record) && ok
                    }
                    result = ok ? (currentID == previousID ? "restored" : "restored_current_window") : "restore_failed"
                } else { result = "window_unavailable" }
            } else if userChangedFocus { result = "user_changed_app" }
            emit(["event": "released", "result": result]); exit(result == "restore_failed" ? 1 : 0)
        }
        // Restore even if the worker exits or an action throws. No long-lived
        // focus watchdog: this process leases focus for exactly one native call.
        DispatchQueue.global(qos: .userInitiated).async {
            _ = readLine()
            DispatchQueue.main.async { finish() }
        }
        emit(["event": "ready", "guarded": true])
        app.run()
    }
}
