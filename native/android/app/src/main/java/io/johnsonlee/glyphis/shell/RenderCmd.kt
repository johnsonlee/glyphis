package io.johnsonlee.glyphis.shell

/**
 * Typed render commands passed directly from C/JNI without JSON serialization.
 * Each variant holds the pre-parsed, pre-typed fields needed for drawing.
 */
sealed class RenderCmd {
    data class Rect(
        val x: Float, val y: Float, val w: Float, val h: Float,
        val color: String,
        val borderRadius: Float,
        val opacity: Float,
    ) : RenderCmd()

    data class Text(
        val x: Float, val y: Float,
        val text: String, val color: String,
        val fontSize: Float,
        val fontWeight: String, val fontFamily: String, val textAlign: String,
        val maxWidth: Float,
        val opacity: Float,
    ) : RenderCmd()

    data class Border(
        val x: Float, val y: Float, val w: Float, val h: Float,
        val color: String,
        val tw: Float, val rw: Float, val bw: Float, val lw: Float,
        val borderRadius: Float,
        val opacity: Float,
    ) : RenderCmd()

    data class ClipStart(
        val id: Int,
        val x: Float, val y: Float, val w: Float, val h: Float,
        val borderRadius: Float,
    ) : RenderCmd()

    data class ClipEnd(val id: Int) : RenderCmd()

    data class Image(
        val imageId: String,
        val x: Float, val y: Float, val w: Float, val h: Float,
        val resizeMode: String,
        val opacity: Float,
        val borderRadius: Float,
    ) : RenderCmd()
}
