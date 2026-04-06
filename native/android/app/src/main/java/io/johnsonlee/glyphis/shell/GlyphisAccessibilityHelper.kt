package io.johnsonlee.glyphis.shell

import android.graphics.Rect
import android.os.Bundle
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import androidx.customview.widget.ExploreByTouchHelper

class GlyphisAccessibilityHelper(
    private val renderView: GlyphisRenderView,
    private val density: Float,
) : ExploreByTouchHelper(renderView) {

    data class SemanticsNode(
        val id: Int,
        val x: Float, val y: Float, val w: Float, val h: Float,
        val label: String,
        val hint: String,
        val role: String,
        val actions: List<String>,
    )

    var nodes: List<SemanticsNode> = emptyList()
    var onAction: ((Int, String) -> Unit)? = null

    override fun getVisibleVirtualViews(virtualViewIds: MutableList<Int>) {
        for (node in nodes) {
            virtualViewIds.add(node.id)
        }
    }

    override fun getVirtualViewAt(x: Float, y: Float): Int {
        val dpX = x / density
        val dpY = y / density
        // Reverse order for hit testing (topmost first)
        for (i in nodes.indices.reversed()) {
            val n = nodes[i]
            if (dpX >= n.x && dpX <= n.x + n.w && dpY >= n.y && dpY <= n.y + n.h) {
                return n.id
            }
        }
        return INVALID_ID
    }

    override fun onPopulateNodeForVirtualView(
        virtualViewId: Int,
        node: AccessibilityNodeInfoCompat,
    ) {
        val sem = nodes.find { it.id == virtualViewId } ?: run {
            node.setBoundsInParent(Rect(0, 0, 1, 1))
            node.contentDescription = ""
            return
        }

        val left = (sem.x * density).toInt()
        val top = (sem.y * density).toInt()
        val right = ((sem.x + sem.w) * density).toInt()
        val bottom = ((sem.y + sem.h) * density).toInt()
        node.setBoundsInParent(Rect(left, top, right, bottom))

        node.contentDescription = sem.label
        if (sem.hint.isNotEmpty()) node.tooltipText = sem.hint

        // Map role to className
        when (sem.role) {
            "button" -> node.className = "android.widget.Button"
            "image" -> node.className = "android.widget.ImageView"
            "text" -> node.className = "android.widget.TextView"
            "checkbox" -> node.className = "android.widget.CheckBox"
            "switch" -> node.className = "android.widget.Switch"
            else -> node.className = "android.view.View"
        }

        if (sem.actions.contains("activate")) {
            node.addAction(AccessibilityNodeInfoCompat.AccessibilityActionCompat.ACTION_CLICK)
            node.isClickable = true
        }
    }

    override fun onPerformActionForVirtualView(
        virtualViewId: Int,
        action: Int,
        arguments: Bundle?,
    ): Boolean {
        if (action == AccessibilityNodeInfoCompat.ACTION_CLICK) {
            onAction?.invoke(virtualViewId, "activate")
            return true
        }
        return false
    }
}
