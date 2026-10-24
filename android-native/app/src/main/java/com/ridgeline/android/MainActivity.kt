package com.ridgeline.android

import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.ridgeline.android.core.GpxParser
import com.ridgeline.android.core.RouteSummary
import com.ridgeline.android.models.Track

class MainActivity : AppCompatActivity() {

    private val statusText by lazy { findViewById<TextView>(R.id.status) }
    private val importButton by lazy { findViewById<Button>(R.id.import_gpx) }
    private val routeSummary by lazy { findViewById<TextView>(R.id.route_summary) }
    private val routeWarnings by lazy { findViewById<TextView>(R.id.route_warnings) }
    private val locationButton by lazy { findViewById<Button>(R.id.start_location) }

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
        routeWarnings.visibility = android.view.View.GONE

        importButton.setOnClickListener { openGpxFile.launch(arrayOf("text/xml", "application/xml", "*/*")) }
        locationButton.setOnClickListener {
            Toast.makeText(this, "定位闭环将在下一阶段接入", Toast.LENGTH_LONG).show()
        }
    }

    private fun parseAndShowRoute(uri: Uri) {
        setStatus("正在导入 GPX…")
        routeSummary.text = "正在读取和解析文件…"
        routeWarnings.visibility = android.view.View.GONE

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
        setStatus("已导入：${track.name}")
        routeSummary.text = RouteSummary.format(track)
        routeWarnings.visibility = if (track.warnings.isEmpty()) android.view.View.GONE else android.view.View.VISIBLE
        routeWarnings.text = track.warnings.joinToString(separator = "；")
    }

    private fun showError(message: String) {
        statusText.text = "导入失败"
        routeSummary.text = message
        routeWarnings.visibility = android.view.View.GONE
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun setStatus(message: String) {
        statusText.text = message
    }
}
