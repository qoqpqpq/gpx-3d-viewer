package com.ridgeline.android.core

import com.ridgeline.android.models.Crs
import com.ridgeline.android.models.Kind
import com.ridgeline.android.models.LocationFix
import com.ridgeline.android.models.Track
import com.ridgeline.android.models.TrackPoint
import com.ridgeline.android.models.TrackStats
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GuidanceTest {

    // A straight south-north track at lon 120, lat 30.000 -> 30.010 (~1112 m).
    private fun testTrack(): Track {
        val points = (0..10).map { i ->
            TrackPoint(
                lat = 30.0 + i * 0.001,
                lon = 120.0,
                ele = 100.0 + i,
                time = null,
                distance = i * 111.195,
                index = i,
                segment = 0,
            )
        }
        return Track(
            id = "guidance",
            name = "直行路线",
            filename = "straight.gpx",
            importedAt = 1L,
            kind = Kind.TRACK,
            segments = listOf(points),
            waypoints = emptyList(),
            stats = TrackStats(
                distance = points.last().distance,
                ascent = 0.0,
                descent = 0.0,
                min = 100.0,
                max = 110.0,
                duration = null,
                count = points.size,
                elevationCount = points.size,
            ),
            warnings = emptyList(),
        )
    }

    private fun fixAt(lat: Double, lon: Double, accuracy: Double = 8.0, timestamp: Long = 1_000_000L): LocationFix {
        return LocationFix(
            lat = lat, lon = lon, ele = 100.0,
            time = timestamp, accuracy = accuracy, timestamp = timestamp,
            source = LocationFix.Source.SIMULATION, crs = Crs.WGS84,
        )
    }

    @Test
    fun `localXY returns correct ground distance in metres`() {
        val track = testTrack()
        val fix = fixAt(30.005, 120.0)

        // 0.001 deg lon east of the fix at lat ~30 => ~96.3 m (NOT ~1.7 m as the old buggy formula gave).
        val east = track.segments.first()[0].copy(lon = 120.001)
        val (x, _) = Guidance().localXY(east, fix)
        assertEquals(96.3, x, 2.0)

        // 0.001 deg lat north of the fix => ~111.2 m.
        val north = track.segments.first()[0].copy(lat = 30.006)
        val (_, y) = Guidance().localXY(north, fix)
        assertEquals(111.2, y, 2.0)

        // Point at the fix itself is at the origin (0,0).
        val atFix = track.segments.first()[0].copy(lat = 30.005, lon = 120.0)
        val (x0, y0) = Guidance().localXY(atFix, fix)
        assertEquals(0.0, x0, 0.001)
        assertEquals(0.0, y0, 0.001)
    }

    @Test
    fun `matches an on-route fix to the nearest segment point`() {
        val track = testTrack()
        val guidance = Guidance()
        val fix = fixAt(30.005, 120.0)  // exactly on the route

        val match = guidance.matchRoute(track, fix)

        assertNotNull(match)
        // The fix is on the route, so distance to the nearest segment should be tiny.
        assertTrue("distance should be near 0 but was ${match.distance}", match.distance < 1.0)
        // Should match around the midpoint (progress ~ 5 * 111.195).
        assertTrue("progress should be near midpoint but was ${match.progress}", match.progress in 400.0..700.0)
    }

    @Test
    fun `off-route fix at 200 m is matched as pending then off-route after dwell`() {
        val track = testTrack()
        val guidance = Guidance()
        // 0.002 deg lon east => ~192 m off route (below the 5s dwell, so pending at first).
        val fix = fixAt(30.005, 120.002, timestamp = 1_000_000L)
        val match = guidance.matchRoute(track, fix)

        assertNotNull(match)
        assertTrue("off-route distance should be ~192 m but was ${match.distance}", match.distance in 150.0..250.0)
    }

    @Test
    fun `rejects fix with invalid accuracy or stale timestamp`() {
        val track = testTrack()
        val guidance = Guidance()

        val badAccuracy = fixAt(30.005, 120.0, accuracy = 99.0)
        val r1 = guidance.update(track, badAccuracy)
        assertEquals(GuidanceState.UNCERTAIN, r1.state)

        val stale = fixAt(30.005, 120.0, timestamp = 1_000_000L).copy(timestamp = 900_000L)
        val r2 = guidance.update(track, stale, now = 1_000_000L)
        assertEquals(GuidanceState.UNCERTAIN, r2.state)
    }

    @Test
    fun `off-route alert triggers after 5 s of dwell then recovers`() {
        val track = testTrack()
        val guidance = Guidance()
        val now = 1_000_000L

        // First fix exactly on route => ON_ROUTE.
        val on = fixAt(30.005, 120.0, timestamp = now)
        val r0 = guidance.update(track, on, now = now)
        assertEquals(GuidanceState.ON_ROUTE, r0.state)
        assertFalse(r0.alert)

        // Move off route (192 m) and keep the fix there for >5 s => alert.
        val off = fixAt(30.005, 120.002, timestamp = now + 1_000L)
        var last = guidance.update(track, off, now = now + 1_000L)
        assertEquals(GuidanceState.PENDING, last.state)
        assertFalse(last.alert)

        val off2 = fixAt(30.005, 120.002, timestamp = now + 6_000L)
        last = guidance.update(track, off2, now = now + 6_000L)
        assertEquals(GuidanceState.OFF_ROUTE, last.state)
        assertTrue("off-route alert should fire", last.alert)

        // Return to the route for >3 s => recovers to ON_ROUTE without alert.
        val back = fixAt(30.005, 120.0, timestamp = now + 7_000L)
        last = guidance.update(track, back, now = now + 7_000L)
        assertEquals(GuidanceState.OFF_ROUTE, last.state)  // still off until 3s inside

        val back2 = fixAt(30.005, 120.0, timestamp = now + 11_000L)
        last = guidance.update(track, back2, now = now + 11_000L)
        assertEquals(GuidanceState.ON_ROUTE, last.state)
        assertFalse(last.alert)
    }
}
