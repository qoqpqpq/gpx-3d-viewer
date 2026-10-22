# 山径 Android Native

原生 Android 客户端目录，与 `android-app/` Flutter 原型并列开发，互不覆盖。

## 当前范围

本目录先建立独立原生 Android 工程骨架：

- `app/src/main/java/com/ridgeline/android/models/`：与桌面/Flutter 原型对齐的数据模型
- `app/src/main/java/com/ridgeline/android/core/GpxParser.kt`：原生 Kotlin GPX 解析与统计
- `app/src/main/java/com/ridgeline/android/core/Guidance.kt`：轨迹匹配与偏航状态机
- `app/src/test/`：JVM 单元测试入口

## 构建要求

当前开发环境没有安装 Java/JDK、Gradle 或 Android SDK，因此本目录暂未验证 Android 编译。后续构建需要：

```bash
cd android-native
./gradlew testDebugUnitTest   # JVM 单测
./gradlew assembleDebug       # 构建调试 APK
```

如尚未安装 Android Studio，请先安装 Android Studio、Android SDK API 34、JDK 17。

## 当前限制

- UI 目前只有最小占位 Activity，不含地图渲染。
- 未接入前台定位服务和权限请求。
- 未接入真实文件选择器。
- GPX 解析器为原生 Kotlin 初版，边界口径参考桌面端，但后续应补充更多回归用例。
