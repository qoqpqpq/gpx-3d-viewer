package com.ridgeline.android

import android.app.Activity
import android.os.Bundle
import android.widget.Toast

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        Toast.makeText(this, "山径 Android 骨架", Toast.LENGTH_SHORT).show()
    }
}
