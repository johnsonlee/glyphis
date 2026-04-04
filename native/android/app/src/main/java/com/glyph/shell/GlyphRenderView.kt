package com.glyph.shell

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.View
import org.json.JSONObject

/**
 * Custom View that renders Glyph framework render commands using Android Canvas.
 * Receives a JSON-derived list of render commands from the JS runtime and
 * draws them in [onDraw] using the Canvas 2D API.
 *
 * This mirrors the iOS GlyphRenderView which uses Core Graphics for the same
 * render command protocol.
 */
class GlyphRenderView(context: Context) : View(context) {

    private var renderCommands: List<JSONObject> = emptyList()

    /** Called by [GlyphRuntime] when a touch event occurs. Parameters: (eventType, x, y) */
    var onTouch: ((type: String, x: Float, y: Float) -> Unit)? = null

    fun setRenderCommands(commands: List<JSONObject>) {
        this.renderCommands = commands
        postInvalidate()
    }

    // -- Drawing --

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.WHITE)

        for (cmd in renderCommands) {
            when (cmd.optString("type")) {
                "rect" -> drawRect(canvas, cmd)
                "text" -> drawText(canvas, cmd)
                "border" -> drawBorder(canvas, cmd)
                "clip" -> {
                    canvas.save()
                    val x = cmd.optDouble("x").toFloat()
                    val y = cmd.optDouble("y").toFloat()
                    val w = cmd.optDouble("width").toFloat()
                    val h = cmd.optDouble("height").toFloat()
                    canvas.clipRect(x, y, x + w, y + h)
                }
                "restore" -> canvas.restore()
                "opacity" -> {
                    canvas.save()
                    val alpha = (cmd.optDouble("opacity") * 255).toInt()
                    canvas.saveLayerAlpha(null, alpha)
                }
                "restoreOpacity" -> {
                    canvas.restore()
                    canvas.restore()
                }
            }
        }
    }

    private fun drawRect(canvas: Canvas, cmd: JSONObject) {
        val x = cmd.optDouble("x").toFloat()
        val y = cmd.optDouble("y").toFloat()
        val w = cmd.optDouble("width").toFloat()
        val h = cmd.optDouble("height").toFloat()
        val color = parseColor(cmd.optString("color", "#000000"))

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.FILL
        }

        val borderRadius = cmd.opt("borderRadius")
        if (borderRadius is Number && borderRadius.toFloat() > 0) {
            val r = borderRadius.toFloat()
            canvas.drawRoundRect(x, y, x + w, y + h, r, r, paint)
        } else {
            canvas.drawRect(x, y, x + w, y + h, paint)
        }
    }

    private fun drawText(canvas: Canvas, cmd: JSONObject) {
        val x = cmd.optDouble("x").toFloat()
        val y = cmd.optDouble("y").toFloat()
        val w = cmd.optDouble("width").toFloat()
        val text = cmd.optString("text", "")
        val color = parseColor(cmd.optString("color", "#000000"))
        val fontSize = cmd.optDouble("fontSize", 14.0).toFloat()
        val fontWeight = cmd.optString("fontWeight", "normal")
        val textAlign = cmd.optString("textAlign", "left")
        val lineHeight = cmd.optDouble("lineHeight", (fontSize * 1.2).toDouble()).toFloat()

        val typeface = when (fontWeight) {
            "bold", "700" -> Typeface.DEFAULT_BOLD
            else -> Typeface.DEFAULT
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            this.textSize = fontSize
            this.typeface = typeface
            this.textAlign = when (textAlign) {
                "center" -> Paint.Align.CENTER
                "right" -> Paint.Align.RIGHT
                else -> Paint.Align.LEFT
            }
        }

        // Word wrapping
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var currentLine = ""

        for (word in words) {
            val testLine = if (currentLine.isEmpty()) word else "$currentLine $word"
            if (paint.measureText(testLine) > w && currentLine.isNotEmpty()) {
                lines.add(currentLine)
                currentLine = word
            } else {
                currentLine = testLine
            }
        }
        if (currentLine.isNotEmpty()) lines.add(currentLine)

        val metrics = paint.fontMetrics

        for (i in lines.indices) {
            val drawX = when (textAlign) {
                "center" -> x + w / 2
                "right" -> x + w
                else -> x
            }
            // Center vertically in line height
            val drawY = y + i * lineHeight + lineHeight / 2 - (metrics.ascent + metrics.descent) / 2
            canvas.drawText(lines[i], drawX, drawY, paint)
        }
    }

    private fun drawBorder(canvas: Canvas, cmd: JSONObject) {
        val x = cmd.optDouble("x").toFloat()
        val y = cmd.optDouble("y").toFloat()
        val w = cmd.optDouble("width").toFloat()
        val h = cmd.optDouble("height").toFloat()
        val widths = cmd.optJSONArray("widths") ?: return
        val colors = cmd.optJSONArray("colors") ?: return

        fun drawLine(x1: Float, y1: Float, x2: Float, y2: Float, width: Float, color: Int) {
            if (width <= 0) return
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                this.color = color
                this.strokeWidth = width
                style = Paint.Style.STROKE
            }
            canvas.drawLine(x1, y1, x2, y2, paint)
        }

        val tw = widths.optDouble(0).toFloat()
        val rw = widths.optDouble(1).toFloat()
        val bw = widths.optDouble(2).toFloat()
        val lw = widths.optDouble(3).toFloat()

        // Top
        drawLine(x, y + tw / 2, x + w, y + tw / 2, tw, parseColor(colors.optString(0)))
        // Right
        drawLine(x + w - rw / 2, y, x + w - rw / 2, y + h, rw, parseColor(colors.optString(1)))
        // Bottom
        drawLine(x, y + h - bw / 2, x + w, y + h - bw / 2, bw, parseColor(colors.optString(2)))
        // Left
        drawLine(x + lw / 2, y, x + lw / 2, y + h, lw, parseColor(colors.optString(3)))
    }

    // -- Color Parsing --

    private fun parseColor(hex: String): Int {
        var h = hex.trim()

        // Handle rgba() format
        if (h.startsWith("rgba(")) {
            val parts = h.removePrefix("rgba(").removeSuffix(")").split(",").map { it.trim() }
            if (parts.size == 4) {
                val r = parts[0].toIntOrNull() ?: 0
                val g = parts[1].toIntOrNull() ?: 0
                val b = parts[2].toIntOrNull() ?: 0
                val a = (parts[3].toFloatOrNull() ?: 1f)
                return Color.argb((a * 255).toInt(), r, g, b)
            }
        }

        // Handle rgb() format
        if (h.startsWith("rgb(")) {
            val parts = h.removePrefix("rgb(").removeSuffix(")").split(",").map { it.trim() }
            if (parts.size == 3) {
                val r = parts[0].toIntOrNull() ?: 0
                val g = parts[1].toIntOrNull() ?: 0
                val b = parts[2].toIntOrNull() ?: 0
                return Color.argb(255, r, g, b)
            }
        }

        // Handle "transparent"
        if (h == "transparent") {
            return Color.TRANSPARENT
        }

        // Handle hex
        if (h.startsWith("#")) h = h.substring(1)
        return try {
            Color.parseColor("#$h")
        } catch (_: Exception) {
            Color.BLACK
        }
    }

    // -- Touch Handling --

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                onTouch?.invoke("pressIn", event.x, event.y)
                return true
            }
            MotionEvent.ACTION_UP -> {
                onTouch?.invoke("pressOut", event.x, event.y)
                onTouch?.invoke("press", event.x, event.y)
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                onTouch?.invoke("pressOut", event.x, event.y)
                return true
            }
        }
        return super.onTouchEvent(event)
    }
}
