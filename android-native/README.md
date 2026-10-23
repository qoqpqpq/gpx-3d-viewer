# 山径 Android Native

原生 Android 客户端目录，与 `android-app/` Flutter 原型并列开发，互不覆盖。

## 当前范围

本目录先建立独立原生 Android 工程骨架：

- `app/src/main/java/com/ridgeline/android/models/`：与桌面/Flutter 原型对齐的数据模型
- `app/src/main/java/com/ridgeline/android/core/GpxParser.kt`：原生 Kotlin GPX 解析与统计
- `app/src/main/java/com/ridgeline/android/core/Guidance.kt`：轨迹匹配与偏航状态机
- `app/src/main/AndroidManifest.xml`：最小启动 Activity、权限声明
- `app/src/main/java/com/ridgeline/android/MainActivity.kt`：最小原生启动入口
- `app/src/test/`：JVM 单元测试入口

## 构建要求

本目录按原生 Android 工程结构组织，目标 SDK 为 API 34，`minSdk` 为 29。完整 APK 构建建议在 Android Studio 或标准 Android 开发环境执行：

```bash
cd android-native
./gradlew testDebugUnitTest   # JVM 单测
./gradlew assembleDebug       # 构建调试 APK
```

如尚未安装 Android Studio，请先安装 Android Studio、Android SDK API 34、JDK 17。

## 本仓库验证记录

当前运行环境已安装系统 JDK 17，Gradle 可启动；`AGP 8.7.0` 需要 Gradle `8.9`，本仓库已将 AGP 调整到 `8.7.0`，完整验证需使用 Gradle `8.9` 或 Android Studio 内置 Gradle。已完成 Kotlin 核心代码 JVM 编译和最小单测验证：

- `Track.kt` / `LocationFix.kt` / `GpxParser.kt` / `Guidance.kt` 可编译为 JVM class
- `GpxParserTest` 通过：2/2

## 当前限制

- UI 目前只有最小占位 Activity，不含地图渲染。
- 未接入前台定位服务和权限请求。
- 未接入真实文件选择器。
- 尚未验证 `assembleDebug`，因此不能声称 APK 可安装运行；后续需 Gradle 8.9 或 Android Studio 内置 Gradle。
- GPX 解析器为原生 Kotlin 初版，边界口径参考桌面端，但后续应补充更多回归用例。
