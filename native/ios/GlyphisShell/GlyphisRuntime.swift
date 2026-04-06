import JavaScriptCore
import UIKit

/// Manages a JavaScriptCore context that runs the Glyphis JS bundle and bridges
/// render commands, text measurement, animation frames, and touch events
/// between JS and native.
///
/// This class is responsible only for:
/// 1. JSContext setup
/// 2. Bridge registration (functions exposed to JS)
/// 3. Polyfills (console, setTimeout, queueMicrotask)
/// 4. Bundle loading
/// 5. Forwarding calls to: RenderView, YogaBridge, ImageLoader
class GlyphisRuntime {
    private let context: JSContext
    private weak var renderView: GlyphisRenderView?
    private var rafCallbacks: [Int: JSValue] = [:]
    private var nextRafId = 1
    private var yogaBridge: YogaBridge?
    private var imageLoader: ImageLoader?

    // Cached JS callback references (looked up after bundle loads)
    private var touchCallback: JSValue?
    private var textChangeCallback: JSValue?
    private var textSubmitCallback: JSValue?
    private var textFocusCallback: JSValue?
    private var textBlurCallback: JSValue?
    private var imageLoadedCallback: JSValue?
    private var viewportUpdateCallback: JSValue?
    private var fetchResponseCallback: JSValue?
    private var fetchErrorCallback: JSValue?
    private var wsOpenCallback: JSValue?
    private var wsMessageCallback: JSValue?
    private var wsCloseCallback: JSValue?
    private var wsErrorCallback: JSValue?

    // WebSocket state
    private var webSocketTasks: [Int: URLSessionWebSocketTask] = [:]

    init(renderView: GlyphisRenderView) {
        self.renderView = renderView
        self.context = JSContext()!
        setupImageLoader()
        setupBridge()
        setupTouchBridge()
        // Register native Yoga bridge (replaces WASM yoga-layout)
        let yoga = YogaBridge(context: context)
        yoga.register(in: context)
        self.yogaBridge = yoga
    }

    /// Look up and cache all __glyphis_* global callback functions.
    /// Must be called AFTER the bundle has been evaluated.
    private func cacheCallbacks() {
        touchCallback = context.objectForKeyedSubscript("__glyphis_handleTouch")
        textChangeCallback = context.objectForKeyedSubscript("__glyphis_onTextChange")
        textSubmitCallback = context.objectForKeyedSubscript("__glyphis_onTextSubmit")
        textFocusCallback = context.objectForKeyedSubscript("__glyphis_onTextFocus")
        textBlurCallback = context.objectForKeyedSubscript("__glyphis_onTextBlur")
        imageLoadedCallback = context.objectForKeyedSubscript("__glyphis_onImageLoaded")
        viewportUpdateCallback = context.objectForKeyedSubscript("__glyphis_updateViewport")
        fetchResponseCallback = context.objectForKeyedSubscript("__glyphis_onFetchResponse")
        fetchErrorCallback = context.objectForKeyedSubscript("__glyphis_onFetchError")
        wsOpenCallback = context.objectForKeyedSubscript("__glyphis_onWsOpen")
        wsMessageCallback = context.objectForKeyedSubscript("__glyphis_onWsMessage")
        wsCloseCallback = context.objectForKeyedSubscript("__glyphis_onWsClose")
        wsErrorCallback = context.objectForKeyedSubscript("__glyphis_onWsError")

        // Wire up RenderView text callbacks to use cached JSValues
        renderView?.onTextChange = { [weak self] inputId, text in
            self?.textChangeCallback?.call(withArguments: [inputId, text])
        }
        renderView?.onTextSubmit = { [weak self] inputId in
            self?.textSubmitCallback?.call(withArguments: [inputId])
        }
        renderView?.onTextFocus = { [weak self] inputId in
            self?.textFocusCallback?.call(withArguments: [inputId])
        }
    }

    private func setupImageLoader() {
        let loader = ImageLoader { [weak self] imageId, cgImage, width, height in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.imageLoadedCallback?.call(withArguments: [imageId, width, height])
            }
        }
        self.imageLoader = loader
        renderView?.imageLookup = { [weak loader] imageId in
            return loader?.cache[imageId]
        }
    }

    // MARK: - Bridge Setup

    private func setupBridge() {
        // --- console ---
        // Use evaluateScript to create the console bridge in JS,
        // calling back to a native log function
        let nativeLog: @convention(block) (String) -> Void = { msg in
            NSLog("[JS] %@", msg)
        }
        context.setObject(nativeLog, forKeyedSubscript: "__nativeLog" as NSString)
        context.evaluateScript("""
            var console = {
                log: function() { __nativeLog(Array.prototype.slice.call(arguments).join(' ')); },
                warn: function() { __nativeLog(Array.prototype.slice.call(arguments).join(' ')); },
                error: function() { __nativeLog(Array.prototype.slice.call(arguments).join(' ')); },
                info: function() { __nativeLog(Array.prototype.slice.call(arguments).join(' ')); },
                debug: function() { __nativeLog(Array.prototype.slice.call(arguments).join(' ')); },
            };
        """)

        // --- __glyphis_native bridge object ---
        let bridge = JSValue(newObjectIn: context)!

        // submitRenderCommands: receives JS array of render command objects directly (no JSON)
        let submitRender: @convention(block) (JSValue) -> Void = { [weak self] jsCommands in
            guard let self = self else { return }
            let commands = self.readRenderCommands(jsCommands)
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

        // loadImage: forwards to ImageLoader
        let loadImage: @convention(block) (String, String) -> Void = { [weak self] imageId, url in
            self?.imageLoader?.load(imageId: imageId, url: url)
        }
        bridge.setObject(loadImage, forKeyedSubscript: "loadImage" as NSString)

        // showTextInput(inputId, x, y, w, h, value, placeholder, fontSize, color, phColor, kbType, retKey, secure, multiline, maxLen)
        let showTextInput: @convention(block) (String, Double, Double, Double, Double, String, String, Double, String, String, String, String, Bool, Bool, Int) -> Void = {
            [weak self] inputId, x, y, w, h, value, placeholder, fontSize, color, phColor, kbType, retKey, secure, multiline, maxLen in
            DispatchQueue.main.async {
                self?.renderView?.showTextInput(
                    inputId: inputId, x: x, y: y, width: w, height: h,
                    value: value, placeholder: placeholder, fontSize: fontSize,
                    color: color, placeholderColor: phColor,
                    keyboardType: kbType, returnKeyType: retKey,
                    secureTextEntry: secure, multiline: multiline, maxLength: maxLen)
            }
        }
        bridge.setObject(showTextInput, forKeyedSubscript: "showTextInput" as NSString)

        // updateTextInput(inputId, x, y, w, h)
        let updateTextInput: @convention(block) (String, Double, Double, Double, Double) -> Void = {
            [weak self] inputId, x, y, w, h in
            DispatchQueue.main.async {
                self?.renderView?.updateTextInput(inputId: inputId, x: x, y: y, width: w, height: h)
            }
        }
        bridge.setObject(updateTextInput, forKeyedSubscript: "updateTextInput" as NSString)

        // hideTextInput(inputId)
        let hideTextInput: @convention(block) (String) -> Void = { [weak self] inputId in
            DispatchQueue.main.async {
                self?.renderView?.hideTextInput(inputId: inputId)
            }
        }
        bridge.setObject(hideTextInput, forKeyedSubscript: "hideTextInput" as NSString)

        // localStorage bridge (UserDefaults)
        let storageSet: @convention(block) (String, String) -> Void = { key, value in
            UserDefaults.standard.set(value, forKey: "glyphis_\(key)")
        }
        bridge.setObject(storageSet, forKeyedSubscript: "storageSet" as NSString)

        let storageRemove: @convention(block) (String) -> Void = { key in
            UserDefaults.standard.removeObject(forKey: "glyphis_\(key)")
        }
        bridge.setObject(storageRemove, forKeyedSubscript: "storageRemove" as NSString)

        let storageClear: @convention(block) () -> Void = {
            let defaults = UserDefaults.standard
            for key in defaults.dictionaryRepresentation().keys {
                if key.hasPrefix("glyphis_") {
                    defaults.removeObject(forKey: key)
                }
            }
        }
        bridge.setObject(storageClear, forKeyedSubscript: "storageClear" as NSString)

        let storageGetAll: @convention(block) () -> String = {
            let defaults = UserDefaults.standard
            var result: [String: String] = [:]
            for (key, value) in defaults.dictionaryRepresentation() {
                if key.hasPrefix("glyphis_"), let strValue = value as? String {
                    let shortKey = String(key.dropFirst("glyphis_".count))
                    result[shortKey] = strValue
                }
            }
            guard let data = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: data, encoding: .utf8) else { return "{}" }
            return json
        }
        bridge.setObject(storageGetAll, forKeyedSubscript: "storageGetAll" as NSString)

        // fetch: performs HTTP request on background thread, calls back on main thread
        let fetchBridge: @convention(block) (Int, String, String, String, String) -> Void = {
            [weak self] reqId, url, method, headersJson, body in
            self?.performFetch(reqId: reqId, url: url, method: method,
                               headersJson: headersJson, body: body)
        }
        bridge.setObject(fetchBridge, forKeyedSubscript: "fetch" as NSString)

        // WebSocket bridge
        let wsConnect: @convention(block) (Int, String, String) -> Void = {
            [weak self] wsId, url, protocols in
            self?.connectWebSocket(wsId: wsId, url: url, protocols: protocols)
        }
        bridge.setObject(wsConnect, forKeyedSubscript: "wsConnect" as NSString)

        let wsSend: @convention(block) (Int, String) -> Void = {
            [weak self] wsId, data in
            self?.sendWebSocket(wsId: wsId, data: data)
        }
        bridge.setObject(wsSend, forKeyedSubscript: "wsSend" as NSString)

        let wsCloseBridge: @convention(block) (Int, Int, String) -> Void = {
            [weak self] wsId, code, reason in
            self?.closeWebSocket(wsId: wsId, code: code, reason: reason)
        }
        bridge.setObject(wsCloseBridge, forKeyedSubscript: "wsClose" as NSString)

        // platform identifier
        bridge.setObject("ios", forKeyedSubscript: "platform" as NSString)

        context.setObject(bridge, forKeyedSubscript: "__glyphis_native" as NSString)

        // --- Global timer/scheduling APIs ---
        context.setObject(raf, forKeyedSubscript: "requestAnimationFrame" as NSString)
        context.setObject(cancelRaf, forKeyedSubscript: "cancelAnimationFrame" as NSString)

        // setTimeout
        let setTimeout: @convention(block) (JSValue, Double) -> Int = { [weak self] callback, delay in
            guard let self = self else { return 0 }
            let id = self.nextRafId
            self.nextRafId += 1
            self.rafCallbacks[id] = callback
            DispatchQueue.main.asyncAfter(deadline: .now() + delay / 1000.0) { [weak self] in
                guard let self = self else { return }
                if let cb = self.rafCallbacks.removeValue(forKey: id) {
                    cb.call(withArguments: [])
                }
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

        // queueMicrotask — use setTimeout(0) since JSC's Promise microtask queue
        // doesn't drain automatically in evaluateScript context
        context.evaluateScript("""
            globalThis.queueMicrotask = function(callback) {
                setTimeout(callback, 0);
            };
        """)

        // MessageChannel polyfill — uses queueMicrotask (which uses Promise internally)
        context.evaluateScript("""
            if (typeof MessageChannel === 'undefined') {
                function MessageChannel() {
                    this.port1 = { onmessage: null };
                    var port1 = this.port1;
                    this.port2 = {
                        postMessage: function(msg) {
                            if (port1.onmessage) {
                                var handler = port1.onmessage;
                                Promise.resolve().then(function() { handler({ data: msg }); });
                            }
                        }
                    };
                }
                globalThis.MessageChannel = MessageChannel;
            }
        """)

        // fetch polyfill
        context.evaluateScript("""
            var __glyphis_nextFetchId = 1;
            var __glyphis_fetchCallbacks = {};

            globalThis.fetch = function(url, options) {
                return new Promise(function(resolve, reject) {
                    var reqId = __glyphis_nextFetchId++;
                    __glyphis_fetchCallbacks[reqId] = { resolve: resolve, reject: reject };
                    var method = (options && options.method) || 'GET';
                    var headers = (options && options.headers) || {};
                    var body = (options && options.body) || '';
                    __glyphis_native.fetch(reqId, url, method, JSON.stringify(headers), body);
                });
            };

            globalThis.__glyphis_onFetchResponse = function(reqId, status, headersJson, body) {
                var cb = __glyphis_fetchCallbacks[reqId];
                if (!cb) return;
                delete __glyphis_fetchCallbacks[reqId];
                var headers = {};
                try { headers = JSON.parse(headersJson); } catch(e) {}
                var response = {
                    ok: status >= 200 && status < 300,
                    status: status,
                    statusText: '',
                    headers: {
                        get: function(name) { return headers[name.toLowerCase()] || null; },
                        has: function(name) { return name.toLowerCase() in headers; }
                    },
                    text: function() { return Promise.resolve(body); },
                    json: function() { return Promise.resolve(JSON.parse(body)); },
                    clone: function() { return response; }
                };
                cb.resolve(response);
            };

            globalThis.__glyphis_onFetchError = function(reqId, message) {
                var cb = __glyphis_fetchCallbacks[reqId];
                if (!cb) return;
                delete __glyphis_fetchCallbacks[reqId];
                cb.reject(new Error(message));
            };
        """)

        // performance.now
        let perfObj = JSValue(newObjectIn: context)!
        let startTime = Date().timeIntervalSince1970
        let perfNow: @convention(block) () -> Double = {
            return (Date().timeIntervalSince1970 - startTime) * 1000
        }
        perfObj.setObject(perfNow, forKeyedSubscript: "now" as NSString)
        context.setObject(perfObj, forKeyedSubscript: "performance" as NSString)

        // --- Browser API polyfills ---

        // localStorage (backed by UserDefaults)
        context.evaluateScript("""
            var __storage = {};
            globalThis.localStorage = {
                getItem: function(key) { return __storage[key] || null; },
                setItem: function(key, value) { __storage[key] = String(value); __glyphis_native.storageSet(key, String(value)); },
                removeItem: function(key) { delete __storage[key]; __glyphis_native.storageRemove(key); },
                clear: function() { __storage = {}; __glyphis_native.storageClear(); },
                get length() { return Object.keys(__storage).length; },
                key: function(i) { var keys = Object.keys(__storage); return keys[i] || null; }
            };
            var __storedData = __glyphis_native.storageGetAll();
            if (__storedData) { try { __storage = JSON.parse(__storedData); } catch(e) {} }
        """)

        // URLSearchParams + URL
        context.evaluateScript("""
            globalThis.URLSearchParams = function(search) {
                var params = {};
                if (search) {
                    var s = String(search).replace(/^\\?/, '');
                    var pairs = s.split('&');
                    for (var i = 0; i < pairs.length; i++) {
                        var parts = pairs[i].split('=');
                        if (parts[0]) params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
                    }
                }
                this._params = params;
                this.get = function(name) { return this._params[name] !== undefined ? this._params[name] : null; };
                this.has = function(name) { return name in this._params; };
                this.set = function(name, value) { this._params[name] = String(value); };
                this['delete'] = function(name) { delete this._params[name]; };
                this.toString = function() {
                    var keys = Object.keys(this._params);
                    var parts = [];
                    for (var i = 0; i < keys.length; i++) {
                        parts.push(encodeURIComponent(keys[i]) + '=' + encodeURIComponent(this._params[keys[i]]));
                    }
                    return parts.join('&');
                };
            };
            globalThis.URL = function(url, base) {
                if (base) {
                    if (url.indexOf('://') === -1) {
                        url = base.replace(/\\/[^\\/]*$/, '/') + url;
                    }
                }
                var match = url.match(/^(https?:)\\/\\/([^\\/\\?#]+)(\\/[^?#]*)?(\\?[^#]*)?(#.*)?$/);
                if (!match) throw new TypeError('Invalid URL: ' + url);
                this.protocol = match[1] || '';
                this.host = match[2] || '';
                this.hostname = this.host.split(':')[0];
                this.port = this.host.split(':')[1] || '';
                this.pathname = match[3] || '/';
                this.search = match[4] || '';
                this.hash = match[5] || '';
                this.origin = this.protocol + '//' + this.host;
                this.href = url;
                this.searchParams = new URLSearchParams(this.search);
            };
            URL.prototype.toString = function() { return this.href; };
        """)

        // btoa / atob (Base64)
        context.evaluateScript("""
            var __b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            globalThis.btoa = function(str) {
                var out = '';
                for (var i = 0; i < str.length; i += 3) {
                    var c1 = str.charCodeAt(i);
                    var c2 = i+1 < str.length ? str.charCodeAt(i+1) : 0;
                    var c3 = i+2 < str.length ? str.charCodeAt(i+2) : 0;
                    out += __b64chars[c1 >> 2];
                    out += __b64chars[((c1 & 3) << 4) | (c2 >> 4)];
                    out += i+1 < str.length ? __b64chars[((c2 & 15) << 2) | (c3 >> 6)] : '=';
                    out += i+2 < str.length ? __b64chars[c3 & 63] : '=';
                }
                return out;
            };
            globalThis.atob = function(str) {
                str = str.replace(/=/g, '');
                var out = '';
                for (var i = 0; i < str.length; i += 4) {
                    var c1 = __b64chars.indexOf(str[i]);
                    var c2 = __b64chars.indexOf(str[i+1]);
                    var c3 = i+2 < str.length ? __b64chars.indexOf(str[i+2]) : 0;
                    var c4 = i+3 < str.length ? __b64chars.indexOf(str[i+3]) : 0;
                    out += String.fromCharCode((c1 << 2) | (c2 >> 4));
                    if (i+2 < str.length) out += String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2));
                    if (i+3 < str.length) out += String.fromCharCode(((c3 & 3) << 6) | c4);
                }
                return out;
            };
        """)

        // TextEncoder / TextDecoder (UTF-8 only)
        context.evaluateScript("""
            globalThis.TextEncoder = function() {};
            TextEncoder.prototype.encode = function(str) {
                var utf8 = [];
                for (var i = 0; i < str.length; i++) {
                    var c = str.charCodeAt(i);
                    if (c < 128) { utf8.push(c); }
                    else if (c < 2048) { utf8.push(192 | (c >> 6), 128 | (c & 63)); }
                    else { utf8.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
                }
                return new Uint8Array(utf8);
            };
            globalThis.TextDecoder = function() {};
            TextDecoder.prototype.decode = function(buf) {
                var arr = new Uint8Array(buf);
                var str = '';
                for (var i = 0; i < arr.length; ) {
                    var c = arr[i];
                    if (c < 128) { str += String.fromCharCode(c); i++; }
                    else if (c < 224) { str += String.fromCharCode(((c & 31) << 6) | (arr[i+1] & 63)); i += 2; }
                    else { str += String.fromCharCode(((c & 15) << 12) | ((arr[i+1] & 63) << 6) | (arr[i+2] & 63)); i += 3; }
                }
                return str;
            };
        """)

        // crypto.getRandomValues (Math.random based -- not cryptographically secure)
        context.evaluateScript("""
            globalThis.crypto = {
                getRandomValues: function(arr) {
                    for (var i = 0; i < arr.length; i++) {
                        arr[i] = Math.floor(Math.random() * 256);
                    }
                    return arr;
                }
            };
        """)

        // AbortController / AbortSignal
        context.evaluateScript("""
            globalThis.AbortController = function() {
                this.signal = { aborted: false, reason: undefined };
                var self = this;
                this.abort = function(reason) {
                    self.signal.aborted = true;
                    self.signal.reason = reason || new Error('AbortError');
                };
            };
        """)

        // WebSocket polyfill
        context.evaluateScript("""
            var __glyphis_nextWsId = 1;
            var __glyphis_wsInstances = {};

            globalThis.WebSocket = function(url, protocols) {
                var wsId = __glyphis_nextWsId++;
                this._wsId = wsId;
                this.url = url;
                this.readyState = 0;
                this.onopen = null;
                this.onmessage = null;
                this.onclose = null;
                this.onerror = null;
                __glyphis_wsInstances[wsId] = this;
                __glyphis_native.wsConnect(wsId, url, protocols || '');
            };

            WebSocket.CONNECTING = 0;
            WebSocket.OPEN = 1;
            WebSocket.CLOSING = 2;
            WebSocket.CLOSED = 3;

            WebSocket.prototype.send = function(data) {
                if (this.readyState !== 1) throw new Error('WebSocket is not open');
                __glyphis_native.wsSend(this._wsId, String(data));
            };

            WebSocket.prototype.close = function(code, reason) {
                if (this.readyState >= 2) return;
                this.readyState = 2;
                __glyphis_native.wsClose(this._wsId, code || 1000, reason || '');
            };

            globalThis.__glyphis_onWsOpen = function(wsId) {
                var ws = __glyphis_wsInstances[wsId];
                if (!ws) return;
                ws.readyState = 1;
                if (ws.onopen) ws.onopen({ type: 'open' });
            };

            globalThis.__glyphis_onWsMessage = function(wsId, data) {
                var ws = __glyphis_wsInstances[wsId];
                if (!ws) return;
                if (ws.onmessage) ws.onmessage({ type: 'message', data: data });
            };

            globalThis.__glyphis_onWsClose = function(wsId, code, reason) {
                var ws = __glyphis_wsInstances[wsId];
                if (!ws) return;
                ws.readyState = 3;
                if (ws.onclose) ws.onclose({ type: 'close', code: code, reason: reason, wasClean: code === 1000 });
                delete __glyphis_wsInstances[wsId];
            };

            globalThis.__glyphis_onWsError = function(wsId, message) {
                var ws = __glyphis_wsInstances[wsId];
                if (!ws) return;
                if (ws.onerror) ws.onerror({ type: 'error', message: message });
            };
        """)

        // Error handling
        context.exceptionHandler = { _, exception in
            NSLog("[JS Error] %@", exception?.toString() ?? "unknown error")
        }
    }

    // MARK: - Render Command Reading

    /// Read a JS array of render command objects into native [[String: Any]] dictionaries.
    /// This avoids JSON.stringify on the JS side and JSONSerialization on the native side.
    private func readRenderCommands(_ jsCommands: JSValue) -> [[String: Any]] {
        let count = jsCommands.objectForKeyedSubscript("length").toInt32()
        if count <= 0 { return [] }

        var commands: [[String: Any]] = []
        commands.reserveCapacity(Int(count))

        for i in 0..<count {
            let cmd = jsCommands.objectAtIndexedSubscript(Int(i))!
            let typeVal = cmd.objectForKeyedSubscript("type")
            if typeVal == nil || typeVal!.isUndefined { continue }
            let type = typeVal!.toString()!

            var dict: [String: Any] = ["type": type]

            switch type {
            case "rect":
                dict["x"] = cmd.objectForKeyedSubscript("x")!.toDouble()
                dict["y"] = cmd.objectForKeyedSubscript("y")!.toDouble()
                dict["width"] = cmd.objectForKeyedSubscript("width")!.toDouble()
                dict["height"] = cmd.objectForKeyedSubscript("height")!.toDouble()
                dict["color"] = cmd.objectForKeyedSubscript("color")!.toString()!
                let br = cmd.objectForKeyedSubscript("borderRadius")!
                if !br.isUndefined { dict["borderRadius"] = br.toDouble() }
                let op = cmd.objectForKeyedSubscript("opacity")!
                if !op.isUndefined { dict["opacity"] = op.toDouble() }

            case "text":
                dict["x"] = cmd.objectForKeyedSubscript("x")!.toDouble()
                dict["y"] = cmd.objectForKeyedSubscript("y")!.toDouble()
                dict["text"] = cmd.objectForKeyedSubscript("text")!.toString()!
                dict["color"] = cmd.objectForKeyedSubscript("color")!.toString()!
                dict["fontSize"] = cmd.objectForKeyedSubscript("fontSize")!.toDouble()
                let fw = cmd.objectForKeyedSubscript("fontWeight")!
                if !fw.isUndefined { dict["fontWeight"] = fw.toString()! }
                let ff = cmd.objectForKeyedSubscript("fontFamily")!
                if !ff.isUndefined { dict["fontFamily"] = ff.toString()! }
                let ta = cmd.objectForKeyedSubscript("textAlign")!
                if !ta.isUndefined { dict["textAlign"] = ta.toString()! }
                let mw = cmd.objectForKeyedSubscript("maxWidth")!
                if !mw.isUndefined { dict["maxWidth"] = mw.toDouble() }
                let op = cmd.objectForKeyedSubscript("opacity")!
                if !op.isUndefined { dict["opacity"] = op.toDouble() }

            case "border":
                dict["x"] = cmd.objectForKeyedSubscript("x")!.toDouble()
                dict["y"] = cmd.objectForKeyedSubscript("y")!.toDouble()
                dict["width"] = cmd.objectForKeyedSubscript("width")!.toDouble()
                dict["height"] = cmd.objectForKeyedSubscript("height")!.toDouble()
                dict["color"] = cmd.objectForKeyedSubscript("color")!.toString()!
                let widthsVal = cmd.objectForKeyedSubscript("widths")!
                if !widthsVal.isUndefined {
                    let wLen = widthsVal.objectForKeyedSubscript("length").toInt32()
                    if wLen == 4 {
                        dict["widths"] = [
                            NSNumber(value: widthsVal.objectAtIndexedSubscript(0)!.toDouble()),
                            NSNumber(value: widthsVal.objectAtIndexedSubscript(1)!.toDouble()),
                            NSNumber(value: widthsVal.objectAtIndexedSubscript(2)!.toDouble()),
                            NSNumber(value: widthsVal.objectAtIndexedSubscript(3)!.toDouble()),
                        ]
                    }
                }
                let br = cmd.objectForKeyedSubscript("borderRadius")!
                if !br.isUndefined { dict["borderRadius"] = br.toDouble() }
                let op = cmd.objectForKeyedSubscript("opacity")!
                if !op.isUndefined { dict["opacity"] = op.toDouble() }

            case "clip-start":
                dict["id"] = cmd.objectForKeyedSubscript("id")!.toInt32()
                dict["x"] = cmd.objectForKeyedSubscript("x")!.toDouble()
                dict["y"] = cmd.objectForKeyedSubscript("y")!.toDouble()
                dict["width"] = cmd.objectForKeyedSubscript("width")!.toDouble()
                dict["height"] = cmd.objectForKeyedSubscript("height")!.toDouble()
                let br = cmd.objectForKeyedSubscript("borderRadius")!
                if !br.isUndefined { dict["borderRadius"] = br.toDouble() }

            case "clip-end":
                dict["id"] = cmd.objectForKeyedSubscript("id")!.toInt32()

            case "image":
                dict["imageId"] = cmd.objectForKeyedSubscript("imageId")!.toString()!
                dict["x"] = cmd.objectForKeyedSubscript("x")!.toDouble()
                dict["y"] = cmd.objectForKeyedSubscript("y")!.toDouble()
                dict["width"] = cmd.objectForKeyedSubscript("width")!.toDouble()
                dict["height"] = cmd.objectForKeyedSubscript("height")!.toDouble()
                dict["resizeMode"] = cmd.objectForKeyedSubscript("resizeMode")!.toString()!
                let op = cmd.objectForKeyedSubscript("opacity")!
                if !op.isUndefined { dict["opacity"] = op.toDouble() }
                let br = cmd.objectForKeyedSubscript("borderRadius")!
                if !br.isUndefined { dict["borderRadius"] = br.toDouble() }

            default:
                break
            }

            commands.append(dict)
        }

        return commands
    }

    // MARK: - Fetch

    private func performFetch(reqId: Int, url: String, method: String,
                              headersJson: String, body: String) {
        guard let requestUrl = URL(string: url) else {
            fetchErrorCallback?.call(withArguments: [reqId, "Invalid URL"])
            return
        }
        var request = URLRequest(url: requestUrl)
        request.httpMethod = method

        // Parse and set headers
        if let data = headersJson.data(using: .utf8),
           let headers = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            for (key, value) in headers {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }

        if !body.isEmpty && (method == "POST" || method == "PUT" || method == "PATCH") {
            request.httpBody = body.data(using: .utf8)
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.fetchErrorCallback?.call(withArguments: [reqId, error.localizedDescription])
                    return
                }
                guard let httpResponse = response as? HTTPURLResponse,
                      let data = data else {
                    self?.fetchErrorCallback?.call(withArguments: [reqId, "No response"])
                    return
                }

                let status = httpResponse.statusCode
                var headers: [String: String] = [:]
                for (key, value) in httpResponse.allHeaderFields {
                    headers[String(describing: key).lowercased()] = String(describing: value)
                }
                let headersJson = (try? JSONSerialization.data(withJSONObject: headers))
                    .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                let bodyStr = String(data: data, encoding: .utf8) ?? ""

                self?.fetchResponseCallback?.call(withArguments: [reqId, status, headersJson, bodyStr])
            }
        }.resume()
    }

    // MARK: - WebSocket

    private func connectWebSocket(wsId: Int, url: String, protocols: String) {
        guard let wsUrl = Foundation.URL(string: url) else {
            wsErrorCallback?.call(withArguments: [wsId, "Invalid WebSocket URL"])
            wsCloseCallback?.call(withArguments: [wsId, 1006, "Invalid URL"])
            return
        }
        var request = URLRequest(url: wsUrl)
        if !protocols.isEmpty {
            request.setValue(protocols, forHTTPHeaderField: "Sec-WebSocket-Protocol")
        }
        let task = URLSession.shared.webSocketTask(with: request)
        webSocketTasks[wsId] = task
        task.resume()

        // Fire open after resume and start receiving
        DispatchQueue.main.async { [weak self] in
            self?.wsOpenCallback?.call(withArguments: [wsId])
        }

        receiveWebSocketMessage(wsId: wsId, task: task)
    }

    private func receiveWebSocketMessage(wsId: Int, task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                var data = ""
                switch message {
                case .string(let text):
                    data = text
                case .data(let bytes):
                    data = String(data: bytes, encoding: .utf8) ?? ""
                @unknown default:
                    break
                }
                DispatchQueue.main.async {
                    self.wsMessageCallback?.call(withArguments: [wsId, data])
                }
                // Continue receiving
                self.receiveWebSocketMessage(wsId: wsId, task: task)
            case .failure(let error):
                DispatchQueue.main.async {
                    self.wsErrorCallback?.call(withArguments: [wsId, error.localizedDescription])
                    self.wsCloseCallback?.call(withArguments: [wsId, 1006, "Connection lost"])
                    self.webSocketTasks.removeValue(forKey: wsId)
                }
            }
        }
    }

    private func sendWebSocket(wsId: Int, data: String) {
        guard let task = webSocketTasks[wsId] else { return }
        task.send(.string(data)) { [weak self] error in
            if let error = error {
                DispatchQueue.main.async {
                    self?.wsErrorCallback?.call(withArguments: [wsId, error.localizedDescription])
                }
            }
        }
    }

    private func closeWebSocket(wsId: Int, code: Int, reason: String) {
        guard let task = webSocketTasks[wsId] else { return }
        let closeCode = URLSessionWebSocketTask.CloseCode(rawValue: code) ?? .normalClosure
        task.cancel(with: closeCode, reason: reason.data(using: .utf8))
        webSocketTasks.removeValue(forKey: wsId)
    }

    private func setupTouchBridge() {
        renderView?.onTouch = { [weak self] type, x, y in
            self?.touchCallback?.call(withArguments: [type, x, y])
        }
    }

    // MARK: - Bundle Loading

    func loadBundle() {
        // Try app bundle first
        if let bundlePath = Bundle.main.path(forResource: "bundle", ofType: "js"),
           let bundleJS = try? String(contentsOfFile: bundlePath) {
            context.evaluateScript(bundleJS)
            cacheCallbacks()
            return
        }

        // Fallback paths for development
        let fallbackPaths = [
            "native/ios/GlyphisShell/Resources/bundle.js",
            ".glyphis-build/ios/bundle.js",
        ]
        for path in fallbackPaths {
            if let js = try? String(contentsOfFile: path) {
                context.evaluateScript(js)
                cacheCallbacks()
                return
            }
        }

        NSLog("[Glyphis] Error: bundle.js not found")
    }

    // MARK: - Viewport

    func updateViewportSize(width: CGFloat, height: CGFloat) {
        viewportUpdateCallback?.call(withArguments: [width, height])
    }
}
