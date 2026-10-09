# 山径 Ridgeline Android 客户端

GPX 路线工作台 Android 原生客户端。实现**定位 → 匹配 → 偏航告警**最小闭环。

## 功能

- ✅ 持续 GPS 定位（锁屏可用）
- ✅ 轨迹匹配与偏航检测
- ✅ 偏航声音 + 振动告警
- ✅ WebView 地图预览（CesiumJS）
- ✅ 前台服务保活

## 构建要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Flutter SDK | 3.16+ | Dart 3.2+ |
| Android SDK | API 34 | compileSdk 34 |
| minSdk | 29 (Android 10) | 最低支持版本 |
| Java | 11+ | Android Gradle 7.3 |
| Kotlin | 1.8.22+ | Android 原生代码 |

## 快速开始

### 1. 安装 Flutter

```bash
# 参考官方文档安装 Flutter SDK
# https://flutter.dev/docs/get-started/install
flutter doctor
```

### 2. 构建项目

```bash
cd android-app

# 获取依赖
flutter pub get

# 运行到设备
flutter run

# 构建 APK
flutter build apk --release
```

### 3. 配置 Android SDK

确保 `local.properties` 包含：
```properties
flutter.sdk=/path/to/flutter
sdk.dir=/path/to/android/sdk
```

## 项目结构

```
android-app/
├── lib/                          # Flutter Dart 代码
│   ├── main.dart                 # 主入口 + UI
│   ├── models/
│   │   └── types.dart            # 数据模型（对齐桌面版）
│   └── navigation/
│       └── guidance.dart         # 导航匹配（移植自 TypeScript）
├── android/                      # Android 原生代码
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/ridgeline/
│   │   │   │   ├── MainActivity.kt              # 主 Activity + 桥接
│   │   │   │   ├── RidgelineLocationService.kt   # 前台定位服务
│   │   │   │   └── AlertPlayer.kt                # 告警播放器
│   │   │   └── AndroidManifest.xml              # 权限声明
│   │   └── build.gradle
│   └── build.gradle
├── web/
│   └── map.html                  # WebView 地图页面
├── pubspec.yaml                  # Flutter 依赖
└── README.md                     # 本文件
```

## 核心架构

```
┌─────────────────────────────────────────────────────────┐
│  Flutter UI (main.dart)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 状态卡片      │  │ 进度信息      │  │ 控制按钮      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│  MethodChannel: ridgeline/navigation                     │
│  ├─ startLocation()  → 启动定位服务                      │
│  ├─ stopLocation()   → 停止定位服务                      │
│  └─ playAlert()      → 播放告警                          │
├─────────────────────────────────────────────────────────┤
│  EventChannel: ridgeline/location                        │
│  └─ 推送定位数据 (lat, lon, accuracy, timestamp...)      │
├─────────────────────────────────────────────────────────┤
│  Android 原生层                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ RidgelineLocationService (前台服务)                 │ │
│  │ ├─ FusedLocationProviderClient (GPS 持续定位)       │ │
│  │ ├─ LocationCallback (位置更新回调)                   │ │
│  │ └─ AlertPlayer (声音 + 振动)                         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 导航算法

移植自桌面版 `src/core/navigation.ts`，核心逻辑完全对齐：

| 参数 | 值 | 说明 |
|---|---|---|
| 定位精度门槛 | 35m | 超过则进入不确定状态 |
| 位置过期 | 10s | 超过则不判断 |
| 偏航阈值 | max(40m, 2×精度) | 连续 5 秒触发告警 |
| 恢复阈值 | 20m | 持续 3 秒清除告警 |
| 连续性窗口 | 400m | 限制跨分支跳转 |

## 测试验证

### 算法一致性测试

确保 Dart 实现与 TypeScript 输出一致：

```dart
// 测试向量（来自桌面版 tests/core.test.ts）
test('赤道参考距离', () {
  final track = createTestTrack();
  final fix = LocationFix(
    crs: Crs.wgs84,
    lat: 0,
    lon: 0,
    timestamp: DateTime.now().millisecondsSinceEpoch,
    accuracy: 10,
  );
  final match = matchRoute(track, fix);
  expect(match.distance, closeTo(0, 1));
});
```

### 真机测试清单

- [ ] 首次定位授权
- [ ] 锁屏持续定位 60 分钟
- [ ] 偏航 150m 触发告警
- [ ] 回到路线清除告警
- [ ] 省电模式定位
- [ ] 进程被杀后恢复

## 已知限制

- WebView 地图需要网络连接（CesiumJS CDN）
- 离线地图未实现
- GPX 文件导入未实现（仅演示数据）
- 轨迹持久化未实现（SQLite 待集成）

## 下一步

- [ ] 集成 GPX 文件导入
- [ ] SQLite 轨迹持久化
- [ ] 离线地图支持
- [ ] 高德地图集成
- [ ] 海拔剖面显示
- [ ] 真机性能优化
