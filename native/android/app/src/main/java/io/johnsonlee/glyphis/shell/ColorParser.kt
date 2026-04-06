package io.johnsonlee.glyphis.shell

import android.graphics.Color

/**
 * Shared color parsing utility. Supports hex (#RGB, #RRGGBB), rgb(), rgba(),
 * and the keyword "transparent".
 */
object ColorParser {

    fun parse(hex: String): Int {
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
}
