package com.ridgeline.android.core

import com.ridgeline.android.models.GeoPoint
import com.ridgeline.android.models.Kind
import com.ridgeline.android.models.Track
import com.ridgeline.android.models.TrackPoint
import com.ridgeline.android.models.TrackStats
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RouteSummaryTest {

    @Test
    fun `formats route summary with stats`() {
        val track = Track(
            id = "test-1",
            name = "测试路线",
            filename = "test.gpx",
            importedAt = 1L,
            kind = Kind.TRACK,
            segments = listOf(listOf(
                TrackPoint(0.0, 0.0, 10.0, null, 0.0, 0, 0),
                TrackPoint(0.01, 0.01, 12.0, null, 1234.0, 1, 0),
            )),
            waypoints = emptyList(),
            stats = TrackStats(
                distance = 1234.0,
                ascent = 2.0,
                descent = 0.0,
                min = 10.0,
                max = 12.0,
                duration = 600_000L,
                count = 2,
                elevationCount = 2,
            ),
            warnings = listOf("未记录时间"),
        )

        val summary = RouteSummary.format(track)

        assertEquals("测试路线", summary.lineSequence().first())
        assertTrue(summary, summary.contains("轨迹 · 2 点 · 1.2 km +2.0 m -0.0 m"))
        assertTrue(summary, summary.contains("海拔范围： 10.0 m–12.0 m"))
        assertTrue(summary, summary.contains("未记录时间"))
    }

    @Test
    fun `formats distance using meters under one kilometer`() {
        assertEquals("180 m", RouteSummary.formatDistance(180.0))
        assertEquals("1000 m", RouteSummary.formatDistance(999.5))
    }
}
