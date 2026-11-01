# 更新日志

## v0.3.9 - 2026-11-01

T-09 桌面性能基准补强。

---

### 📈 基准扩展

| 项 | 说明 |
|---|---|
| **几何精简基准** | 新增 2D 渲染几何精简（`simplifyLine` + `localXY`）耗时测量，作为真机帧率的桌面近似 |
| **内存测量** | 基准以 `--expose-gc` 运行，记录解析后堆增长 |
| **结果记录** | 10k/50k/200k 点：解析 318/1155/4382 ms，堆增长 26/69/192 MB，几何精简 0.2/52.8/120.4 ms |

---

### 🧪 验证结果

| 测试 | 结果 |
|---|---|
| 基准运行（benchmark/gpx-parse.bench.test.ts） | 通过（`node --expose-gc`） |
| 桌面前端测试 | 68/68 通过 |
| 后端测试 | 6/6 通过 |
| TypeScript 构建 | 通过 |

---

## v0.3.8 - 2026-10-24

Android Native 模拟导航匹配最小 UI。

---

### 📱 新增

| 项 | 说明 |
|---|---|
| **模拟导航入口** | 导入 GPX 后，点击现有定位按钮可逐个使用路线参考点生成模拟定位 |
| **导航状态展示** | 显示沿路线/偏航/不确定状态、距路线距离、行点里程、偏航提醒和下一参考点 |
| **状态格式模块** | 新增 `GuidanceStatus.kt`，集中处理导航匹配结果文案和下一参考点选择 |
| **JVM 单测补充** | 新增 `GuidanceStatusTest.kt`，覆盖下一参考点选择、沿路线状态和偏航提醒文案 |

---

### 🧪 验证结果

| 测试 | 结果 |
|---|---|
| Android Gradle `testDebugUnitTest` | 通过（`BUILD SUCCESSFUL`，`27 actionable tasks: 3 executed, 24 up-to-date`，7 个测试） |
| Android Gradle `assembleDebug` | 通过（`BUILD SUCCESSFUL`，`34 actionable tasks: 1 executed, 33 up-to-date`） |
| 桌面前端测试 | 68/68 通过 |
| 后端测试 | 6/6 通过 |
| TypeScript 构建 | 通过 |

---

### 🚧 当前边界

- Android Native 仍不含地图渲染，模拟导航只按导入路线点逐个生成测试定位。
- 未接入前台定位服务、权限请求、真实 GPS 持续定位、通知或振动。
- Debug APK 未真机安装、未签名发布、未混淆，也未上传正式渠道。

---

## v0.3.7 - 2026-10-24

Android Native GPX 导入与路线统计最小 UI。

---

### 📱 新增

| 项 | 说明 |
|---|---|
| **GPX 文件选择** | `MainActivity` 接入 Android Activity Result 文件选择器 |
| **导入统计展示** | 读取 GPX 后显示名称、轨迹点数、距离、累计升降、海拔范围和警告 |
| **摘要格式模块** | 新增 `RouteSummary.kt`，将 `TrackStats` 转为用户可读中文摘要 |
| **界面重构** | `activity_main.xml` 增加导入按钮、状态区、滚动统计区和警告区 |

---

### 🧪 验证结果

| 测试 | 结果 |
|---|---|
| Android Gradle `testDebugUnitTest` | 通过（`BUILD SUCCESSFUL`，`4 actionable tasks: 4 executed`，4 个测试） |
| Android Gradle `assembleDebug` | 通过（`BUILD SUCCESSFUL`，`34 actionable tasks: 8 executed, 26 up-to-date`） |
| 桌面前端测试 | 68/68 通过 |
| 后端测试 | 6/6 通过 |
| TypeScript 构建 | 通过 |

---

### 🚧 当前边界

- Android Native 仅完成 GPX 导入与统计展示，不包含地图渲染、定位、持久化或导航
- 尚未真机安装验证文件选择器在不同厂商文件管理器中的兼容性
- Debug APK 未签名发布、未混淆，也未上传正式渠道

---

## v0.3.6 - 2026-10-23

Android Native Gradle 单测与 Debug APK 构建链路验证。

---

### 🤖 新增与调整

| 项 | 说明 |
|---|---|
| **Android Native Gradle** | 调整 `AGP 8.6.1 + Gradle 8.7` 为当前可复现本地验证组合 |
| **Gradle Wrapper** | 保留 `android-native/gradlew` / `gradlew.bat`，便于标准环境执行 Android 构建 |
| **工具链说明** | 更新 Android Native 构建要求与验证记录，明确当前验证范围 |

---

### 🧪 验证结果

| 测试 | 结果 |
|---|---|
| Android Gradle `testDebugUnitTest` | 通过（`BUILD SUCCESSFUL`，`27 actionable tasks`） |
| Android Gradle `assembleDebug` | 通过（`BUILD SUCCESSFUL`，`34 actionable tasks`） |
| Debug APK 产物 | 生成 `app/build/outputs/apk/debug/app-debug.apk`，约 13 MB |
| Android `GpxParserTest` | 2/2 通过 |
| 前端/算法测试 | 68/68 通过 |
| 后端测试 | 6/6 通过 |
| TypeScript 类型检查与生产构建 | 通过 |

---

### 🚧 当前边界

- Android Native 仍是工程骨架与核心模块验证，不含完整地图 UI、真实文件选择和前台定位服务
- Debug APK 未做真机安装、签名发布或正式渠道包验证
- 若升级 Android Gradle Plugin 到 8.7.0，需要 Gradle 8.9 或 Android Studio 内置 Gradle

---

## v0.3.5 - 2026-10-19

Android Native 工程骨架补齐与 Kotlin 核心验证。

---

### 🤖 新增与修复

| 项 | 说明 |
|---|---|
| **Android Native** | 新增 `AndroidManifest.xml`、最小 `MainActivity`、`local.properties` 构建说明和本地工具链忽略规则 |
| **Kotlin 核心** | 修复 `GpxParser` / `Guidance` 编译问题、距离累计、测试期望和警告清理 |

---

### 🧪 验证结果

| 测试 | 结果 |
|---|---|
| Android Kotlin 核心 JVM 编译 | 通过（`-Werror`） |
| Android `GpxParserTest` | 2/2 通过 |
| 前端/算法测试 | 68/68 通过 |
| 后端测试 | 6/6 通过 |
| TypeScript 类型检查与生产构建 | 通过 |

---

### 🚧 当前边界

- 本环境没有可用系统 Gradle Android 插件链路；本地 Gradle 发行版受 `libnative-platform.so` 原生服务加载限制
- 尚未执行 `assembleDebug`，不能声称 APK 可安装运行

---

## v0.3.3 - 2026-10-19

T-09 桌面端大轨迹解析性能基准（部分完成）。

---

### 🧪 新增基准

| 项 | 说明 |
|---|---|
| **T-09** | 新增桌面 GPX 解析性能基准，覆盖 1 万 / 5 万 / 20 万点轨迹 |

---

### 📝 实现细节

- 新增 `benchmark/gpx-parse.bench.test.ts`：调用 `parseGpx` 生成并解析合成 GPX
- 新增 `docs/performance-t09-desktop.md`：记录本轮桌面环境解析结果
- 新增 npm 脚本：`npm run bench:parse`
- 保留边界说明：桌面解析结果不能替代真机内存、帧率、发热和户外导航体验测试

---

### 📈 本轮基准结果

| 点数 | XML 大小 | 解析耗时 | 输出点数 | 距离 | 结论 |
|---:|---:|---:|---:|---:|---|
| 10,000 | 0.98 MB | 339.6 ms | 10,000 | 202.9 km | 通过 |
| 50,000 | 4.91 MB | 1140.9 ms | 50,000 | 1074.3 km | 通过 |
| 200,000 | 19.65 MB | 4261.3 ms | 200,000 | 4298.0 km | 通过 |

---

### 🚀 下一步

- T-09 真机性能、峰值内存、帧率、发热测试
- Android GPX 导入功能（需 Flutter 环境）

---

## v0.3.2 - 2026-10-19

桌面端功能增强：行进轨迹记录与导出。

---

### 🎉 新功能

| 需求 | 说明 |
|---|---|
| **R-106** | 浏览器定位时记录实际行进轨迹，停止后导出 GPX 文件 |

---

### 📝 实现细节

- 新增 `src/core/track-recorder.ts`：记录经纬度、时间、精度、高程、持续时间、距离与累计升降
- 新增 `src/core/gpx-export.ts`：将记录点导出为标准 GPX 1.1 XML
- 导航面板新增轨迹记录按钮与状态：开始/停止记录、实时点数、距离
- 停止记录后弹出导出对话框，可修改 `.gpx` 文件名并下载
- 新增 `tests/track-recorder.test.ts`：16 个单元测试覆盖记录器、统计口径与 GPX 导出
- 高程累计升降沿用 3 米滞回锚点；缺少高程时升降为 `null`

---

### 🧪 测试结果

| 测试 | 结果 |
|---|---|
| 前端/算法测试 | 68/68 通过（含新增 16 个轨迹记录/导出测试） |
| 后端测试 | 6/6 通过 |
| TypeScript 类型检查 | 通过 |
| 生产构建 | 通过 |

---

### 🚀 下一步

- T-09 性能测试（需要真机设备）
- Android GPX 导入功能（需 Flutter 环境）

---

## v0.3.1 - 2026-10-19

桌面端功能增强：外部地图导航支持。

---

### 🎉 新功能

| 需求 | 说明 |
|---|---|
| **R-112** | 打开外部地图前往路线起点：支持高德、百度、Apple、Google 四种地图服务 |

---

### 📝 实现细节

- 新增 `src/core/external-nav.ts`：外部地图 URL 生成模块
- 路线操作区新增导航按钮，点击弹出对话框
- 对话框显示路线起点坐标，提供四个地图服务入口
- 点击服务后在新窗口打开步行导航页面（`_blank` + `noopener`）
- 坐标统一保留 6 位小数精度，名称自动编码
- 新增 `tests/external-nav.test.ts`：11 个单元测试覆盖 URL 生成逻辑
- 响应式布局：桌面端对话框最大 420px，窄屏自动适配

---

### 🧪 测试结果

| 测试 | 结果 |
|---|---|
| 前端/算法测试 | 52/52 通过（含新增 11 个外部导航测试） |
| 后端测试 | 6/6 通过 |
| TypeScript 类型检查 | 通过 |
| 生产构建 | 通过 |

---

### 🚀 下一步

- R-106 行进轨迹记录与导出
- T-09 性能测试（需要真机设备）
- Android GPX 导入功能（需 Flutter 环境）

---

## v0.3 - 2026-10-19

桌面端功能增强：路线库搜索、排序与显示优化。

---

### 🎉 新功能

| 需求 | 说明 |
|---|---|
| **R-107** | 路线搜索：按名称实时过滤路线库列表 |
| **R-107** | 路线排序：支持按导入时间（默认）、名称、距离排序 |
| **R-107** | 路线项增强：显示导入日期，便于识别 |

---

### 📝 实现细节

- 新增 `getFilteredSortedRecords()` 函数，演示路线始终置顶
- 搜索为不区分大小写的子字符串匹配
- 排序选项：`date`（按导入时间降序）、`name`（按名称升序）、`distance`（按距离降序）
- 响应式布局：桌面端搜索框+排序下拉横排，窄屏自动纵向堆叠
- 新增 `tests/library-sort.test.ts`：9 个单元测试覆盖搜索和排序逻辑

---

### 🧪 测试结果

| 测试 | 结果 |
|---|---|
| 前端/算法测试 | 41/41 通过 |
| 后端测试 | 6/6 通过 |
| TypeScript 类型检查 | 通过 |
| 生产构建 | 通过 |

---

### 🚀 下一步

- R-106 行进轨迹记录与导出
- R-112 打开外部地图前往路线起点
- Android GPX 导入功能（需 Flutter 环境）

---

## v0.2 - 2026-10-09

本次更新包含 16 个提交，完成 P0 任务 5 个、P1 任务 5 个、Bug 修复 8 个。

---

### 🎉 新功能

| 任务 | 说明 |
|---|---|
| **T-02** | 高德代理联调验证，任务看板初始化 |
| **T-04** | Flutter Android 客户端最小闭环（定位→匹配→锁屏告警） |
| **T-05** | 离线核心验收场景定义（10 个场景） |
| **T-08** | GitHub Actions CI 质量门禁 |

---

### 🐛 Bug 修复

| Bug | 说明 |
|---|---|
| **B-01** | 定位过期后清除旧标记，避免地图显示过期位置 |
| **B-02** | 定位期间禁用分段/滑块/剖面控件，保持 UI 一致性 |
| **B-03** | Canvas 选点返回分段索引，修复多段边界选错问题 |
| **B-04** | 统一定位校验条件，提取 `isValidFix` 函数 |
| **B-05** | 高德视图显示 GPX 航点标记和标签 |
| **B-06** | `/api/usage` 跨日统计口径修复，查询时自动重置日计数 |
| **B-07** | README 同步更新（同 T-07） |
| **B-08** | 多轨迹删除后重导入回归测试 |

---

### 📝 文档更新

| 任务 | 说明 |
|---|---|
| **T-03** | Android 技术选型决策文档 |
| **T-07** | README 全面更新，反映 v0.2 状态 |
| **任务看板** | 初始化并持续更新 `docs/task-backlog.md` |

---

### 🏗️ 工程改进

- 建立 Git 基线（T-01）
- 创建 GitHub Actions CI 工作流
- 新增 2 个回归测试（B-08）
- 测试总数：前端 32 个，后端 6 个

---

### 📊 当前状态

| 模块 | 状态 |
|---|---|
| 桌面浏览器版 | ✅ 完整功能 |
| Android 客户端 | 🔶 最小闭环原型 |
| 后端代理 | ✅ 高德代理可用 |
| CI 质量门禁 | ✅ 自动测试 |

---

### 🚀 下一步

- T-09 性能测试（需要真机设备）
- Android GPX 导入功能
- Android 真机测试

---

**提交范围：** `8e4a5d1` → `e1c0683`
