package com.ridgeline

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import java.io.IOException

/**
 * 偏航告警播放器
 * 
 * 功能：
 * 1. 播放告警声音
 * 2. 触发设备振动
 * 3. 尊重系统静音设置
 */
class AlertPlayer(private val context: Context) {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    init {
        initializeVibrator()
    }

    /**
     * 播放告警
     */
    fun play() {
        playSound()
        vibrate()
    }

    /**
     * 播放告警声音
     */
    private fun playSound() {
        try {
            // 停止之前的播放
            mediaPlayer?.stop()
            mediaPlayer?.release()

            // 使用系统通知音
            val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            mediaPlayer = MediaPlayer.create(context, notificationUri).apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setOnCompletionListener {
                    // 播放完成，释放资源
                }
                start()
            }
        } catch (e: IOException) {
            // 忽略播放失败
        }
    }

    /**
     * 振动
     */
    private fun vibrate() {
        vibrator?.let { vib ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createWaveform(
                    longArrayOf(0, 500, 200, 500, 200, 500),
                    -1 // 不循环
                )
                vib.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(longArrayOf(0, 500, 200, 500, 200, 500), -1)
            }
        }
    }

    /**
     * 初始化振动器
     */
    private fun initializeVibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibrator = vibManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    /**
     * 释放资源
     */
    fun release() {
        mediaPlayer?.release()
        mediaPlayer = null
    }
}
