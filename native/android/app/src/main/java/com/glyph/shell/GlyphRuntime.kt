package com.glyph.shell

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * JS runtime for the Glyph framework on Android.
 *
 * Uses a hidden [WebView] purely as a JavaScript engine (V8) -- it is never
 * displayed.  The app's JS bundle runs inside the WebView and sends render
 * commands to [GlyphRenderView] via the [GlyphBridge] JavascriptInterface.
 *
 * This mirrors the iOS GlyphRuntime which uses JavaScriptCore for the same
 * purpose.  The bridge can be swapped to QuickJS or Hermes later without
 * changing the rendering or bridge protocol.
 */
class GlyphRuntime(
    private val context: Context,
    private val renderView: GlyphRenderView,
) {
    private val handler = Handler(Looper.getMainLooper())
    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    fun loadBundle() {
        // Use hidden WebView as JS engine
        webView = WebView(context).apply {
            settings.javaScriptEnabled = true
            webViewClient = WebViewClient()
            addJavascriptInterface(GlyphBridge(), "__glyph_android_bridge")
        }

        // Setup touch bridge: forward native touch events into JS
        renderView.onTouch = { type, x, y ->
            webView?.evaluateJavascript(
                "if(typeof __glyph_handleTouch==='function')__glyph_handleTouch('$type',$x,$y);",
                null,
            )
        }

        // Load bundle from assets
        val bundleJS = loadAsset("bundle.js") ?: return

        // Inject polyfills + bridge setup + bundle
        val bootstrapJS = """
            // Bridge setup
            var __glyph_native = {
                platform: 'android',
                submitRenderCommands: function(json) {
                    __glyph_android_bridge.submitRenderCommands(json);
                },
                measureText: function(text, fontSize, fontFamily, fontWeight) {
                    var result = __glyph_android_bridge.measureText(text, fontSize, fontFamily, fontWeight);
                    return JSON.parse(result);
                },
                getViewportSize: function() {
                    var result = __glyph_android_bridge.getViewportSize();
                    return JSON.parse(result);
                },
            };

            // Polyfills
            if (typeof performance === 'undefined') {
                var performance = { now: function() { return Date.now(); } };
            }

            // Load app bundle
            $bundleJS
        """.trimIndent()

        webView?.loadDataWithBaseURL(
            "https://glyph.local/",
            "<html><body><script>$bootstrapJS</script></body></html>",
            "text/html",
            "utf-8",
            null,
        )
    }

    fun updateViewportSize(width: Float, height: Float) {
        webView?.evaluateJavascript(
            "if(typeof __glyph_viewportChanged==='function')__glyph_viewportChanged($width,$height);",
            null,
        )
    }

    fun destroy() {
        webView?.destroy()
        webView = null
    }

    private fun loadAsset(filename: String): String? {
        return try {
            val inputStream = context.assets.open(filename)
            val reader = BufferedReader(InputStreamReader(inputStream))
            reader.readText().also { reader.close() }
        } catch (_: Exception) {
            null
        }
    }

    // -- JS Bridge --

    inner class GlyphBridge {
        @JavascriptInterface
        fun submitRenderCommands(json: String) {
            try {
                val array = JSONArray(json)
                val commands = mutableListOf<JSONObject>()
                for (i in 0 until array.length()) {
                    commands.add(array.getJSONObject(i))
                }
                handler.post {
                    renderView.setRenderCommands(commands)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun measureText(text: String, fontSize: Double, fontFamily: String, fontWeight: String): String {
            val typeface = when (fontWeight) {
                "bold", "700" -> Typeface.DEFAULT_BOLD
                else -> Typeface.DEFAULT
            }
            val paint = Paint().apply {
                textSize = fontSize.toFloat()
                this.typeface = typeface
            }
            val width = paint.measureText(text)
            val metrics = paint.fontMetrics
            val height = metrics.descent - metrics.ascent
            return """{"width":$width,"height":$height}"""
        }

        @JavascriptInterface
        fun getViewportSize(): String {
            val w = renderView.width.toFloat()
            val h = renderView.height.toFloat()
            return """{"width":$w,"height":$h}"""
        }
    }
}
