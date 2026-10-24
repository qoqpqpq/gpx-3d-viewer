# 山径 Android Native

原生 Android 客户端目录，与 `android-app/` Flutter 原型并列开发，互不覆盖。

## 当前范围

本目录先建立独立原生 Android 工程骨架，并已接入 GPX 导入最小 UI：

- `app/src/main/java/com/ridgeline/android/models/`：与桌面/Flutter 原型对齐的数据模型
- `app/src/main/java/com/ridgeline/android/core/GpxParser.kt`：原生 Kotlin GPX 解析与统计
- `app/src/main/java/com/ridgeline/android/core/Guidance.kt`：轨迹匹配与偏航状态机
- `app/src/main/java/com/ridgeline/android/core/RouteSummary.kt`：路线统计摘要格式化
- `app/src/main/AndroidManifest.xml`：最小启动 Activity、权限声明
- `app/src/main/java/com/ridgeline/android/MainActivity.kt`：原生启动入口、文件选择与导入统计展示
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

当前运行环境已安装系统 JDK 17，Gradle 可启动；本目录已补充 Gradle wrapper。已在本地用 `AGP 8.6.1 + Gradle 8.7` 跑通 Android Gradle 核心链路：`testDebugUnitTest` 和 `assembleDebug` 均成功，并生成 Debug APK。新增 GPX 导入最小 UI 后继续验证通过。若后续升级 AGP 8.7.0，则需要 Gradle 8.9 或 Android Studio 内置 Gradle。

已验证内容：

- `AGP 8.6.1 + Gradle 8.7 + testDebugUnitTest` 成功：`BUILD SUCCESSFUL`，`4 actionable tasks: 4 executed`
- `AGP 8.6.1 + Gradle 8.7 + assembleDebug` 成功：`BUILD SUCCESSFUL`，`34 actionable tasks: 8 executed, 26 up-to-date`
- Debug APK 生成：`app/build/outputs/apk/debug/app-debug.apk`
- Kotlin 核心代码可编译并参与 Android Gradle 单测链路
- Android JVM 测试通过：4 个测试

## 当前限制

- UI 已支持 GPX 导入与统计摘要，仍不含地图渲染。
- 未接入前台定位服务和权限请求。
- 当前 APK 为 Gradle Debug 构建，未做真机安装、签名发布、混淆或正式渠道包验证。
- GPX 解析器为原生 Kotlin 初版，边界口径参考桌面端，但后续应补充更多回归用例。
