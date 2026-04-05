package io.johnsonlee.glyphis.shell

import android.app.Activity
import android.os.Bundle
import android.view.Window
import android.view.WindowManager
import android.widget.FrameLayout

class GlyphisActivity : Activity() {
    private lateinit var renderView: GlyphisRenderView
    private lateinit var runtime: GlyphisRuntime

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        val container = FrameLayout(this)
        renderView = GlyphisRenderView(this)
        container.addView(renderView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        setContentView(container)

        runtime = GlyphisRuntime(this, renderView, container)

        // Defer loadBundle until the view is laid out so getViewportSize()
        // returns real dimensions instead of 0x0.
        renderView.viewTreeObserver.addOnGlobalLayoutListener(object :
            android.view.ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                renderView.viewTreeObserver.removeOnGlobalLayoutListener(this)
                runtime.loadBundle()
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        runtime.destroy()
    }
}
