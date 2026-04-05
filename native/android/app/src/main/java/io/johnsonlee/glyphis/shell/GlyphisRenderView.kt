package io.johnsonlee.glyphis.shell

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.View
import org.json.JSONObject

/**
 * Custom View that renders Glyphis framework render commands using Android Canvas.
 * Receives a list of JSON render command objects from the JS runtime and
 * draws them in [onDraw] using the Canvas 2D API.
 */
class GlyphisRenderView(context: Context) : View(context) {

    private val density: Float = context.resources.displayMetrics.density
    private var renderCommands: List<JSONObject> = emptyList()

    /** Cache of loaded images keyed by imageId (typically the URL). */
    val imageCache = mutableMapOf<String, Bitmap>()

    /** Called by [GlyphisRuntime] when a touch event occurs. Parameters: (eventType, x, y) */
    var onTouch: ((type: String, x: Float, y: Float) -> Unit)? = null

    fun setRenderCommands(commands: List<JSONObject>) {
        this.renderCommands = commands
        postInvalidate()
    }

    // -- Drawing --

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.WHITE)
        canvas.save()
        canvas.scale(density, density)

        for (cmd in renderCommands) {
            when (cmd.optString("type")) {
                "rect" -> drawRect(canvas, cmd)
                "text" -> drawText(canvas, cmd)
                "image" -> drawImage(canvas, cmd)
                "border" -> drawBorder(canvas, cmd)
                "clip-start" -> {
                    canvas.save()
                    val x = cmd.optDouble("x").toFloat()
                    val y = cmd.optDouble("y").toFloat()
                    val w = cmd.optDouble("width").toFloat()
                    val h = cmd.optDouble("height").toFloat()
                    val borderRadius = cmd.optDouble("borderRadius", 0.0).toFloat()
                    if (borderRadius > 0) {
                        val path = Path().apply {
                            addRoundRect(RectF(x, y, x + w, y + h), borderRadius, borderRadius, Path.Direction.CW)
                        }
                        canvas.clipPath(path)
                    } else {
                        canvas.clipRect(x, y, x + w, y + h)
                    }
                }
                "clip-end" -> canvas.restore()
            }
        }

        canvas.restore()
    }

    // -- Command drawers --

    private fun drawRect(canvas: Canvas, cmd: JSONObject) {
        val x = cmd.optDouble("x").toFloat()
        val y = cmd.optDouble("y").toFloat()
        val w = cmd.optDouble("width").toFloat()
        val h = cmd.optDouble("height").toFloat()
        val colorStr = cmd.optString("color", "")
        if (colorStr.isEmpty()) return

        val opacity = cmd.optDouble("opacity", 1.0)
        val needsLayer = opacity < 1.0
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (opacity * 255).toInt())
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = parseColor(colorStr)
            style = Paint.Style.FILL
        }

        val borderRadius = cmd.optDouble("borderRadius", 0.0).toFloat()
        if (borderRadius > 0) {
            canvas.drawRoundRect(x, y, x + w, y + h, borderRadius, borderRadius, paint)
        } else {
            canvas.drawRect(x, y, x + w, y + h, paint)
        }

        if (needsLayer) canvas.restore()
    }

    private fun drawText(canvas: Canvas, cmd: JSONObject) {
        val x = cmd.optDouble("x").toFloat()
        val y = cmd.optDouble("y").toFloat()
        val text = cmd.optString("text", "")
        val colorStr = cmd.optString("color", "")
        if (colorStr.isEmpty() || text.isEmpty()) return
        val fontSize = cmd.optDouble("fontSize").toFloat()

        val maxWidth = cmd.optDouble("maxWidth", Double.MAX_VALUE).toFloat()

        val opacity = cmd.optDouble("opacity", 1.0)
        val needsLayer = opacity < 1.0
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (opacity * 255).toInt())
        }

        val fontWeight = cmd.optString("fontWeight", "normal")
        val textAlign = cmd.optString("textAlign", "left")
        val lineHeight = fontSize * 1.2f

        val typeface = when (fontWeight) {
            "bold", "700" -> Typeface.DEFAULT_BOLD
            else -> Typeface.DEFAULT
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = parseColor(colorStr)
            textSize = fontSize
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
            if (paint.measureText(testLine) > maxWidth && currentLine.isNotEmpty()) {
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
                "center" -> x + maxWidth / 2
                "right" -> x + maxWidth
                else -> x
            }
            // Center vertically in line height
            val drawY = y + i * lineHeight + lineHeight / 2 - (metrics.ascent + metrics.descent) / 2
            canvas.drawText(lines[i], drawX, drawY, paint)
        }

        if (needsLayer) canvas.restore()
    }

    private fun drawBorder(canvas: Canvas, cmd: JSONObject) {
        val x = cmd.optDouble("x").toFloat()
        val y = cmd.optDouble("y").toFloat()
        val w = cmd.optDouble("width").toFloat()
        val h = cmd.optDouble("height").toFloat()
        val colorStr = cmd.optString("color", "")
        if (colorStr.isEmpty()) return

        val widths = cmd.optJSONArray("widths") ?: return
        if (widths.length() != 4) return
        val tw = widths.optDouble(0).toFloat()
        val rw = widths.optDouble(1).toFloat()
        val bw = widths.optDouble(2).toFloat()
        val lw = widths.optDouble(3).toFloat()

        val opacity = cmd.optDouble("opacity", 1.0)
        val needsLayer = opacity < 1.0
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (opacity * 255).toInt())
        }

        val borderColor = parseColor(colorStr)

        fun drawLine(x1: Float, y1: Float, x2: Float, y2: Float, strokeWidth: Float) {
            if (strokeWidth <= 0) return
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = borderColor
                this.strokeWidth = strokeWidth
                style = Paint.Style.STROKE
            }
            canvas.drawLine(x1, y1, x2, y2, paint)
        }

        val borderRadius = cmd.optDouble("borderRadius", 0.0).toFloat()
        if (borderRadius > 0) {
            // For rounded borders, draw as a single stroked round rect using the max border width
            val maxWidth = maxOf(tw, rw, bw, lw)
            if (maxWidth > 0) {
                val half = maxWidth / 2
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = borderColor
                    this.strokeWidth = maxWidth
                    style = Paint.Style.STROKE
                }
                canvas.drawRoundRect(
                    x + half, y + half, x + w - half, y + h - half,
                    borderRadius, borderRadius, paint
                )
            }
        } else {
            // Top
            drawLine(x, y + tw / 2, x + w, y + tw / 2, tw)
            // Right
            drawLine(x + w - rw / 2, y, x + w - rw / 2, y + h, rw)
            // Bottom
            drawLine(x, y + h - bw / 2, x + w, y + h - bw / 2, bw)
            // Left
            drawLine(x + lw / 2, y, x + lw / 2, y + h, lw)
        }

        if (needsLayer) canvas.restore()
    }

    private fun drawImage(canvas: Canvas, cmd: JSONObject) {
        val imageId = cmd.optString("imageId", "")
        val bitmap = imageCache[imageId] ?: return
        val x = cmd.optDouble("x").toFloat()
        val y = cmd.optDouble("y").toFloat()
        val w = cmd.optDouble("width").toFloat()
        val h = cmd.optDouble("height").toFloat()
        val resizeMode = cmd.optString("resizeMode", "cover")
        val opacity = cmd.optDouble("opacity", 1.0)

        val needsLayer = opacity < 1.0
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (opacity * 255).toInt())
        }

        // borderRadius clipping
        val borderRadius = cmd.optDouble("borderRadius", 0.0).toFloat()
        val hasRadius = borderRadius > 0
        if (hasRadius) {
            canvas.save()
            val clipPath = Path().apply {
                addRoundRect(RectF(x, y, x + w, y + h), borderRadius, borderRadius, Path.Direction.CW)
            }
            canvas.clipPath(clipPath)
        }

        val imgW = bitmap.width.toFloat()
        val imgH = bitmap.height.toFloat()
        val srcRect = Rect(0, 0, bitmap.width, bitmap.height)
        val destRect: RectF

        when (resizeMode) {
            "stretch" -> {
                destRect = RectF(x, y, x + w, y + h)
            }
            "contain" -> {
                val scale = minOf(w / imgW, h / imgH)
                val dw = imgW * scale
                val dh = imgH * scale
                destRect = RectF(x + (w - dw) / 2, y + (h - dh) / 2,
                                 x + (w + dw) / 2, y + (h + dh) / 2)
            }
            else -> { // "cover"
                val scale = maxOf(w / imgW, h / imgH)
                val dw = imgW * scale
                val dh = imgH * scale
                destRect = RectF(x + (w - dw) / 2, y + (h - dh) / 2,
                                 x + (w + dw) / 2, y + (h + dh) / 2)
            }
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(bitmap, srcRect, destRect, paint)

        if (hasRadius) canvas.restore()
        if (needsLayer) canvas.restore()
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

        // 3-char hex shorthand (#FFF -> #FFFFFF)
        if (h.length == 3) {
            h = "${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}"
        }

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
                onTouch?.invoke("pointerdown", event.x / density, event.y / density)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                onTouch?.invoke("pointermove", event.x / density, event.y / density)
                return true
            }
            MotionEvent.ACTION_UP -> {
                onTouch?.invoke("pointerup", event.x / density, event.y / density)
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                onTouch?.invoke("pointerup", event.x / density, event.y / density)
                return true
            }
        }
        return super.onTouchEvent(event)
    }
}
