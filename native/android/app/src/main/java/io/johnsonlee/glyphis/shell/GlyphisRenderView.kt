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
import androidx.core.view.ViewCompat

/**
 * Custom View that renders Glyphis framework render commands using Android Canvas.
 * Receives typed [RenderCmd] objects from the JS runtime (via C/JNI, no JSON)
 * and draws them in [onDraw] using the Canvas 2D API.
 */
class GlyphisRenderView(context: Context) : View(context) {

    private val density: Float = context.resources.displayMetrics.density
    private var renderCommands: List<RenderCmd> = emptyList()

    /** Lookup function for decoded bitmaps by imageId. Set by [GlyphisRuntime]. */
    var imageLookup: ((String) -> Bitmap?)? = null

    /** Called by [GlyphisRuntime] when a touch event occurs. Parameters: (eventType, x, y) */
    var onTouch: ((type: String, x: Float, y: Float) -> Unit)? = null

    // -- Accessibility --

    val accessibilityHelper = GlyphisAccessibilityHelper(this, density)

    init {
        ViewCompat.setAccessibilityDelegate(this, accessibilityHelper)
    }

    fun updateAccessibilityTree(nodes: List<GlyphisAccessibilityHelper.SemanticsNode>) {
        accessibilityHelper.nodes = nodes
        accessibilityHelper.invalidateRoot()
    }

    fun setRenderCommands(commands: List<RenderCmd>) {
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
            when (cmd) {
                is RenderCmd.Rect -> drawRect(canvas, cmd)
                is RenderCmd.Text -> drawText(canvas, cmd)
                is RenderCmd.Image -> drawImage(canvas, cmd)
                is RenderCmd.Border -> drawBorder(canvas, cmd)
                is RenderCmd.ClipStart -> {
                    canvas.save()
                    if (cmd.borderRadius > 0) {
                        val path = Path().apply {
                            addRoundRect(
                                RectF(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h),
                                cmd.borderRadius, cmd.borderRadius, Path.Direction.CW
                            )
                        }
                        canvas.clipPath(path)
                    } else {
                        canvas.clipRect(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h)
                    }
                }
                is RenderCmd.ClipEnd -> canvas.restore()
            }
        }

        canvas.restore()
    }

    // -- Command drawers --

    private fun drawRect(canvas: Canvas, cmd: RenderCmd.Rect) {
        if (cmd.color.isEmpty()) return

        val needsLayer = cmd.opacity < 1.0f
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (cmd.opacity * 255).toInt())
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = parseColor(cmd.color)
            style = Paint.Style.FILL
        }

        if (cmd.borderRadius > 0) {
            canvas.drawRoundRect(
                cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h,
                cmd.borderRadius, cmd.borderRadius, paint
            )
        } else {
            canvas.drawRect(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h, paint)
        }

        if (needsLayer) canvas.restore()
    }

    private fun drawText(canvas: Canvas, cmd: RenderCmd.Text) {
        if (cmd.color.isEmpty() || cmd.text.isEmpty()) return

        val needsLayer = cmd.opacity < 1.0f
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (cmd.opacity * 255).toInt())
        }

        val fontWeight = cmd.fontWeight
        val textAlign = cmd.textAlign
        val lineHeight = cmd.fontSize * 1.2f

        val typeface = when (fontWeight) {
            "bold", "700" -> Typeface.DEFAULT_BOLD
            else -> Typeface.DEFAULT
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = parseColor(cmd.color)
            textSize = cmd.fontSize
            this.typeface = typeface
            this.textAlign = when (textAlign) {
                "center" -> Paint.Align.CENTER
                "right" -> Paint.Align.RIGHT
                else -> Paint.Align.LEFT
            }
        }

        val maxWidth = cmd.maxWidth

        // Word wrapping
        val words = cmd.text.split(" ")
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
                "center" -> cmd.x + maxWidth / 2
                "right" -> cmd.x + maxWidth
                else -> cmd.x
            }
            // Center vertically in line height
            val drawY = cmd.y + i * lineHeight + lineHeight / 2 - (metrics.ascent + metrics.descent) / 2
            canvas.drawText(lines[i], drawX, drawY, paint)
        }

        if (needsLayer) canvas.restore()
    }

    private fun drawBorder(canvas: Canvas, cmd: RenderCmd.Border) {
        if (cmd.color.isEmpty()) return

        val needsLayer = cmd.opacity < 1.0f
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (cmd.opacity * 255).toInt())
        }

        val borderColor = parseColor(cmd.color)

        fun drawLine(x1: Float, y1: Float, x2: Float, y2: Float, strokeWidth: Float) {
            if (strokeWidth <= 0) return
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = borderColor
                this.strokeWidth = strokeWidth
                style = Paint.Style.STROKE
            }
            canvas.drawLine(x1, y1, x2, y2, paint)
        }

        if (cmd.borderRadius > 0) {
            val maxWidth = maxOf(cmd.tw, cmd.rw, cmd.bw, cmd.lw)
            if (maxWidth > 0) {
                val half = maxWidth / 2
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = borderColor
                    this.strokeWidth = maxWidth
                    style = Paint.Style.STROKE
                }
                canvas.drawRoundRect(
                    cmd.x + half, cmd.y + half, cmd.x + cmd.w - half, cmd.y + cmd.h - half,
                    cmd.borderRadius, cmd.borderRadius, paint
                )
            }
        } else {
            drawLine(cmd.x, cmd.y + cmd.tw / 2, cmd.x + cmd.w, cmd.y + cmd.tw / 2, cmd.tw)
            drawLine(cmd.x + cmd.w - cmd.rw / 2, cmd.y, cmd.x + cmd.w - cmd.rw / 2, cmd.y + cmd.h, cmd.rw)
            drawLine(cmd.x, cmd.y + cmd.h - cmd.bw / 2, cmd.x + cmd.w, cmd.y + cmd.h - cmd.bw / 2, cmd.bw)
            drawLine(cmd.x + cmd.lw / 2, cmd.y, cmd.x + cmd.lw / 2, cmd.y + cmd.h, cmd.lw)
        }

        if (needsLayer) canvas.restore()
    }

    private fun drawImage(canvas: Canvas, cmd: RenderCmd.Image) {
        val bitmap = imageLookup?.invoke(cmd.imageId) ?: return

        val needsLayer = cmd.opacity < 1.0f
        if (needsLayer) {
            canvas.saveLayerAlpha(null, (cmd.opacity * 255).toInt())
        }

        val hasRadius = cmd.borderRadius > 0
        if (hasRadius) {
            canvas.save()
            val clipPath = Path().apply {
                addRoundRect(
                    RectF(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h),
                    cmd.borderRadius, cmd.borderRadius, Path.Direction.CW
                )
            }
            canvas.clipPath(clipPath)
        }

        val imgW = bitmap.width.toFloat()
        val imgH = bitmap.height.toFloat()
        val srcRect = Rect(0, 0, bitmap.width, bitmap.height)
        val destRect: RectF

        when (cmd.resizeMode) {
            "stretch" -> {
                destRect = RectF(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h)
            }
            "contain" -> {
                val scale = minOf(cmd.w / imgW, cmd.h / imgH)
                val dw = imgW * scale
                val dh = imgH * scale
                destRect = RectF(
                    cmd.x + (cmd.w - dw) / 2, cmd.y + (cmd.h - dh) / 2,
                    cmd.x + (cmd.w + dw) / 2, cmd.y + (cmd.h + dh) / 2
                )
            }
            else -> { // "cover"
                val scale = maxOf(cmd.w / imgW, cmd.h / imgH)
                val dw = imgW * scale
                val dh = imgH * scale
                destRect = RectF(
                    cmd.x + (cmd.w - dw) / 2, cmd.y + (cmd.h - dh) / 2,
                    cmd.x + (cmd.w + dw) / 2, cmd.y + (cmd.h + dh) / 2
                )
            }
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(bitmap, srcRect, destRect, paint)

        if (hasRadius) canvas.restore()
        if (needsLayer) canvas.restore()
    }

    // -- Color Parsing (delegated to shared ColorParser) --

    private fun parseColor(hex: String): Int = ColorParser.parse(hex)

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
