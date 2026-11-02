# 山径 · Ridgeline

GPX 路线工作台。面向中国大陆用户的户外行前规划与沿轨迹行进辅助工具。

**当前版本：** v0.3.12 桌面浏览器原型 + Android 最小闭环原型 + Android Native GPX 导入统计与模拟导航 UI

---

## 项目组成

| 模块 | 路径 | 状态 |
|---|---|---|
| 桌面浏览器版 | `/` | ✅ 完整功能 |
| Android 客户端 | `android-app/` | 🔶 最小闭环（定位→匹配→告警） |
| Android Native | `android-native/` | 🔶 原生工程骨架 + GPX 导入统计 UI + 模拟导航匹配 UI + Gradle 单测/APK 构建验证 |
| 轻量后端 | `server/` | ✅ 高德代理 + 静态服务 |
| 任务看板 | `docs/task-backlog.md` | 📋 P0 全部完成 |

---

## 桌面浏览器版

### 快速开始

```bash
# 安装依赖
npm ci --registry=https://registry.npmjs.org

# 开发模式（前端 + 后端）
npm run dev
# 访问 http://127.0.0.1:5173

# 生产构建
npm run build

# 运行测试
npm test
npm run test:server
```

### 功能清单

- **GPX 导入**：多轨、多段、rte、wpt；本地 IndexedDB 持久化
- **路线库**：重命名、删除、导出原始文件、搜索过滤、多种排序、外部地图导航
- **二维路线**：Canvas 渲染，无底图，支持拖动/缩放/点击选点
- **三维地图**：Cesium 本地资源，支持地形/影像/建筑
- **海拔剖面**：SVG 渲染，与里程滑块联动
- **行进模拟**：正反向回放，三种情境（正常/偏离/弱信号）
- **导航匹配**：WGS84 测地距离，偏航检测与告警
- **轨迹记录**：浏览器定位时记录经纬度、时间、精度与高程，停止后导出 GPX
- **地图源**：Cesium ion、天地图、高德城市地图/地形
- **后端代理**：高德安全密钥代理，防泄露

### 地图配置

点击"底图与地形"按钮配置：

| 地图源 | 说明 | 凭据 |
|---|---|---|
| Cesium 全球影像 | 三维地形 + 卫星影像 | Cesium ion token |
| 天地图 · 卫星影像 | 中文注记 | 天地图 Key |
| 天地图 · 道路地图 | 矢量道路 | 天地图 Key |
| 高德 · 城市地图 | 城市底图 + 楼块 | 高德 Key + 安全密钥 |
| 高德 · 地形 | 地形模式（测试版） | 高德 Key + 安全密钥 |
| 无底图 | 仅路线 + 高程线 | 无 |

**后端代理模式（推荐）：**
1. 复制 `.env.server.example` 为 `.env.server`
2. 填写 `AMAP_WEB_KEY` 和 `AMAP_SECURITY_CODE`
3. 重启服务，前端自动使用代理

**浏览器直连模式（开发用）：**
- 在地图设置弹窗中直接填写 Key 和安全密钥
- 安全密钥会出现在浏览器代码中，仅适合开发环境

---

## Android 客户端

### 功能

- ✅ 持续 GPS 定位（锁屏可用）
- ✅ 轨迹匹配与偏航检测
- ✅ 偏航声音 + 振动告警
- ✅ 前台服务保活
- 🔶 WebView 地图预览（需网络）
- 🔶 GPX 文件导入（待实现）

### 构建

```bash
cd android-app
flutter pub get
flutter run          # 运行到设备
flutter build apk    # 构建 APK
```

**要求：**
- Flutter 3.16+
- Android SDK API 34
- minSdk 29 (Android 10)

详见 [android-app/README.md](android-app/README.md)

---

## 工程结构

```text
/                          # 桌面浏览器版
├── src/core/              # 数据模型、GPX 解析、地理计算、轨迹匹配
├── src/adapters/          # IndexedDB 存储、浏览器定位、后端配置
├── src/ui/                # Canvas 2D、Cesium 3D、高德地图渲染
├── src/parse.worker.ts    # GPX 解析工作线程
├── src/main.ts            # 工作台界面、模拟器、交互协调
├── server/                # Node.js 轻量后端（高德代理）
├── tests/                 # 算法回归测试、合成 GPX 样例
├── docs/                  # 规划、验收、决策文档
│
├── android-app/           # Flutter Android 客户端
│   ├── lib/               # Dart 代码（UI + 导航匹配）
│   ├── android/           # Android 原生代码（定位服务 + 桥接）
│   └── web/               # WebView 地图页面
│
├── android-native/        # 原生 Android 工程骨架
│   ├── app/src/main/java  # Kotlin 模型、GPX 解析、导航匹配
│   ├── app/src/test       # JVM 单元测试入口
│   └── README.md          # 原生工程说明与构建要求
│
├── package.json           # 前端依赖
├── .env.server            # 后端环境配置（不入库）
└── 启动预览.cmd            # Windows 快速启动
```

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 桌面前端 | TypeScript + Vite 8.3 + 原生 DOM |
| 三维渲染 | Cesium 1.145.0 |
| 高德地图 | JS API 2.0 / 2.1Beta |
| 距离计算 | geographiclib-geodesic 2.2.0 |
| 后端 | Node.js 原生 HTTP |
| Android | Flutter 3.x + Kotlin |
| 定位 | FusedLocationProvider |
| 测试 | Vitest 5.0 + Node.js test |

---

## 数据及算法口径

- **GPX 格式**：1.0/1.1，多轨、多段、rte、基础 wpt
- **输入限制**：20 MB、200,000 点、128 条轨道、1,000 段
- **距离计算**：WGS84 椭球测地距离（GeographicLib）
- **高程**：保留 GPX 原值，未知垂直基准
- **累计升降**：3 米滞回锚点
- **偏离参数**：
  - 精度 > 35m 或位置 > 10s 不判断
  - 超出 max(40m, 2×精度) 连续 5s 触发
  - 回到 20m 内连续 3s 清除
- **匹配窗口**：沿线里程 ±400m 限制跨分支

---

## 当前边界

- **桌面版**：完整行前查看和模拟功能；不是可依赖的户外导航
- **Android 版**：Flutter 最小闭环原型（定位→匹配→告警）；GPX 导入、离线地图、持久化待实现
- **Android Native 版**：工程骨架、GPX 导入统计、模拟导航匹配展示、Gradle 单测和 Debug APK 构建链路已验证；不含完整地图 UI、前台定位服务、真实 GPS 持续定位和签名发布
- **离线能力**：二维路线、GPS 定位、轨迹匹配可离线；三维地图和底图需要网络
- **高德集成**：显示边界转换为 GCJ-02；GPX 数据和算法保持 WGS84

---

## 文档

| 文档 | 说明 |
|---|---|
| [项目综合管理文档](docs/项目综合管理文档.md) | 需求、风险、计划总览 |
| [产品与技术规划 v1.1](docs/产品与技术规划-v1.1.md) | 技术路线决策 |
| [后端与部署](docs/后端与部署.md) | 高德代理配置 |
| [阶段验证 v0.1](docs/阶段验证-v0.1.md) | 第一阶段验证记录 |
| [阶段验证 v0.2](docs/阶段验证-v0.2.md) | 地图与可用性检查 |
| [Android 技术选型](docs/决策-Android技术选型.md) | 设备与架构决策 |
| [离线验收场景](docs/离线验收场景-v1.0.md) | 离线功能验收标准 |
| [任务看板](docs/task-backlog.md) | 任务进度跟踪 |

---

## 开发状态

| 里程碑 | 状态 | 说明 |
|---|---|---|
| T-01 Git 基线 | 🟢完成 | 仓库初始化，敏感文件排除 |
| T-02 高德代理验证 | 🟢完成 | 后端联调通过 |
| T-03 Android 技术选型 | 🟢完成 | 小米系列 + Flutter/WebView |
| T-04 定位→锁屏闭环 | 🟢完成 | Flutter 原型完成 |
| T-05 离线核心验收 | 🟢完成 | 10 个验收场景定义 |
| T-06 Bug 修复 | 🟢完成 | B-01~B-08 全部完成 |
| T-07 README 同步 | 🟢完成 | 本文档更新 |
| T-08 CI 质量门禁 | 🟢完成 | GitHub Actions 自动测试 |
| R-107 路线搜索排序 | 🟢完成 | 搜索过滤 + 多排序 + 日期显示 |
| R-106 轨迹记录导出 | 🟢完成 | 浏览器定位记录 + GPX 导出 |
| R-112 外部地图导航 | 🟢完成 | 高德/百度/Apple/Google 四种地图服务 |
| T-09 性能测试 | 🟡进行中 | 桌面解析+几何精简基准已记录（10k/50k/200k 点）；真机帧率/内存待补 |
| Android Native GPX 导入 | 🟢完成 | Android Native 文件选择、GPX 解析与统计摘要 UI；地图/定位/发布仍待实现 |
| Android Native 模拟导航 | 🟢完成 | 导入后可模拟点击推进导航匹配状态、下一参考点与偏航提示；`Guidance.localXY` 距离公式已修复；`GpxParser` 跨段距离、航点名称、子元素高程/时间与升降迟滞缺陷已修复；真实 GPS 持续定位仍待实现 |

---

## 许可证

私有项目，仅供个人和小范围朋友使用。

---

## 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-11-02 | v0.3.12 | Android Native 修复 `GpxParser` 子元素高程/时间未读取与升降迟滞缺陷，使解析结果与桌面端口径一致；新增 `GpxParserChildElementTest` 6 个用例；Android JVM 25/25 |
| 2026-11-02 | v0.3.11 | Android Native 修复 `GpxParser` 跨段距离误计与航点名称读取缺陷；新增 `GpxParserRegressionTest` 7 个用例；Android JVM 19/19 |
| 2026-11-01 | v0.3.10 | Android Native 修复 `Guidance.localXY` 度/弧度距离低估约 57.3 倍缺陷；新增 `GuidanceTest` 5 个用例；Android JVM 12/12 |
| 2026-11-01 | v0.3.9 | T-09 桌面基准补强：新增 2D 几何精简基准与内存测量（--expose-gc），记录 10k/50k/200k 点结果 |
| 2026-10-24 | v0.3.8 | Android Native 模拟导航匹配最小 UI；新增 `GuidanceStatus` 与 3 个 JVM 测试 |
| 2026-10-24 | v0.3.7 | Android Native GPX 文件导入与路线统计 UI；新增 `RouteSummary` 与 2 个 JVM 测试 |
| 2026-10-23 | v0.3.6 | Android Native Gradle 单测与 Debug APK 构建链路验证；补充 Gradle wrapper 与工具链说明 |
| 2026-10-19 | v0.3.5 | Android Native 工程骨架：Manifest、MainActivity、Kotlin 核心编译验证 |
| 2026-10-19 | v0.3.3 | T-09 桌面 GPX 解析性能基准（1万/5万/20万点） |
| 2026-10-19 | v0.3.1 | 外部地图导航（高德/百度/Apple/Google） |
| 2026-10-19 | v0.3 | 路线搜索过滤、多排序选项、路线项增强（显示导入日期） |
| 2026-10-09 | v0.2 | README 全面更新，反映 Android 原型和 P0 完成状态 |
| 2026-09-28 | v0.1 | 初始桌面浏览器原型 |
