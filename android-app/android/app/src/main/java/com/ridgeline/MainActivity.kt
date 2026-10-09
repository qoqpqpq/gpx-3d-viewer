package com.ridgeline

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * 山径主 Activity
 * 
 * 职责：
 * 1. 初始化 Flutter 引擎
 * 2. 设置 MethodChannel 和 EventChannel
 * 3. 处理权限请求
 * 4. 启动/停止定位服务
 */
class MainActivity : FlutterActivity() {

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startLocationService()
            methodChannel?.invokeMethod("onPermissionGranted", null)
        } else {
            methodChannel?.invokeMethod("onPermissionDenied", "位置权限被拒绝")
        }
    }

    private var methodChannel: MethodChannel? = null
    private var locationService: RidgelineLocationService? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 请求定位权限
        checkLocationPermission()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        RidgelineLocationService.flutterEngine = flutterEngine

        // 设置 MethodChannel
        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, RidgelineLocationService.METHOD_CHANNEL)
        methodChannel?.setMethodCallHandler { call, result ->
            handleMethodCall(call, result)
        }

        // 设置 EventChannel（定位数据推送）
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, RidgelineLocationService.EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    RidgelineLocationService.eventSink = events
                }

                override fun onCancel(arguments: Any?) {
                    RidgelineLocationService.eventSink = null
                }
            })
    }

    /**
     * 检查并请求定位权限
     */
    private fun checkLocationPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            
            if (ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.ACCESS_FINE_LOCATION)) {
                // 显示解释界面
                methodChannel?.invokeMethod("showPermissionRationale", "需要位置权限才能提供路线引导服务")
            }
            
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        } else {
            // 权限已授予，可以启动服务
            startLocationService()
        }
    }

    /**
     * 处理来自 Flutter 的方法调用
     */
    private fun handleMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "startLocation" -> {
                if (checkLocationPermissionGranted()) {
                    startLocationService()
                    result.success(true)
                } else {
                    result.error("PERMISSION_DENIED", "需要位置权限", null)
                }
            }
            "stopLocation" -> {
                stopLocationService()
                result.success(true)
            }
            "playAlert" -> {
                locationService?.handleMethodCall(MethodCall("playAlert", null))
                result.success(true)
            }
            "getLocationServiceState" -> {
                result.success(locationService?.isRunning ?: false)
            }
            else -> {
                result.notImplemented()
            }
        }
    }

    /**
     * 检查定位权限是否已授予
     */
    private fun checkLocationPermissionGranted(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
    }

    /**
     * 启动定位服务
     */
    private fun startLocationService() {
        val intent = Intent(this, RidgelineLocationService::class.java)
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    /**
     * 停止定位服务
     */
    private fun stopLocationService() {
        val intent = Intent(this, RidgelineLocationService::class.java)
        stopService(intent)
    }
}
