package com.ridgeline.android.models

data class GeoPoint(
    val lat: Double,
    val lon: Double,
    val ele: Double? = null,
    val time: Long? = null,
)

data class TrackPoint(
    val lat: Double,
    val lon: Double,
    val ele: Double? = null,
    val time: Long? = null,
    val distance: Double,
    val index: Int,
    val segment: Int,
)

data class Waypoint(
    val lat: Double,
    val lon: Double,
    val ele: Double? = null,
    val time: Long? = null,
    val name: String,
)

data class TrackStats(
    val distance: Double,
    val ascent: Double?,
    val descent: Double?,
    val min: Double?,
    val max: Double?,
    val duration: Long?,
    val count: Int,
    val elevationCount: Int,
)

data class Track(
    val schemaVersion: Int = 1,
    val id: String,
    val name: String,
    val filename: String,
    val importedAt: Long,
    val kind: Kind,
    val segments: List<List<TrackPoint>>,
    val waypoints: List<Waypoint>,
    val stats: TrackStats,
    val warnings: List<String> = emptyList(),
)

enum class Kind { TRACK, ROUTE }
