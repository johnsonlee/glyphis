package com.glyph.shell

import android.app.Activity
import android.os.Bundle
import android.view.Window
import android.view.WindowManager

class GlyphActivity : Activity() {
    private lateinit var renderView: GlyphRenderView
    private lateinit var runtime: GlyphRuntime

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        renderView = GlyphRenderView(this)
        setContentView(renderView)

        runtime = GlyphRuntime(this, renderView)
        runtime.loadBundle()
    }

    override fun onDestroy() {
        super.onDestroy()
        runtime.destroy()
    }
}
