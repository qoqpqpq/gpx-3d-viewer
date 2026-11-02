package com.ridgeline.android.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Cross-parser regression tests: the Android parser must read child <ele>/<time>
 * elements (matching desktop gpx.ts) and use the same 3m elevation hysteresis.
 */
class GpxParserChildElementTest {

    private fun mk(eles: List<Int>, times: Boolean = false): String {
        val pts = eles.mapIndexed { i, e ->
            val t = if (times) "<time>2026-11-02T0${i}:00:00Z</time>" else ""
            "<trkpt lat=\"30.000\" lon=\"120.000\"><ele>$e</ele>$t</trkpt>"
        }.joinToString("")
        return "<gpx version=\"1.1\"><trk><name>t</name><trkseg>$pts</trkseg></trk></gpx>"
    }

    @Test
    fun readsChildElevationGradualClimb() {
        val t = GpxParser.parse(mk(listOf(100, 101, 102, 103)))[0]
        // Desktop gpx.ts: 3m hysteresis => gradual 1m-step climb still accumulates +3.
        assertEquals(3.0, t.stats.ascent!!, 0.01)
        assertEquals(0.0, t.stats.descent!!, 0.01)
        assertEquals(100.0, t.stats.min!!, 0.01)
        assertEquals(103.0, t.stats.max!!, 0.01)
    }

    @Test
    fun readsChildElevationGradualDescent() {
        val t = GpxParser.parse(mk(listOf(103, 102, 101, 100)))[0]
        assertEquals(0.0, t.stats.ascent!!, 0.01)
        assertEquals(3.0, t.stats.descent!!, 0.01)
    }

    @Test
    fun readsChildElevationSingleJump() {
        val t = GpxParser.parse(mk(listOf(100, 100, 100, 103)))[0]
        assertEquals(3.0, t.stats.ascent!!, 0.01)
        assertEquals(0.0, t.stats.descent!!, 0.01)
    }

    @Test
    fun readsChildTimeAndComputesDuration() {
        val t = GpxParser.parse(mk(listOf(100, 101), times = true))[0]
        val seg = t.segments.first()
        assertNotNull(seg[0].time)
        assertNotNull(seg[1].time)
        // T00:00:00Z -> T01:00:00Z = 1 hour.
        assertEquals(3_600_000L, seg[1].time!! - seg[0].time!!)
        assertNotNull(t.stats.duration)
        assertEquals(3_600_000L, t.stats.duration!!)
    }

    @Test
    fun waypointReadsChildElevationAndName() {
        val xml = """
            <gpx version="1.1">
              <wpt lat="30.000" lon="120.000"><ele>512</ele><name>山顶</name></wpt>
              <trk><name>w</name><trkseg>
                <trkpt lat="30.000" lon="120.000"/><trkpt lat="30.001" lon="120.000"/>
              </trkseg></trk>
            </gpx>
        """.trimIndent()
        val t = GpxParser.parse(xml)[0]
        assertEquals(1, t.waypoints.size)
        assertEquals("山顶", t.waypoints.first().name)
        assertEquals(512.0, t.waypoints.first().ele!!, 0.01)
    }

    @Test
    fun pointWithoutElevationLeavesStatsNull() {
        val t = GpxParser.parse(mk(listOf(100, 101)).replace("<ele>100</ele>", "").replace("<ele>101</ele>", ""))[0]
        assertNull(t.stats.ascent)
        assertNull(t.stats.descent)
        assertEquals(0, t.stats.elevationCount)
    }
}
