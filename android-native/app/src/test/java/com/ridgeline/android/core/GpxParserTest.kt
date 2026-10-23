package com.ridgeline.android.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GpxParserTest {

    @Test
    fun `parses minimal gpx with one segment`() {
        val xml = """
            <gpx version="1.1">
              <trk>
                <name>sample</name>
                <trkseg>
                  <trkpt lat="0.0" lon="0.0"><ele>10</ele></trkpt>
                  <trkpt lat="0.01" lon="0.01"><ele>12</ele></trkpt>
                </trkseg>
              </trk>
            </gpx>
        """.trimIndent()

        val tracks = GpxParser.parse(xml, "sample.gpx")

        assertEquals(1, tracks.size)
        val track = tracks.first()
        assertEquals(2, track.stats.count)
        assertEquals(1, track.segments.size)
        assertEquals(2, track.segments.first().size)
        assertTrue(track.stats.distance > 0)
    }

    @Test
    fun `rejects files with entity expansion`() {
        val xml = """
            <!DOCTYPE gpx [<!ENTITY bad "x">]>
            <gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>
        """.trimIndent()
        val ex = runCatching { GpxParser.parse(xml) }.exceptionOrNull()
        assertNotNull(ex)
    }
}
