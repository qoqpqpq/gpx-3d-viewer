package com.ridgeline.android.core

import com.ridgeline.android.models.GeoPoint
import com.ridgeline.android.models.Kind
import com.ridgeline.android.models.Track
import com.ridgeline.android.models.TrackPoint
import com.ridgeline.android.models.TrackStats
import com.ridgeline.android.models.Waypoint
import java.time.Instant

object GpxParser {
    const val MAX_BYTES = 20 * 1024 * 1024
    const val MAX_POINTS = 200_000
    private const val MAX_CANDIDATES = 128
    private const val MAX_SEGMENTS = 1_000

    fun parse(xml: String, filename: String = "路线.gpx"): List<Track> {
        require(xml.toByteArray(Charsets.UTF_8).size <= MAX_BYTES) { "文件超过 20 MB，请先分轨导出。" }
        require(!Regex("<!DOCTYPE|<!ENTITY", RegexOption.IGNORE_CASE).containsMatchIn(xml)) { "不支持包含 DTD 或自定义实体的 XML。" }

        val tokens = tokenize(xml)
        val waypoints = mutableListOf<Waypoint>()
        val tracks = mutableListOf<Track>()

        var trackName = ""
        var routeName = ""
        var currentKind: Kind? = null
        var segments = mutableListOf<List<GeoPoint>>()
        var segment = mutableListOf<GeoPoint>()
        var pointCount = 0
        var pendingPoint: GeoPoint? = null
        var pendingWpt = false
        var pendingWaypointName: String? = null
        var captureWaypointName = false

        fun addPoint(point: GeoPoint) {
            pointCount++
            require(pointCount <= MAX_POINTS) { "轨迹超过 200,000 点，请先分轨导出。" }
            segment.add(point)
        }

        fun finalizePoint() {
            val point = pendingPoint
            if (point != null) {
                if (pendingWpt) {
                    val name = pendingWaypointName.orEmpty().ifEmpty { "未命名航点" }.take(200)
                    waypoints.add(Waypoint(point.lat, point.lon, point.ele, point.time, name))
                } else {
                    addPoint(point)
                }
            }
            pendingPoint = null
            pendingWpt = false
            pendingWaypointName = null
            captureWaypointName = false
        }

        fun flushSegment() {
            if (segment.isNotEmpty()) {
                segments.add(segment.toList())
                segment = mutableListOf()
            }
        }

        fun flushCandidate(kind: Kind) {
            flushSegment()
            if (segments.size > MAX_SEGMENTS) error("轨迹分段超过 1,000 个，请先整理或拆分文件。")
            if (segments.flatten().size < 2) {
                segments.clear()
                return
            }
            if (tracks.size >= MAX_CANDIDATES) error("单个文件最多支持 128 条轨道，请拆分后导入。")
            tracks.add(buildTrack(kind, tracks.size, trackName.ifEmpty { routeName }, filename, segments, waypoints.toList()))
            segments = mutableListOf()
        }

        for (token in tokens) {
            when {
                token.name == "trk" && !token.closing -> {
                    finalizePoint()
                    flushCandidate(currentKind ?: Kind.TRACK)
                    currentKind = Kind.TRACK
                    trackName = ""
                    segments = mutableListOf()
                    segment = mutableListOf()
                }
                token.name == "trk" && token.closing -> {
                    finalizePoint()
                    flushCandidate(Kind.TRACK)
                    currentKind = null
                    trackName = ""
                }
                token.name == "route" && !token.closing -> {
                    finalizePoint()
                    flushCandidate(currentKind ?: Kind.ROUTE)
                    currentKind = Kind.ROUTE
                    routeName = ""
                    segments = mutableListOf()
                    segment = mutableListOf()
                }
                token.name == "route" && token.closing -> {
                    finalizePoint()
                    flushCandidate(Kind.ROUTE)
                    currentKind = null
                    routeName = ""
                }
                token.name == "trkseg" && !token.closing -> {
                    finalizePoint()
                    segment = mutableListOf()
                }
                token.name == "trkseg" && token.closing -> {
                    finalizePoint()
                    flushSegment()
                }
                token.name == "name" -> {
                    // Only a text-carrier token carries the element text; the open/close
                    // tokens have text=null and must not clobber an already-captured name.
                    val text = token.text?.trim().orEmpty()
                    when (currentKind) {
                        Kind.TRACK -> if (token.text != null) trackName = text
                        Kind.ROUTE -> if (token.text != null) routeName = text
                        null -> if (token.text != null && captureWaypointName) pendingWaypointName = text
                    }
                }
                token.name == "ele" -> {
                    // Child elevation of a pending point: only text-carrier tokens carry the value.
                    if (token.text != null && pendingPoint != null) {
                        token.text.trim().toDoubleOrNull()?.let { pendingPoint = pendingPoint!!.copy(ele = it) }
                    }
                }
                token.name == "time" -> {
                    // Child timestamp of a pending point (ISO-8601, e.g. 2026-11-02T07:00:00Z).
                    if (token.text != null && pendingPoint != null) {
                        val parsed = runCatching { Instant.parse(token.text.trim()) }.getOrNull()
                        if (parsed != null) pendingPoint = pendingPoint!!.copy(time = parsed.toEpochMilli())
                    }
                }
                token.name == "wpt" && token.closing -> {
                    finalizePoint()
                }
                token.name in setOf("trkpt", "rtept", "wpt") -> {
                    // A new point opening tag finalizes any previous pending point, then adopts
                    // this one. Only when the opening tag carries valid coords do we start a
                    // pending point (the tokenizer re-emits the previous tag with text but empty
                    // attrs, so a null point must NOT clear an already-pending point).
                    val point = readPoint(token.attrs)
                    if (point != null) {
                        finalizePoint()
                        pendingPoint = point
                        pendingWpt = token.name == "wpt"
                        if (pendingWpt) {
                            pendingWaypointName = token.attrs["name"]?.trim()?.ifEmpty { null }
                            captureWaypointName = true
                        }
                    }
                }
            }
        }

        finalizePoint()
        flushCandidate(currentKind ?: Kind.TRACK)

        return tracks
    }

    private fun readPoint(attrs: Map<String, String>): GeoPoint? {
        val lat = attrs["lat"]?.toDoubleOrNull() ?: return null
        val lon = attrs["lon"]?.toDoubleOrNull() ?: return null
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
        val timeText = attrs["time"]?.trim()
        val time = timeText?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
        return GeoPoint(lat = lat, lon = lon, ele = attrs["ele"]?.toDoubleOrNull(), time = time)
    }

    private fun buildTrack(
        kind: Kind,
        index: Int,
        rawName: String,
        filename: String,
        rawSegments: List<List<GeoPoint>>,
        waypoints: List<Waypoint>,
    ): Track {
        var totalDistance = 0.0
        var ascent = 0.0
        var descent = 0.0
        var elevationCount = 0
        var duration = 0L
        var validTime = true
        var trackMin = Double.POSITIVE_INFINITY
        var trackMax = Double.NEGATIVE_INFINITY
        var jumpCount = 0
        var globalIndex = 0

        val segments = rawSegments.mapIndexed { si, seg ->
            var anchor: Double? = null
            var previousPoint: GeoPoint? = null
            seg.map { p ->
                previousPoint?.let { previous ->
                    val gap = distance(previous, p)
                    totalDistance += gap
                    if (gap > 2000) jumpCount++
                    val prevTime = previous.time
                    val curTime = p.time
                    if (prevTime == null || curTime == null || curTime < prevTime) validTime = false
                    else duration += curTime - prevTime
                }
                previousPoint = p
                if (p.time == null) validTime = false
                when (val ele = p.ele) {
                    null -> anchor = null
                    else -> {
                        elevationCount++
                        trackMin = minOf(trackMin, ele)
                        trackMax = maxOf(trackMax, ele)
                        // 3m hysteresis, matching desktop gpx.ts: the anchor only advances
                        // once a change >= 3m is observed, so a gradual 1m-step climb still
                        // accumulates (100->103 gives +3), not reset each step.
                        val previousAnchor = anchor
                        if (previousAnchor == null) {
                            anchor = ele
                        } else {
                            val delta = ele - previousAnchor
                            if (abs(delta) >= 3.0) {
                                if (delta > 0) ascent += delta else descent -= delta
                                anchor = ele
                            }
                        }
                    }
                }
                val point = TrackPoint(p.lat, p.lon, p.ele, p.time, totalDistance, globalIndex, si)
                globalIndex++
                point
            }
        }

        val total = globalIndex
        val warnings = mutableListOf<String>()
        if (segments.size > 1) warnings.add("${segments.size} 个独立分段，断口不连线、不计距离")
        if (elevationCount < total) warnings.add("${total - elevationCount} 个点缺少高程；累计升降不完整")
        if (!validTime) warnings.add("时间缺失或逆序，不计算实际历时")
        if (jumpCount > 0) warnings.add("${jumpCount} 处相邻点间隔超过 2 km，请核对轨迹")
        if (kind == Kind.ROUTE) warnings.add("这是路线控制点，连接线不代表真实可通行路径")

        val nameBase = rawName.trim().ifEmpty { filename.substringBeforeLast('.', filename) }
        val name = if (nameBase.endsWith(".gpx", ignoreCase = true)) nameBase.dropLast(4) else nameBase

        return Track(
            id = "pending-$index",
            name = name.take(200),
            filename = filename,
            importedAt = System.currentTimeMillis(),
            kind = kind,
            segments = segments,
            waypoints = waypoints,
            stats = TrackStats(
                distance = totalDistance,
                ascent = if (elevationCount == total) ascent else null,
                descent = if (elevationCount == total) descent else null,
                min = if (elevationCount > 0) trackMin else null,
                max = if (elevationCount > 0) trackMax else null,
                duration = if (validTime) duration else null,
                count = total,
                elevationCount = elevationCount,
            ),
            warnings = warnings,
        )
    }

    private fun tokenize(xml: String): List<Token> {
        val result = mutableListOf<Token>()
        val tagRegex = Regex("<(/?)([a-zA-Z_][a-zA-Z0-9_.:-]*)([^>]*?)(/?)>")
        val attrsRegex = Regex("""([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*'([^']*)'""")
        val allTags = tagRegex.findAll(xml).toList()
        for ((i, tag) in allTags.withIndex()) {
            if (i > 0) {
                val previous = allTags[i - 1]
                val between = xml.substring(previous.range.last + 1, tag.range.first)
                val text = if (between.trim().isEmpty()) null else between.trim()
                result.add(Token(name = previous.groupValues[2], closing = previous.groupValues[1] == "/", attrs = emptyMap(), text = text))
            }
            val closing = tag.groupValues[1] == "/"
            val name = tag.groupValues[2]
            val attrText = tag.groupValues[3]
            val attrs = mutableMapOf<String, String>()
            for (attrMatch in attrsRegex.findAll(attrText)) {
                val key = attrMatch.groupValues[1].ifEmpty { attrMatch.groupValues[3] }
                val value = attrMatch.groupValues[2].ifEmpty { attrMatch.groupValues[4] }
                attrs[key] = value
            }
            result.add(Token(name = name, closing = closing, attrs = attrs, text = null))
        }
        return result
    }

    fun distance(a: GeoPoint, b: GeoPoint): Double {
        val lat1 = Math.toRadians(a.lat)
        val lat2 = Math.toRadians(b.lat)
        val dLat = Math.toRadians(b.lat - a.lat)
        val dLon = Math.toRadians(b.lon - a.lon)
        val sinLat = Math.sin(dLat / 2)
        val sinLon = Math.sin(dLon / 2)
        val h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon
        return 2 * 6371000.0 * Math.asin(Math.sqrt(h))
    }

    private fun abs(value: Double): Double = if (value < 0) -value else value

    private data class Token(
        val name: String,
        val closing: Boolean,
        val attrs: Map<String, String>,
        val text: String?,
    )
}
