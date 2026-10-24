package com.ridgeline.android.core

import com.ridgeline.android.models.Kind
import com.ridgeline.android.models.Track
import com.ridgeline.android.models.TrackPoint
import com.ridgeline.android.models.TrackStats
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GuidanceStatusTest {

    @Test
    fun `finds next point after current progress`() {
        val track = testTrack()
        val point = GuidanceStatus.nextPoint(track, 5.0)

        assertEquals(10.0, point?.distance ?: 0.0, 0.0001)
        assertEquals(30.01, point?.lat ?: 0.0, 0.0001)
    }

    @Test
    fun `formats on-route guidance with matched distance`() {
        val track = testTrack()
        val result = GuidanceResult(
            state = GuidanceState.ON_ROUTE,
            match = Match(distance = 18.0, progress = 5.0, segment = 0, point = track.segments.first()[1]),
            alert = false,
        )

        val text = GuidanceStatus.format(result, track)

        assertTrue(text, text.contains("沿路线行进"))
        assertTrue(text, text.contains("距路线 18.0 m"))
        assertTrue(text, text.contains("下一参考点：30.01, 120.01"))
    }

    @Test
    fun `formats off-route alert`() {
        val track = testTrack()
        val result = GuidanceResult(
            state = GuidanceState.OFF_ROUTE,
            match = Match(distance = 80.0, progress = 5.0, segment = 0, point = track.segments.first()[1]),
            alert = true,
        )

        val text = GuidanceStatus.format(result, track)

        assertTrue(text, text.contains("已偏航"))
        assertTrue(text, text.contains("偏航提醒已触发"))
    }

    private fun testTrack(): Track = Track(
        id = "guidance-status",
        name = "测试路线",
        filename = "test.gpx",
        importedAt = 1L,
        kind = Kind.TRACK,
        segments = listOf(listOf(
            TrackPoint(30.0, 120.0, 10.0, null, 0.0, 0, 0),
            TrackPoint(30.01, 120.01, 12.0, null, 10.0, 1, 0),
        )),
        waypoints = emptyList(),
        stats = TrackStats(
            distance = 10.0,
            ascent = 2.0,
            descent = 0.0,
            min = 10.0,
            max = 12.0,
            duration = null,
            count = 2,
            elevationCount = 2,
        ),
        warnings = emptyList(),
    )
}
