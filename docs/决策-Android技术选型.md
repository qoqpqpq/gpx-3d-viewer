# 决策：Android 技术选型与目标设备

> **决策日期：** 2026-10-09
> **决策依据：** 用户确认小米系列设备；其余按产品规划 v1.1 合理默认
> **状态：** 已确认

---

## 1. 目标设备

| 类别 | 型号 | Android 版本 | 用途 |
|---|---|---|---|
| 主力测试机 | Redmi Note 13 | Android 13/14 | 日常功能验证、性能基准 |
| 中高端测试机 | Xiaomi 13 | Android 13/14 | 上限性能参考 |
| 低端兼容性 | Redmi Note 12 | Android 12 | 低端设备兼容性验证 |

**最低支持版本：Android 10 (API 29)**

理由：Android 10 发布于 2019 年，2026 年仍有大量存量设备使用；Xiaomi/Redmi 设备普遍已升级至 Android 12+，但 API 29 保证了更广泛的前向兼容性。Android 10 支持前台服务类型（`foregroundServiceType="location"`），满足核心定位需求。

---

## 2. 技术架构

```
Flutter (应用壳 + 状态管理 + 权限 + 文件导入)
  ├─ Dart Isolate: GPX 解析 + 统计分析（复用 v0.1 算法）
  ├─ WebView: CesiumJS 三维渲染 + 二维 Canvas 降级
  ├─ Android 原生适配层:
  │   ├─ 前台定位服务 (FusedLocationProvider / GnssLocationProvider)
  │   ├─ 偏航匹配 + 声音/振动提醒
  │   ├─ 后台保活 + 进程恢复
  │   └─ 高德"前往起点"入口 (可选)
  └─ SQLite + 文件: 本地轨迹库（复用 IndexedDB schema）
```

### 2.1 核心依赖

| 组件 | 选型 | 理由 |
|---|---|---|
| 应用框架 | Flutter 3.x | 跨平台、高性能、与现有 TypeScript 核心通过测试向量对齐 |
| 地图引擎 | CesiumJS 1.145 (WebView) | 与桌面版一致，三维地形 + 贴地线 |
| 二维渲染 | Canvas (WebView) | 与桌面版一致，无底图降级 |
| 本地存储 | SQLite + 文件系统 | 与桌面版 IndexedDB schema 对齐 |
| 定位 | Android FusedLocationProvider | 原生定位精度最高，支持锁屏持续定位 |
| 距离计算 | GeographicLib (Dart 移植) | 与桌面版 algorithm 对齐，WGS84 椭球 |
| GPX 解析 | fast-xml-parser (Dart 移植) | 与桌面版解析逻辑对齐 |

### 2.2 WebView ↔ Flutter 桥接协议

```dart
// Flutter → WebView (MethodChannel: 'ridgeline/webview')
{'type': 'init', 'data': {'routeId': ..., 'segments': ..., 'camera': ...}}
{'type': 'update', 'data': {'selected': ..., 'live': ...}}
{'type': 'destroy', 'data': {}}

// WebView → Flutter (JS Bridge: window.__ridgeline__)
{'type': 'ready', 'data': {}}
{'type': 'error', 'data': {'message': ...}}
{'type': 'click', 'data': {'lon': ..., 'lat': ...}}
```

### 2.3 原生定位适配

```kotlin
// 前台服务核心逻辑
class RidgelineLocationService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // 创建前台通知
        // 启动 FusedLocationProvider 持续定位
        // 每次位置更新 → 轨迹匹配 → 偏航判断 → 声音/振动提醒
        // 状态变化 → MethodChannel → Flutter UI
        return START_STICKY
    }
}
```

---

## 3. 开发环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Flutter SDK | 3.16+ | Dart 3.2+ |
| Android SDK | API 34 (Android 14) | compileSdk 34 |
| minSdk | 29 (Android 10) | 最低支持版本 |
| Node.js | 22.12+ | CesiumJS 构建 |
| Android Studio | 2023.3+ | 原生开发调试 |

---

## 4. 测试策略

### 4.1 功能测试矩阵

| 场景 | 设备 | 网络 | 预期 |
|---|---|---|---|
| 首次定位授权 | Redmi Note 13 | Wi-Fi | 弹出权限请求，拒绝后显示提示 |
| 锁屏持续定位 | Redmi Note 13 | 移动网络 | 60 分钟持续定位，偏航提醒可触发 |
| 省电模式 | Redmi Note 12 | Wi-Fi | 定位精度下降但可恢复 |
| 系统回收恢复 | Redmi Note 13 | Wi-Fi | 进程被杀后显示"引导已中断"，可恢复 |
| 离线冷启动 | Redmi Note 13 | 断网 | 加载已保存路线，显示二维路线 |

### 4.2 性能基准

| 指标 | 目标 | 测量方法 |
|---|---|---|
| 5 万点 GPX 解析 | ≤3 秒 | Dart Isolate 计时 |
| 三维瓦片首屏 | ≤5 秒 | 网络监控 |
| 交互帧率 | p95 ≤33ms | Flutter DevTools |
| 连续定位 60 分钟 | 电池消耗 ≤15% | 充电测试 |
| 内存峰值 | ≤300MB | Android Profiler |

---

## 5. 后续任务依赖

| 依赖任务 | 说明 |
|---|---|
| T-04 定位→匹配→锁屏闭环 | 实现前台定位服务 + WebView 桥接 + 偏航提醒 |
| T-05 离线核心验收 | 定义离线场景验收标准 |
| T-09 性能测试 | 在目标设备执行性能基准 |

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| WebView 内存泄漏 | 中 | 高 | 严格生命周期管理，每次切换地图销毁 WebView |
| 前台服务被系统限制 | 中 | 高 | 用户引导开启"后台运行"权限 |
| CesiumJS 性能不足 | 低 | 中 | 按需加载三维，行进时默认二维 |
| 高德 SDK 与 Flutter 冲突 | 低 | 中 | 高德"前往起点"使用 Intent 而非 SDK |

---

## 7. 变更记录

| 日期 | 变更 | 决策人 |
|---|---|---|
| 2026-10-09 | 初始决策：小米系列 + Android 10+ + Flutter/WebView/CesiumJS | AI 辅助，用户确认 |
