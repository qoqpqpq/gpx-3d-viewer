package com.ridgeline.android

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.ridgeline.android.core.GpxParser
import com.ridgeline.android.core.Guidance
import com.ridgeline.android.core.GuidanceStatus
import com.ridgeline.android.core.RouteSummary
import com.ridgeline.android.models.Crs
import com.ridgeline.android.models.LocationFix
import com.ridgeline.android.models.Track

class MainActivity : AppCompatActivity() {

    private val statusText by lazy { findViewById<TextView>(R.id.status) }
    private val importButton by lazy { findViewById<Button>(R.id.import_gpx) }
    private val routeSummary by lazy { findViewById<TextView>(R.id.route_summary) }
    private val routeWarnings by lazy { findViewById<TextView>(R.id.route_warnings) }
    private val locationButton by lazy { findViewById<Button>(R.id.start_location) }
    private val guidanceStatus by lazy { findViewById<TextView>(R.id.guidance_status) }

    private var currentTrack: Track? = null
    private val guidance = Guidance()
    private var lastSimulationIndex = 0

    private val openGpxFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) {
            setStatus("未选择 GPX 文件。")
            return@registerForActivityResult
        }
        parseAndShowRoute(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText.text = "山径 Android Native"
        routeSummary.setText(R.string.no_route_loaded)
        routeWarnings.visibility = View.GONE
        guidanceStatus.visibility = View.GONE

        importButton.setOnClickListener { openGpxFile.launch(arrayOf("text/xml", "application/xml", "*/*")) }
        locationButton.setOnClickListener { showGuidanceSimulation() }
    }

    private fun parseAndShowRoute(uri: Uri) {
        setStatus("正在导入 GPX…")
        routeSummary.text = "正在读取和解析文件…"
        routeWarnings.visibility = View.GONE
        guidanceStatus.visibility = View.GONE

        val xml = try {
            contentResolver.openInputStream(uri).use { input ->
                requireNotNull(input) { "无法打开文件。" }
                input.readBytes().toString(Charsets.UTF_8)
            }
        } catch (error: Exception) {
            showError("读取文件失败：${error.message ?: error::class.java.simpleName}")
            return
        }

        val filename = uri.lastPathSegment?.substringAfterLast('/')?.ifEmpty { null } ?: "路线.gpx"
        try {
            val tracks = GpxParser.parse(xml, filename)
            if (tracks.isEmpty()) {
                showError("未找到可显示的轨迹或路线。")
                return
            }
            showRoute(tracks.first())
        } catch (error: Exception) {
            showError("解析失败：${error.message ?: error::class.java.simpleName}")
        }
    }

    private fun showRoute(track: Track) {
        currentTrack = track
        guidance.reset()
        lastSimulationIndex = 0
        setStatus("已导入：${track.name}")
        routeSummary.text = RouteSummary.format(track)
        routeWarnings.visibility = if (track.warnings.isEmpty()) View.GONE else View.VISIBLE
        routeWarnings.text = track.warnings.joinToString(separator = "；")
        guidanceStatus.visibility = View.GONE
    }

    private fun showGuidanceSimulation() {
        val track = currentTrack
        if (track == null || track.segments.isEmpty()) {
            Toast.makeText(this, "请先导入 GPX 路线。", Toast.LENGTH_LONG).show()
            return
        }

        val flat = track.segments.flatten()
        if (flat.isEmpty()) {
            showError("当前路线没有可导航的坐标点。")
            return
        }

        lastSimulationIndex = lastSimulationIndex % flat.size
        val point = flat[lastSimulationIndex]
        val fix = LocationFix(
            lat = point.lat,
            lon = point.lon,
            ele = point.ele,
            time = System.currentTimeMillis(),
            accuracy = 8.0,
            timestamp = System.currentTimeMillis(),
            source = LocationFix.Source.SIMULATION,
            crs = Crs.WGS84,
        )
        val result = guidance.update(track, fix)
        guidanceStatus.visibility = View.VISIBLE
        guidanceStatus.text = GuidanceStatus.format(result, track)
        setStatus("模拟定位：第 ${lastSimulationIndex + 1}/${flat.size} 个参考点")
        lastSimulationIndex++
    }

    private fun showError(message: String) {
        statusText.text = "操作失败"
        routeSummary.text = message
        routeWarnings.visibility = View.GONE
        guidanceStatus.visibility = View.GONE
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun setStatus(message: String) {
        statusText.text = message
    }
}
