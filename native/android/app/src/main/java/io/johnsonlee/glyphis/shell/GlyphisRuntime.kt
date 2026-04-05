package io.johnsonlee.glyphis.shell

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL


/**
 * JS runtime for the Glyphis framework on Android.
 *
 * Uses JavaScriptCore (via jsc-android) through a thin C/JNI bridge -- the
 * same engine used on iOS.  The bridge exposes native functions
 * (`submitRenderCommands`, `measureText`, `getViewportSize`, timers) to JS
 * and forwards render commands to [GlyphisRenderView].
 */
class GlyphisRuntime(
    private val context: Context,
    private val renderView: GlyphisRenderView,
) {
    private val density: Float = context.resources.displayMetrics.density
    private val handler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "GlyphisJSC"

        init {
            System.loadLibrary("jsc")
            System.loadLibrary("glyphis_jsc")
        }
    }

    init {
        nativeInit()
        setupTouchBridge()
    }

    fun loadBundle() {
        val bundleJS = loadAsset("bundle.js")
        if (bundleJS == null) {
            Log.e(TAG, "bundle.js not found in assets")
            return
        }
        nativeEvaluateScript(bundleJS)
    }

    fun updateViewportSize(width: Float, height: Float) {
        nativeEvaluateScript(
            "if(typeof __glyphis_updateViewport==='function')__glyphis_updateViewport($width,$height);"
        )
    }

    fun destroy() {
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

    // -- Callbacks from C/JNI --

    /** Called from JNI when JS invokes `__glyphis_native.submitRenderCommands(json)`. */
    @Suppress("unused") // called from native code
    fun onRenderCommands(json: String) {
        val array = JSONArray(json)
        val commands = mutableListOf<JSONObject>()
        for (i in 0 until array.length()) {
            commands.add(array.getJSONObject(i))
        }
        handler.post {
            renderView.setRenderCommands(commands)
        }
    }

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
        Thread {
            try {
                val stream = URL(url).openStream()
                val bitmap = BitmapFactory.decodeStream(stream)
                stream.close()
                if (bitmap != null) {
                    handler.post {
                        renderView.imageCache[imageId] = bitmap
                        val safeId = imageId.replace("\\", "\\\\").replace("'", "\\'")
                        nativeEvaluateScript(
                            "if(typeof __glyphis_onImageLoaded==='function')__glyphis_onImageLoaded('$safeId',${bitmap.width.toDouble() / density},${bitmap.height.toDouble() / density})"
                        )
                    }
                }
            } catch (_: Exception) {
                Log.w(TAG, "Failed to load image: $url")
            }
        }.start()
    }

    /** Called from JNI when JS invokes `__glyphis_native.scheduleTimer(id, delayMs)`. */
    @Suppress("unused") // called from native code
    fun onScheduleTimer(timerId: Int, delayMs: Double) {
        handler.postDelayed({
            nativeFireTimer(timerId)
        }, delayMs.toLong())
    }

    // -- Asset loading --

    private fun loadAsset(filename: String): String? {
        return try {
            context.assets.open(filename).bufferedReader().readText()
        } catch (_: Exception) {
            null
        }
    }

    // -- Native methods (implemented in jsc_bridge.c) --

    private external fun nativeInit()
    private external fun nativeEvaluateScript(script: String)
    private external fun nativeDestroy()
    private external fun nativeHandleTouch(type: String, x: Double, y: Double)
    private external fun nativeFireTimer(timerId: Int)
}
