package com.ridgeline.android.core

import com.ridgeline.android.models.Track
import com.ridgeline.android.models.TrackPoint
import java.text.DecimalFormat
import java.util.Locale

object GuidanceStatus {

    private val oneDecimal = DecimalFormat("0.0")
    private val zeroDecimal = DecimalFormat("0")

    fun nextPoint(track: Track, progress: Double?): TrackPoint? {
        val sorted = track.segments.flatten().sortedBy { it.distance }
        if (sorted.isEmpty()) return null
        val cutoff = if (progress != null) progress + 0.0001 else null
        return if (cutoff != null) sorted.firstOrNull { it.distance > cutoff } else sorted.last()
    }

    fun format(result: GuidanceResult, track: Track): String {
        val line1 = when (result.state) {
            GuidanceState.ON_ROUTE -> "沿路线行进"
            GuidanceState.OFF_ROUTE -> "已偏航"
            GuidanceState.PENDING -> "可能偏航，正在确认"
            GuidanceState.UNCERTAIN -> "定位不可用或不确定"
        }

        val match = result.match
        val distanceText = match?.distance?.let { "距路线 " + formatMeters(it) } ?: "未匹配到路线"
        val progressText = if (match != null) " 行点距离 " + formatMeters(match.progress) else " 行点未匹配"
        val alertText = if (result.alert) "\n偏航提醒已触发" else ""
        val reasonText = result.reason?.let { "\n原因：$it" } ?: ""
        val next = nextPoint(track, match?.progress)

        return """
            $line1
            $distanceText$progressText$alertText$reasonText
            下一参考点：${next?.let { formatLatLon(it) } ?: "未匹配"}
        """.trimIndent()
    }

    fun formatLatLon(point: TrackPoint): String = "${String.format(Locale.US, "%.2f", point.lat)}, ${String.format(Locale.US, "%.2f", point.lon)}"

    private fun formatMeters(meters: Double): String {
        return if (meters >= 1000) String.format(Locale.US, "%.1f km", meters / 1000.0)
        else if (meters >= 100) zeroDecimal.format(meters) + " m"
        else oneDecimal.format(meters) + " m"
    }
}
