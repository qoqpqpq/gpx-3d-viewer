# 山径 Android Native

原生 Android 客户端目录，与 `android-app/` Flutter 原型并列开发，互不覆盖。

## 当前范围

本目录先建立独立原生 Android 工程骨架，并已接入 GPX 导入与模拟导航匹配最小 UI：

- `app/src/main/java/com/ridgeline/android/models/`：与桌面/Flutter 原型对齐的数据模型
- `app/src/main/java/com/ridgeline/android/core/GpxParser.kt`：原生 Kotlin GPX 解析与统计
- `app/src/main/java/com/ridgeline/android/core/Guidance.kt`：轨迹匹配与偏航状态机
- `app/src/main/java/com/ridgeline/android/core/RouteSummary.kt`：路线统计摘要格式化
- `app/src/main/java/com/ridgeline/android/core/GuidanceStatus.kt`：导航状态文案与下一参考点计算
- `app/src/main/AndroidManifest.xml`：最小启动 Activity、权限声明
- `app/src/main/java/com/ridgeline/android/MainActivity.kt`：原生启动入口、文件选择、导入统计与模拟导航状态展示
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

当前运行环境已安装系统 JDK 17，Gradle 可启动；本目录已补充 Gradle wrapper。已在本地用 `AGP 8.6.1 + Gradle 8.7` 跑通 Android Gradle 核心链路：`testDebugUnitTest` 和 `assembleDebug` 均成功，并生成 Debug APK。新增 GPX 导入和模拟导航匹配最小 UI 后继续验证通过。若后续升级 AGP 8.7.0，则需要 Gradle 8.9 或 Android Studio 内置 Gradle。

已验证内容：

- `AGP 8.6.1 + Gradle 8.7 + testDebugUnitTest` 成功：`BUILD SUCCESSFUL`，`27 actionable tasks: 27 executed`
- `AGP 8.6.1 + Gradle 8.7 + assembleDebug` 成功：`BUILD SUCCESSFUL`，`34 actionable tasks: 4 executed, 30 up-to-date`
- Debug APK 生成：`app/build/outputs/apk/debug/app-debug.apk`
- Kotlin 核心代码可编译并参与 Android Gradle 单测链路
- Android JVM 测试通过：25 个测试

## 修复记录

- `Guidance.localXY` 曾用 `radians() × 111320/110574`（度/米常量），把度当作弧度使用导致距离被低估约 57.3 倍；已改为 `radians() × 6371008.8`（地球平均半径，与桌面端 `geo.ts` 一致），并新增 `GuidanceTest` 5 个用例覆盖该公式与偏航状态机。
- `GpxParser.buildTrack` 的 `previousPoint` 原声明在段外，导致把上一段最后一点与下一段第一点之间的间隔计入总距离，与“断口不连线、不计距离”语义冲突；已改为段内声明，仅统计段内相邻点距离，与桌面端 `gpx.ts` 一致。
- `GpxParser` 原用 `token.attrs["name"]` 读航点名称，但 GPX 标准航点名在子元素 `<wpt><name>…</name>`，导致所有航点恒显示“未命名航点”；已改为捕获子 `<name>` 文本，与桌面端 `gpx.ts` 一致。新增 `GpxParserRegressionTest` 7 个用例覆盖上述回归。
- `GpxParser.readPoint` 原只从 `lat`/`lon` 属性读取，从未解析子元素 `<ele>`/`<time>`，导致所有轨迹点高程与时间恒为 null，`ascent`/`descent`/`min`/`max`/`duration` 恒为 null；已改为延迟到子元素读取后再落库，与桌面端 `gpx.ts`（读 `n.ele`/`n.time`）一致。高程锚点原在每点更新，导致缓坡爬升不计入爬升；已改为与桌面端一致的 3m 迟滞（锚点仅在 `abs(delta)>=3` 时推进）。新增 `GpxParserChildElementTest` 6 个用例覆盖上述回归。

## 当前限制

- UI 已支持 GPX 导入、统计摘要和模拟导航匹配展示，仍不含地图渲染。
- 模拟导航只按导入路线点逐个构造测试定位，未接入前台定位服务和权限请求。
- 当前 APK 为 Gradle Debug 构建，未做真机安装、签名发布、混淆或正式渠道包验证。
- GPX 解析器为原生 Kotlin 初版，边界口径已与桌面端 `gpx.ts` 对齐（跨段不连线不计距离、航点名称取自子元素），并补充回归用例；真机/大文件边界仍待设备验证。
