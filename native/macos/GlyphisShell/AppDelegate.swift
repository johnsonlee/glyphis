import AppKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var renderView: GlyphisRenderView!
    var runtime: GlyphisRuntime!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create window
        // Height 844 is for the content area; the title bar adds ~28px
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 390, height: 844),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Glyphis"
        window.center()
        window.delegate = self

        // Create render view
        renderView = GlyphisRenderView(frame: window.contentView!.bounds)
        renderView.autoresizingMask = [.width, .height]
        window.contentView = renderView

        // Create runtime and load bundle
        NSLog("[Glyphis] Starting runtime...")
        runtime = GlyphisRuntime(renderView: renderView)
        NSLog("[Glyphis] Loading bundle...")
        runtime.loadBundle()
        NSLog("[Glyphis] Bundle loaded")

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // Debug: test if DispatchQueue.main works after app.run()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            NSLog("[Glyphis] DispatchQueue.main fired after 500ms")
            // Manually kick JS to see if setTimeout fires
            self.runtime.updateViewportSize(
                width: self.renderView.bounds.width,
                height: self.renderView.bounds.height
            )
        }
    }

    func windowDidResize(_ notification: Notification) {
        let size = renderView.bounds.size
        runtime.updateViewportSize(width: size.width, height: size.height)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
