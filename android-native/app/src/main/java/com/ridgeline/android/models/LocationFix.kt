package com.ridgeline.android.models

data class LocationFix(
    val lat: Double,
    val lon: Double,
    val ele: Double? = null,
    val time: Long? = null,
    val accuracy: Double = 0.0,
    val timestamp: Long,
    val source: Source,
    val crs: Crs = Crs.WGS84,
) {
    enum class Source { SIMULATION, BROWSER, ANDROID }
}

enum class Crs { WGS84 }
