package com.ridgeline.android.core

import com.ridgeline.android.models.Track
import java.text.DecimalFormat
import java.util.Locale

object RouteSummary {

    private val oneDecimal = DecimalFormat("0.0")
    private val zeroDecimal = DecimalFormat("0")

    fun format(track: Track): String {
        val stats = track.stats
        val ascent = stats.ascent?.let { " +${formatMeters(it)}" } ?: ""
        val descent = stats.descent?.let { " -${formatMeters(it)}" } ?: ""
        val elevation = when {
            stats.min != null && stats.max != null -> " ${formatMeters(stats.min)}–${formatMeters(stats.max)}"
            stats.elevationCount > 0 -> " ${stats.elevationCount} 个高程点"
            else -> " 未提供"
        }
        val kind = if (track.kind.name == "TRACK") "轨迹" else "路线"
        val warning = track.warnings.joinToString(separator = "；").ifEmpty { "无警告" }

        return """
            ${track.name}
            $kind · ${formatInt(stats.count)} 点 · ${formatDistance(stats.distance)}${ascent}${descent}
            海拔范围：$elevation
            警告：$warning
        """.trimIndent()
    }

    fun formatDistance(meters: Double): String = when {
        meters >= 1_000 -> String.format(Locale.US, "%.1f km", meters / 1000.0)
        meters >= 100 -> zeroDecimal.format(meters) + " m"
        else -> oneDecimal.format(meters) + " m"
    }

    fun formatMeters(meters: Double): String = if (meters >= 100) zeroDecimal.format(meters) + " m" else oneDecimal.format(meters) + " m"

    private fun formatInt(value: Int): String = String.format(Locale.US, "%,d", value)
}
