package com.ridgeline.android.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GpxParserRegressionTest {

    @Test
    fun `does not connect distance across segment boundaries`() {
        // Two segments far apart (~111 km gap). Distance must NOT include the gap.
        val xml = """
            <gpx version="1.1">
              <trk><name>two-seg</name>
                <trkseg>
                  <trkpt lat="30.000" lon="120.000"><ele>100</ele></trkpt>
                  <trkpt lat="30.001" lon="120.000"><ele>101</ele></trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat="31.000" lon="120.000"><ele>200</ele></trkpt>
                  <trkpt lat="31.001" lon="120.000"><ele>201</ele></trkpt>
                </trkseg>
              </trk>
            </gpx>
        """.trimIndent()

        val tracks = GpxParser.parse(xml, "two-seg.gpx")
        assertEquals(1, tracks.size)
        val track = tracks.first()
        // Each segment is ~111.2 m; total must be ~222 m, NOT ~111 km (the cross-gap).
        assertTrue("distance should be ~222 m but was ${track.stats.distance}", track.stats.distance in 210.0..235.0)
        assertTrue(track.warnings.any { it.contains("独立分段") })
    }

    @Test
    fun `tracks multiple segments as independent and sums their distances`() {
        val xml = """
            <gpx version="1.1">
              <trk><name>multi</name>
                <trkseg>
                  <trkpt lat="30.000" lon="120.000"/><trkpt lat="30.002" lon="120.000"/>
                </trkseg>
                <trkseg>
                  <trkpt lat="30.004" lon="120.000"/><trkpt lat="30.006" lon="120.000"/>
                </trkseg>
              </trk>
            </gpx>
        """.trimIndent()

        val track = GpxParser.parse(xml, "multi.gpx").first()
        assertEquals(2, track.segments.size)
        // Two segments, each ~222.4 m => total ~444.8 m.
        assertTrue(track.stats.distance in 430.0..460.0)
        assertEquals(4, track.stats.count)
    }

    @Test
    fun `rejects out of range coordinates and breaks segment`() {
        val xml = """
            <gpx version="1.1">
              <trk><name>bad-coord</name>
                <trkseg>
                  <trkpt lat="30.000" lon="120.000"/><trkpt lat="91.0" lon="120.000"/><trkpt lat="30.002" lon="120.000"/>
                </trkseg>
              </trk>
            </gpx>
        """.trimIndent()

        // The invalid point is dropped, splitting into two 1-point segments.
        // A track needs >= 2 points total to be kept; here only 2 valid points remain (30.000 and 30.002).
        val track = GpxParser.parse(xml, "bad.gpx").first()
        assertEquals(2, track.stats.count)
    }

    @Test
    fun `missing elevation sets ascent and descent to null`() {
        val xml = """
            <gpx version="1.1">
              <trk><name>no-ele</name>
                <trkseg>
                  <trkpt lat="30.000" lon="120.000"/><trkpt lat="30.001" lon="120.000"/>
                </trkseg>
              </trk>
            </gpx>
        """.trimIndent()

        val track = GpxParser.parse(xml, "no-ele.gpx").first()
        assertNull(track.stats.ascent)
        assertNull(track.stats.descent)
        assertEquals(0, track.stats.elevationCount)
        assertTrue(track.warnings.any { it.contains("缺少高程") })
    }

    @Test
    fun `parses waypoint name from attributes`() {
        val xml = """
            <gpx version="1.1">
              <wpt lat="30.000" lon="120.000"><name>补给站</name></wpt>
              <trk><name>w</name>
                <trkseg>
                  <trkpt lat="30.000" lon="120.000"/><trkpt lat="30.001" lon="120.000"/>
                </trkseg>
              </trk>
            </gpx>
        """.trimIndent()

        val track = GpxParser.parse(xml, "w.gpx").first()
        assertEquals(1, track.waypoints.size)
        assertEquals("补给站", track.waypoints.first().name)
    }

    @Test
    fun `rejects single point track as empty`() {
        val xml = """
            <gpx version="1.1">
              <trk><name>single</name>
                <trkseg>
                  <trkpt lat="30.000" lon="120.000"/>
                </trkseg>
              </trk>
            </gpx>
        """.trimIndent()

        val tracks = GpxParser.parse(xml, "single.gpx")
        // Only one point => below the 2-point minimum => no track.
        assertTrue(tracks.isEmpty())
    }

    @Test
    fun `rejects oversized file over 20MB`() {
        // 20MB + 1 byte of ASCII => ~20MB. Build a string just over the limit cheaply.
        val limit = GpxParser.MAX_BYTES
        val xml = "a".repeat(limit + 1)
        val ex = runCatching { GpxParser.parse(xml) }.exceptionOrNull()
        assertNotNull(ex)
        assertTrue(ex!!.message.orEmpty().contains("20 MB"))
    }
}
