package com.ridgeline

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * 山径前台定位服务
 * 
 * 核心职责：
 * 1. 持续获取 GPS 定位（锁屏可用）
 * 2. 通过 EventChannel 推送定位数据到 Flutter
 * 3. 偏航告警时播放声音/振动
 * 4. 前台通知保持服务运行
 */
class RidgelineLocationService : Service() {

    companion object {
        const CHANNEL_ID = "ridgeline_location"
        const NOTIFICATION_ID = 1001
        const METHOD_CHANNEL = "ridgeline/navigation"
        const EVENT_CHANNEL = "ridgeline/location"
        
        var eventSink: EventChannel.EventSink? = null
        var flutterEngine: FlutterEngine? = null
    }

    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var isRunning = false
    private var alertPlayer: AlertPlayer? = null

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        alertPlayer = AlertPlayer(this)
        setupLocationCallback()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!isRunning) {
            startForeground(NOTIFICATION_ID, buildNotification("正在定位..."))
            requestLocationUpdates()
            isRunning = true
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    /**
     * 设置定位回调
     */
    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    sendLocationToFlutter(location)
                }
            }
        }
    }

    /**
     * 请求定位更新
     */
    private fun requestLocationUpdates() {
        try {
            val request = LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY,
                1000L // 1秒间隔
            )
                .setMinUpdateIntervalMillis(500)
                .setMinUpdateDistanceMeters(1f)
                .build()

            fusedClient.requestLocationUpdates(
                request,
                locationCallback,
                android.os.Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            sendErrorToFlutter("位置权限被拒绝: ${e.message}")
        } catch (e: Exception) {
            sendErrorToFlutter("定位请求失败: ${e.message}")
        }
    }

    /**
     * 将定位数据发送到 Flutter
     */
    private fun sendLocationToFlutter(location: Location) {
        val data = mapOf(
            "lat" to location.latitude,
            "lon" to location.longitude,
            "ele" to location.altitude,
            "source" to if (location.hasAltitude()) 1 else 0,
            "timestamp" to location.time,
            "accuracy" to location.accuracy.toDouble(),
            "speed" to location.speed,
            "bearing" to location.bearing
        )
        eventSink?.success(data)
    }

    /**
     * 发送错误到 Flutter
     */
    private fun sendErrorToFlutter(message: String) {
        eventSink?.error("LOCATION_ERROR", message, null)
    }

    /**
     * 处理来自 Flutter 的方法调用
     */
    fun handleMethodCall(call: MethodCall) {
        when (call.method) {
            "startLocation" -> {
                startForeground(NOTIFICATION_ID, buildNotification("正在定位..."))
                if (!isRunning) {
                    requestLocationUpdates()
                    isRunning = true
                }
            }
            "stopLocation" -> {
                stopLocationUpdates()
                isRunning = false
            }
            "playAlert" -> {
                alertPlayer?.play()
            }
        }
    }

    /**
     * 停止定位更新
     */
    private fun stopLocationUpdates() {
        fusedClient.removeLocationUpdates(locationCallback)
    }

    /**
     * 创建通知渠道
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "定位服务",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "山径定位引导服务"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * 构建前台通知
     */
    private fun buildNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("山径引导中")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        stopLocationUpdates()
        super.onDestroy()
    }
}
