package com.ridgeline.android.core

import com.ridgeline.android.models.LocationFix
import com.ridgeline.android.models.Track
import com.ridgeline.android.models.TrackPoint
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

data class Match(
    val distance: Double,
    val progress: Double,
    val segment: Int,
    val point: TrackPoint,
    val requiresReanchor: Boolean = false,
)

enum class GuidanceState { ON_ROUTE, PENDING, OFF_ROUTE, UNCERTAIN }

class Guidance {
    var state: GuidanceState = GuidanceState.UNCERTAIN
        private set
    var progress: Double? = null
        private set
    var segment: Int? = null
        private set

    private var outsideAt: Long? = null
    private var insideAt: Long? = null
    private var lastTimestamp = 0L
    private var off = false

    fun reset(progress: Double? = null, segment: Int? = null) {
        this.progress = progress
        this.segment = segment
        this.outsideAt = null
        this.insideAt = null
        this.lastTimestamp = 0L
        this.off = false
        this.state = GuidanceState.UNCERTAIN
    }

    fun update(track: Track, fix: LocationFix, now: Long = System.currentTimeMillis()): GuidanceResult {
        if (fix.accuracy !in 0.0..35.0 || fix.lat !in -90.0..90.0 || fix.lon !in -180.0..180.0 ||
            now < fix.timestamp - 1000 || now > fix.timestamp + 10_000 ||
            fix.timestamp <= lastTimestamp ||
            !fix.accuracy.isFinite()
        ) {
            outsideAt = null
            insideAt = null
            state = GuidanceState.UNCERTAIN
            return GuidanceResult(state, null, alert = false)
        }

        if (lastTimestamp != 0L && fix.timestamp - lastTimestamp > 5_000L) {
            outsideAt = null
            insideAt = null
        }
        lastTimestamp = fix.timestamp

        val match = matchRoute(track, fix, progress, 400.0, segment)
        if (match.requiresReanchor) {
            outsideAt = null
            insideAt = null
            state = GuidanceState.UNCERTAIN
            return GuidanceResult(state, match, alert = false, reason = "reanchor")
        }

        if (match.distance < 200.0) progress = match.progress
        val enterThreshold = max(40.0, fix.accuracy * 2.0)
        var alert = false

        when {
            match.distance > enterThreshold -> {
                insideAt = null
                outsideAt = outsideAt ?: fix.timestamp
                if (!off && fix.timestamp - (outsideAt ?: 0L) >= 5_000L) {
                    off = true
                    alert = true
                }
                state = if (off) GuidanceState.OFF_ROUTE else GuidanceState.PENDING
            }
            match.distance < 20.0 -> {
                outsideAt = null
                insideAt = insideAt ?: fix.timestamp
                if (off && fix.timestamp - (insideAt ?: 0L) >= 3_000L) off = false
                state = if (off) GuidanceState.OFF_ROUTE else GuidanceState.ON_ROUTE
                if (!off) progress = match.progress
            }
            else -> {
                outsideAt = null
                insideAt = null
                state = if (off) GuidanceState.OFF_ROUTE else GuidanceState.ON_ROUTE
            }
        }

        return GuidanceResult(state, match, alert)
    }

    fun matchRoute(track: Track, fix: LocationFix, previous: Double? = null, window: Double = 400.0, activeSegment: Int? = null): Match {
        var nearest: Match? = null
        var global: Match? = null

        for (segment in track.segments) {
            for (i in segment.indices) {
                val a = segment[max(0, i - 1)]
                val b = segment[i]
                val ax = localXY(a, fix).first
                val ay = localXY(a, fix).second
                val bx = localXY(b, fix).first
                val by = localXY(b, fix).second
                val dx = bx - ax
                val dy = by - ay
                val t = if (dx * dx + dy * dy == 0.0) 0.0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
                val d = sqrt((ax + t * dx) * (ax + t * dx) + (ay + t * dy) * (ay + t * dy))
                val progress = a.distance + (b.distance - a.distance) * t
                val candidate = Match(distance = d, progress = progress, segment = a.segment, point = if (t < 0.5) a else b)

                if (global == null || d < global.distance) global = candidate
                if ((activeSegment == null || a.segment == activeSegment) && (previous == null || abs(progress - previous) <= window) && (nearest == null || d < nearest.distance)) {
                    nearest = candidate
                }
            }
        }

        val globalMatch = global ?: return nearest ?: Match(0.0, 0.0, 0, track.segments.first().first(), false)
        if (((previous != null && abs(globalMatch.progress - previous) > window) || (activeSegment != null && globalMatch.segment != activeSegment)) &&
            (nearest == null || nearest.distance > globalMatch.distance + 100.0)
        ) {
            return globalMatch.copy(requiresReanchor = true)
        }

        return nearest ?: globalMatch
    }

    fun localXY(point: TrackPoint, fix: LocationFix): Pair<Double, Double> {
        // Mean Earth radius in metres, matching the desktop geo.ts localXY.
        val earthRadius = 6371008.8
        val lat0 = Math.toRadians(fix.lat)
        val lat = Math.toRadians(point.lat)
        val lon = Math.toRadians(point.lon - fix.lon)
        val x = lon * earthRadius * cos(lat0)
        val y = (lat - lat0) * earthRadius
        return Pair(x, y)
    }
}

data class GuidanceResult(
    val state: GuidanceState,
    val match: Match?,
    val alert: Boolean,
    val reason: String? = null,
)
