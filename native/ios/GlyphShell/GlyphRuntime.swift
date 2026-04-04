import JavaScriptCore
import UIKit

/// Manages a JavaScriptCore context that runs the Glyph JS bundle and bridges
/// render commands, text measurement, animation frames, and touch events
/// between JS and native.
class GlyphRuntime {
    private let context: JSContext
    private weak var renderView: GlyphRenderView?
    private var rafCallbacks: [Int: JSValue] = [:]
    private var nextRafId = 1

    init(renderView: GlyphRenderView) {
        self.renderView = renderView
        self.context = JSContext()!
        setupBridge()
        setupTouchBridge()
    }

    // MARK: - Bridge Setup

    private func setupBridge() {
        // --- console ---
        let consoleLog: @convention(block) () -> Void = {
            let args = JSContext.currentArguments()?.map { ($0 as AnyObject).toString() ?? "undefined" } ?? []
            print("[JS]", args.joined(separator: " "))
        }
        let consoleObj = JSValue(newObjectIn: context)!
        consoleObj.setObject(consoleLog, forKeyedSubscript: "log" as NSString)
        consoleObj.setObject(consoleLog, forKeyedSubscript: "warn" as NSString)
        consoleObj.setObject(consoleLog, forKeyedSubscript: "error" as NSString)
        consoleObj.setObject(consoleLog, forKeyedSubscript: "info" as NSString)
        consoleObj.setObject(consoleLog, forKeyedSubscript: "debug" as NSString)
        context.setObject(consoleObj, forKeyedSubscript: "console" as NSString)

        // --- __glyph_native bridge object ---
        let bridge = JSValue(newObjectIn: context)!

        // submitRenderCommands: receives JSON string of render commands
        let submitRender: @convention(block) (String) -> Void = { [weak self] jsonStr in
            guard let self = self,
                  let data = jsonStr.data(using: .utf8),
                  let commands = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
            else { return }
            DispatchQueue.main.async {
                self.renderView?.setRenderCommands(commands)
            }
        }
        bridge.setObject(submitRender, forKeyedSubscript: "submitRenderCommands" as NSString)

        // measureText: returns {width, height} using Core Text
        let measureText: @convention(block) (String, Double, String, String) -> [String: Double] = {
            text, fontSize, _, fontWeight in
            var weight: UIFont.Weight = .regular
            switch fontWeight {
            case "bold", "700": weight = .bold
            case "800": weight = .heavy
            case "900": weight = .black
            case "600": weight = .semibold
            case "500": weight = .medium
            case "300": weight = .light
            case "200": weight = .thin
            case "100": weight = .ultraLight
            default: weight = .regular
            }
            let font = UIFont.systemFont(ofSize: CGFloat(fontSize), weight: weight)
            let size = (text as NSString).size(withAttributes: [.font: font])
            return ["width": Double(ceil(size.width)), "height": Double(ceil(size.height))]
        }
        bridge.setObject(measureText, forKeyedSubscript: "measureText" as NSString)

        // requestAnimationFrame
        let raf: @convention(block) (JSValue) -> Int = { [weak self] callback in
            guard let self = self else { return 0 }
            let id = self.nextRafId
            self.nextRafId += 1
            self.rafCallbacks[id] = callback
            DispatchQueue.main.async {
                if let cb = self.rafCallbacks.removeValue(forKey: id) {
                    cb.call(withArguments: [Date().timeIntervalSince1970 * 1000])
                }
            }
            return id
        }
        bridge.setObject(raf, forKeyedSubscript: "requestAnimationFrame" as NSString)

        // cancelAnimationFrame
        let cancelRaf: @convention(block) (Int) -> Void = { [weak self] id in
            self?.rafCallbacks.removeValue(forKey: id)
        }
        bridge.setObject(cancelRaf, forKeyedSubscript: "cancelAnimationFrame" as NSString)

        // getViewportSize
        let getViewport: @convention(block) () -> [String: Double] = { [weak self] in
            guard let view = self?.renderView else {
                return ["width": 390, "height": 844]
            }
            return [
                "width": Double(view.bounds.width),
                "height": Double(view.bounds.height),
            ]
        }
        bridge.setObject(getViewport, forKeyedSubscript: "getViewportSize" as NSString)

        // platform identifier
        bridge.setObject("ios", forKeyedSubscript: "platform" as NSString)

        context.setObject(bridge, forKeyedSubscript: "__glyph_native" as NSString)

        // --- Global timer/scheduling APIs ---
        context.setObject(raf, forKeyedSubscript: "requestAnimationFrame" as NSString)
        context.setObject(cancelRaf, forKeyedSubscript: "cancelAnimationFrame" as NSString)

        // setTimeout
        let setTimeout: @convention(block) (JSValue, Double) -> Int = { [weak self] callback, delay in
            guard let self = self else { return 0 }
            let id = self.nextRafId
            self.nextRafId += 1
            DispatchQueue.main.asyncAfter(deadline: .now() + delay / 1000.0) {
                callback.call(withArguments: [])
            }
            return id
        }
        context.setObject(setTimeout, forKeyedSubscript: "setTimeout" as NSString)

        // setInterval (basic: non-cancellable, sufficient for most UI use cases)
        let setInterval: @convention(block) (JSValue, Double) -> Int = { [weak self] callback, interval in
            guard let self = self else { return 0 }
            let id = self.nextRafId
            self.nextRafId += 1
            Timer.scheduledTimer(withTimeInterval: interval / 1000.0, repeats: true) { _ in
                callback.call(withArguments: [])
            }
            return id
        }
        context.setObject(setInterval, forKeyedSubscript: "setInterval" as NSString)

        let clearTimeout: @convention(block) (Int) -> Void = { _ in }
        context.setObject(clearTimeout, forKeyedSubscript: "clearTimeout" as NSString)
        context.setObject(clearTimeout, forKeyedSubscript: "clearInterval" as NSString)

        // queueMicrotask
        let queueMicrotask: @convention(block) (JSValue) -> Void = { callback in
            DispatchQueue.main.async {
                callback.call(withArguments: [])
            }
        }
        context.setObject(queueMicrotask, forKeyedSubscript: "queueMicrotask" as NSString)

        // MessageChannel polyfill — required by React's scheduler
        context.evaluateScript("""
        if (typeof MessageChannel === 'undefined') {
            function MessageChannel() {
                this.port1 = { onmessage: null };
                var port1 = this.port1;
                this.port2 = {
                    postMessage: function(msg) {
                        if (port1.onmessage) {
                            var handler = port1.onmessage;
                            queueMicrotask(function() { handler({ data: msg }); });
                        }
                    }
                };
            }
            this.MessageChannel = MessageChannel;
        }
        """)

        // performance.now
        let perfObj = JSValue(newObjectIn: context)!
        let startTime = Date().timeIntervalSince1970
        let perfNow: @convention(block) () -> Double = {
            return (Date().timeIntervalSince1970 - startTime) * 1000
        }
        perfObj.setObject(perfNow, forKeyedSubscript: "now" as NSString)
        context.setObject(perfObj, forKeyedSubscript: "performance" as NSString)

        // Error handling
        context.exceptionHandler = { _, exception in
            print("[JS Error]", exception?.toString() ?? "unknown error")
        }
    }

    private func setupTouchBridge() {
        renderView?.onTouch = { [weak self] type, x, y in
            self?.context.evaluateScript("""
                if (typeof __glyph_handleTouch === 'function') {
                    __glyph_handleTouch('\(type)', \(x), \(y));
                }
            """)
        }
    }

    // MARK: - Bundle Loading

    func loadBundle() {
        // Try app bundle first
        if let bundlePath = Bundle.main.path(forResource: "bundle", ofType: "js"),
           let bundleJS = try? String(contentsOfFile: bundlePath) {
            context.evaluateScript(bundleJS)
            return
        }

        // Fallback paths for development
        let fallbackPaths = [
            "native/ios/GlyphShell/Resources/bundle.js",
            ".glyph-build/ios/bundle.js",
        ]
        for path in fallbackPaths {
            if let js = try? String(contentsOfFile: path) {
                context.evaluateScript(js)
                return
            }
        }

        print("[Glyph] Error: bundle.js not found")
    }

    // MARK: - Viewport

    func updateViewportSize(width: CGFloat, height: CGFloat) {
        context.evaluateScript("""
            if (typeof __glyph_updateViewport === 'function') {
                __glyph_updateViewport(\(width), \(height));
            }
        """)
    }
}
