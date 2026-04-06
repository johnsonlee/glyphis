package io.johnsonlee.glyphis.shell

import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.FrameLayout
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors


/**
 * JS runtime for the Glyphis framework on Android.
 *
 * Uses JavaScriptCore (via jsc-android) through a thin C/JNI bridge -- the
 * same engine used on iOS.  The bridge exposes native functions
 * (`submitRenderCommands`, `measureText`, `getViewportSize`, timers) to JS
 * and forwards render commands to [GlyphisRenderView].
 *
 * This class is responsible only for:
 * 1. JSC setup (via JNI)
 * 2. Bridge registration (functions exposed to JS)
 * 3. Polyfills (console, setTimeout, queueMicrotask)
 * 4. Bundle loading
 * 5. Forwarding calls to: RenderView, TextInputManager, ImageLoader
 */
class GlyphisRuntime(
    private val context: Context,
    private val renderView: GlyphisRenderView,
    container: FrameLayout,
) {
    private val density: Float = context.resources.displayMetrics.density
    private val handler = Handler(Looper.getMainLooper())
    private val httpExecutor = Executors.newCachedThreadPool()
    private val prefs: android.content.SharedPreferences =
        context.getSharedPreferences("glyphis_storage", Context.MODE_PRIVATE)

    private val textInputManager = TextInputManager(
        context = context,
        container = container,
        density = density,
        onTextChange = { inputId, text ->
            nativeFireTextChange(inputId, text)
        },
        onTextSubmit = { inputId ->
            nativeFireTextSubmit(inputId)
        },
        onTextFocus = { inputId ->
            nativeFireTextFocus(inputId)
        },
    )

    private val imageLoader = ImageLoader(
        density = density,
        onImageLoaded = { imageId, bitmap, widthDp, heightDp ->
            handler.post {
                nativeFireImageLoaded(imageId, widthDp.toDouble(), heightDp.toDouble())
            }
        },
    )

    companion object {
        private const val TAG = "GlyphisJSC"

        init {
            System.loadLibrary("jsc")
            System.loadLibrary("glyphis_jsc")
        }
    }

    init {
        renderView.imageLookup = { imageId -> imageLoader.cache[imageId] }
        nativeInit()
        setupTouchBridge()
        setupAccessibilityBridge()
    }

    fun loadBundle() {
        val bundleJS = loadAsset("bundle.js")
        if (bundleJS == null) {
            Log.e(TAG, "bundle.js not found in assets")
            return
        }
        nativeEvaluateScript(bundleJS)
        // Cache JS callback references for direct invocation (no more evaluateScript)
        nativeCacheCallbacks()
    }

    fun updateViewportSize(width: Float, height: Float) {
        nativeFireViewportUpdate(width.toDouble(), height.toDouble())
    }

    private val webSockets = mutableMapOf<Int, SimpleWebSocket>()

    fun destroy() {
        // Close all WebSocket connections
        for ((_, ws) in webSockets) {
            ws.close(1001, "Runtime destroyed")
        }
        webSockets.clear()
        textInputManager.destroy()
        imageLoader.destroy()
        httpExecutor.shutdownNow()
        nativeDestroy()
    }

    // -- Touch bridge --

    private fun setupTouchBridge() {
        renderView.onTouch = { type, x, y ->
            handler.post {
                nativeHandleTouch(type, x.toDouble(), y.toDouble())
            }
        }
    }

    // -- Render command batch from C/JNI (no JSON serialization) --

    /** Staging list built by onCmd* methods during a render batch. */
    private val pendingCommands = mutableListOf<RenderCmd>()

    /** Called from JNI at the start of a render command batch. */
    @Suppress("unused")
    fun onBeginRenderBatch() {
        pendingCommands.clear()
    }

    /** Called from JNI at the end of a render command batch (on main thread). */
    @Suppress("unused")
    fun onEndRenderBatch() {
        renderView.setRenderCommands(ArrayList(pendingCommands))
    }

    @Suppress("unused")
    fun onCmdRect(x: Double, y: Double, w: Double, h: Double,
                  color: String, borderRadius: Double, opacity: Double) {
        pendingCommands.add(RenderCmd.Rect(
            x.toFloat(), y.toFloat(), w.toFloat(), h.toFloat(),
            color, borderRadius.toFloat(), opacity.toFloat()))
    }

    @Suppress("unused")
    fun onCmdText(x: Double, y: Double, text: String, color: String,
                  fontSize: Double, fontWeight: String, fontFamily: String,
                  textAlign: String, maxWidth: Double, opacity: Double) {
        pendingCommands.add(RenderCmd.Text(
            x.toFloat(), y.toFloat(), text, color,
            fontSize.toFloat(), fontWeight, fontFamily, textAlign,
            if (maxWidth < 0) Float.MAX_VALUE else maxWidth.toFloat(),
            opacity.toFloat()))
    }

    @Suppress("unused")
    fun onCmdBorder(x: Double, y: Double, w: Double, h: Double,
                    color: String, tw: Double, rw: Double, bw: Double, lw: Double,
                    borderRadius: Double, opacity: Double) {
        pendingCommands.add(RenderCmd.Border(
            x.toFloat(), y.toFloat(), w.toFloat(), h.toFloat(),
            color,
            tw.toFloat(), rw.toFloat(), bw.toFloat(), lw.toFloat(),
            borderRadius.toFloat(), opacity.toFloat()))
    }

    @Suppress("unused")
    fun onCmdClipStart(id: Int, x: Double, y: Double, w: Double, h: Double,
                       borderRadius: Double) {
        pendingCommands.add(RenderCmd.ClipStart(
            id, x.toFloat(), y.toFloat(), w.toFloat(), h.toFloat(),
            borderRadius.toFloat()))
    }

    @Suppress("unused")
    fun onCmdClipEnd(id: Int) {
        pendingCommands.add(RenderCmd.ClipEnd(id))
    }

    @Suppress("unused")
    fun onCmdImage(imageId: String, x: Double, y: Double, w: Double, h: Double,
                   resizeMode: String, opacity: Double, borderRadius: Double) {
        pendingCommands.add(RenderCmd.Image(
            imageId, x.toFloat(), y.toFloat(), w.toFloat(), h.toFloat(),
            resizeMode, opacity.toFloat(), borderRadius.toFloat()))
    }

    // -- Other callbacks from C/JNI --

    /** Called from JNI when JS invokes `__glyphis_native.measureText(...)`. */
    @Suppress("unused") // called from native code
    fun onMeasureText(text: String, fontSize: Double, fontWeight: String): DoubleArray {
        val typeface = when (fontWeight) {
            "bold", "700" -> Typeface.DEFAULT_BOLD
            else -> Typeface.DEFAULT
        }
        val paint = Paint().apply {
            textSize = (fontSize * density).toFloat()
            this.typeface = typeface
        }
        val width = paint.measureText(text).toDouble() / density
        val metrics = paint.fontMetrics
        val height = (metrics.descent - metrics.ascent).toDouble() / density
        return doubleArrayOf(width, height)
    }

    /** Called from JNI when JS invokes `__glyphis_native.getViewportSize()`. */
    @Suppress("unused") // called from native code
    fun onGetViewportSize(): DoubleArray {
        return doubleArrayOf(
            renderView.width.toDouble() / density,
            renderView.height.toDouble() / density,
        )
    }

    /** Called from JNI when JS invokes `__glyphis_native.loadImage(imageId, url)`. */
    @Suppress("unused") // called from native code
    fun onLoadImage(imageId: String, url: String) {
        imageLoader.load(imageId, url)
    }

    /** Called from JNI when JS invokes `__glyphis_native.scheduleTimer(id, delayMs)`. */
    @Suppress("unused") // called from native code
    fun onScheduleTimer(timerId: Int, delayMs: Double) {
        handler.postDelayed({
            nativeFireTimer(timerId)
        }, delayMs.toLong())
    }

    /** Called from JNI (on main thread) when JS invokes `__glyphis_native.showTextInput`. */
    @Suppress("unused")
    fun onShowTextInput(
        inputId: String, x: Double, y: Double, w: Double, h: Double,
        value: String, placeholder: String, fontSize: Double,
        color: String, placeholderColor: String,
        keyboardType: String, returnKeyType: String,
        secureTextEntry: Boolean, multiline: Boolean, maxLength: Int,
    ) = textInputManager.show(
        inputId, x, y, w, h,
        value, placeholder, fontSize,
        color, placeholderColor,
        keyboardType, returnKeyType,
        secureTextEntry, multiline, maxLength,
    )

    /** Called from JNI (on main thread) when JS invokes `__glyphis_native.updateTextInput`. */
    @Suppress("unused")
    fun onUpdateTextInput(inputId: String, x: Double, y: Double, w: Double, h: Double) =
        textInputManager.update(inputId, x, y, w, h)

    /** Called from JNI (on main thread) when JS invokes `__glyphis_native.hideTextInput`. */
    @Suppress("unused")
    fun onHideTextInput(inputId: String) = textInputManager.hide(inputId)

    // -- localStorage bridge (SharedPreferences) --

    /** Called from JNI when JS invokes `__glyphis_native.storageSet(key, value)`. */
    @Suppress("unused")
    fun onStorageSet(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    /** Called from JNI when JS invokes `__glyphis_native.storageRemove(key)`. */
    @Suppress("unused")
    fun onStorageRemove(key: String) {
        prefs.edit().remove(key).apply()
    }

    /** Called from JNI when JS invokes `__glyphis_native.storageClear()`. */
    @Suppress("unused")
    fun onStorageClear() {
        prefs.edit().clear().apply()
    }

    /** Called from JNI when JS invokes `__glyphis_native.storageGetAll()`. */
    @Suppress("unused")
    fun onStorageGetAll(): String {
        val all = prefs.all
        val json = JSONObject()
        for ((key, value) in all) {
            if (value is String) {
                json.put(key, value)
            }
        }
        return json.toString()
    }

    // -- WebSocket bridge --

    /** Called from JNI when JS invokes `__glyphis_native.wsConnect(wsId, url, protocols)`. */
    @Suppress("unused")
    fun onWsConnect(wsId: Int, url: String, protocols: String) {
        val ws = SimpleWebSocket(
            url = url,
            handler = handler,
            onOpen = { handler.post { nativeFireWsOpen(wsId) } },
            onMessage = { data -> handler.post { nativeFireWsMessage(wsId, data) } },
            onClose = { code, reason ->
                handler.post {
                    nativeFireWsClose(wsId, code, reason)
                    webSockets.remove(wsId)
                }
            },
            onError = { msg -> handler.post { nativeFireWsError(wsId, msg) } },
        )
        webSockets[wsId] = ws
        ws.connect()
    }

    /** Called from JNI when JS invokes `__glyphis_native.wsSend(wsId, data)`. */
    @Suppress("unused")
    fun onWsSend(wsId: Int, data: String) {
        webSockets[wsId]?.send(data)
    }

    /** Called from JNI when JS invokes `__glyphis_native.wsClose(wsId, code, reason)`. */
    @Suppress("unused")
    fun onWsClose(wsId: Int, code: Int, reason: String) {
        webSockets[wsId]?.close(code, reason)
        webSockets.remove(wsId)
    }

    /** Called from JNI when JS invokes `__glyphis_native.fetch(reqId, url, method, headersJson, body)`. */
    @Suppress("unused")
    fun onFetch(reqId: Int, url: String, method: String, headersJson: String, body: String) {
        httpExecutor.execute {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = method

                // Set headers
                try {
                    val headers = JSONObject(headersJson)
                    val keys = headers.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        conn.setRequestProperty(key, headers.getString(key))
                    }
                } catch (_: Exception) {}

                // Send body for POST/PUT/PATCH
                if (body.isNotEmpty() && (method == "POST" || method == "PUT" || method == "PATCH")) {
                    conn.doOutput = true
                    conn.outputStream.use { it.write(body.toByteArray()) }
                }

                val status = conn.responseCode
                val responseHeaders = JSONObject()
                for ((key, values) in conn.headerFields) {
                    if (key != null && values.isNotEmpty()) {
                        responseHeaders.put(key.lowercase(), values.joinToString(", "))
                    }
                }

                val inputStream = if (status >= 400) conn.errorStream else conn.inputStream
                val responseBody = inputStream?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()

                handler.post {
                    nativeFireFetchResponse(reqId, status, responseHeaders.toString(), responseBody)
                }
            } catch (e: Exception) {
                handler.post {
                    nativeFireFetchError(reqId, e.message ?: "Network error")
                }
            }
        }
    }

    // -- Accessibility bridge --

    private fun setupAccessibilityBridge() {
        renderView.accessibilityHelper.onAction = { nodeId, action ->
            nativeFireAccessibilityAction(nodeId, action)
        }
    }

    private val pendingA11yNodes = mutableListOf<GlyphisAccessibilityHelper.SemanticsNode>()

    /** Called from JNI at the start of an accessibility tree batch. */
    @Suppress("unused")
    fun onBeginAccessibilityBatch() {
        pendingA11yNodes.clear()
    }

    /** Called from JNI for each accessibility node in the batch. */
    @Suppress("unused")
    fun onAccessibilityNode(
        id: Int, parentId: Int, x: Double, y: Double, w: Double, h: Double,
        label: String, hint: String, role: String, actions: String,
    ) {
        val actionList = if (actions.isEmpty()) emptyList() else actions.split(",")
        pendingA11yNodes.add(
            GlyphisAccessibilityHelper.SemanticsNode(
                id, x.toFloat(), y.toFloat(), w.toFloat(), h.toFloat(),
                label, hint, role, actionList,
            )
        )
    }

    /** Called from JNI at the end of an accessibility tree batch (on main thread). */
    @Suppress("unused")
    fun onEndAccessibilityBatch() {
        renderView.updateAccessibilityTree(ArrayList(pendingA11yNodes))
    }

    // -- Asset loading --

    private fun loadAsset(filename: String): String? {
        return try {
            context.assets.open(filename).bufferedReader().readText()
        } catch (_: Exception) {
            null
        }
    }

    // -- Native methods (implemented in jsc_bridge.cpp) --

    private external fun nativeInit()
    private external fun nativeEvaluateScript(script: String)
    private external fun nativeDestroy()
    private external fun nativeHandleTouch(type: String, x: Double, y: Double)
    private external fun nativeFireTimer(timerId: Int)
    private external fun nativeCacheCallbacks()
    private external fun nativeFireTextChange(inputId: String, text: String)
    private external fun nativeFireTextSubmit(inputId: String)
    private external fun nativeFireTextFocus(inputId: String)
    private external fun nativeFireTextBlur(inputId: String)
    private external fun nativeFireImageLoaded(imageId: String, width: Double, height: Double)
    private external fun nativeFireViewportUpdate(width: Double, height: Double)
    private external fun nativeFireFetchResponse(reqId: Int, status: Int, headersJson: String, body: String)
    private external fun nativeFireFetchError(reqId: Int, message: String)
    private external fun nativeFireWsOpen(wsId: Int)
    private external fun nativeFireWsMessage(wsId: Int, data: String)
    private external fun nativeFireWsClose(wsId: Int, code: Int, reason: String)
    private external fun nativeFireWsError(wsId: Int, message: String)
    private external fun nativeFireAccessibilityAction(nodeId: Int, action: String)
}
