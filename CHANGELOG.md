# 更新日志

## v0.3.14 - 2026-11-13

自动化循环**锁生命周期加固**（周期 5）：收口周期 4 发现的陈旧锁问题（R-008），并修复驱动收尾覆盖 PM agent 状态字段与硬编码相对路径缺陷（R-009）。

---

### 🐛 修复

| 项 | 说明 |
|---|---|
| **早退路径留下陈旧锁**（R-008） | `run-cycle.sh` 的 EXIT trap 改为**条件化释放**：仅当 JSON 里 `lock.holder`/`lock.acquired_at` 仍属本进程时才写回复位，避免与并行轮互相覆盖；失败/超时/降级分支统一写 `.lock={held:false,holder:null,acquired_at:null}`，不再残留 holder |
| **陈旧锁无自愈**（R-008） | `flock` 是真互斥（进程死亡即由内核释放），抢到锁而 JSON 仍记 `held=true` 即判定为崩溃/SIGKILL 残留，驱动现在会复位 JSON 并写 WARN 审计，不再依赖人工清理 |
| **收尾覆盖 agent 状态字段**（R-009） | 驱动收尾原用 `.last_run.status=$st` 整体覆盖，会把 PM agent 写回的 `task/priority/result/gates` 冲成 null（周期 3 状态记录即因此缺失真实任务描述）；改为 jq coalesce，只兜底缺失字段 |
| **硬编码相对路径**（R-009） | `state/.cycle-N.out`、`state/READONLY`、`state/FROZEN`、`state/STOP` 原为硬编码相对路径，非仓库根调用会写错位置；`STATE/LOCK/AUDIT_DIR/AGENT_CMD/AGENT_OUT_DIR/FROZEN/STOP/READONLY` 全部改为可环境覆盖变量（默认行为不变） |

---

### ✅ 验证结果

| 门禁 | 结果 |
|---|---|
| `bash -n scripts/autocycle/*.sh tests/autocycle/*.sh` | 全部通过 |
| 锁生命周期回归 `tests/autocycle/run-cycle-lock-regression.sh`（新增） | 22/22 通过，覆盖早退/陈旧锁接管/收尾字段保留/并发抢锁 skip/agent 失败/硬超时 6 类路径 |
| `npm test` | 68/68 通过 |
| `npm run test:server` | 6/6 通过（首跑与复跑均通过，R-007 未复现） |
| `npm run build` | 通过 |
| `guards.sh` | 通过（无密钥/保护文件/本地路径，调试代码命中 0） |

> 新增回归脚本通过 `AUTOCYCLE_*` 环境变量在沙箱副本上执行，不触碰真实 `state/`；已确认未产生 `.tmp` 残留或越界写入。

---

## v0.3.13 - 2026-11-13

自动化开发循环驱动修复：PM agent 触发调用方式错误导致周期 1/2 全部失败，本轮定位并修复，自动循环首次跑通。

---

### 🐛 修复

| 项 | 说明 |
|---|---|
| **PM agent 触发参数切分** | `run-cycle.sh` 原用 `dsh headless --profile web "$PROMPT"`，多行 prompt 被当作 web profile 的应用参数，报 `too many arguments. Expected 0 arguments but got 2`，周期 1/2 均在 2s 内 rc=1 失败；改为 `printf '%s' "$PROMPT" \| dsh --profile headless -`，prompt 经 stdin 传入，规避参数切分 |
| **profile 上下文不兼容** | web profile 的 lighthouse-expert 插件在 headless 上下文报 `cannot get required service "tools" in inactive context`；改用专用 `headless` profile（`dsh-base` + `dsh-headless` + sensenova LLM 插件） |
| **凭据与环境注入** | 新增从 DSH 凭证服务读取 `SENSENOVA_API_KEY` 并仅注入本次进程环境（不落盘、不写日志）；补齐 pnpm 全局 bin 到 PATH，避免 systemd 环境找不到 `dsh` |

---

### ✅ 验证结果

| 门禁 | 结果 |
|---|---|
| `bash -n scripts/autocycle/run-cycle.sh` | 通过 |
| 周期 3 实跑 | PM agent 正常推理并完成单轮流程（周期 1/2 为 2s 内异常退出） |
| `npm test` | 68/68 通过 |
| `npm run test:server` | 6/6 通过 |
| `npm run build` | 通过 |

> 遗留：headless profile 未挂载文件/命令工具插件，agent 暂只能在轮内推理，台账与审计落盘依赖驱动/人工兜底（见 `docs/auto-cycle/risk-register.md` R-005/R-006）。

---

## v0.3.12 - 2026-11-02

Android Native 修复 GPX 解析器子元素高程/时间读取与升降迟滞缺陷，使解析结果与桌面端口径一致。

---

### 🐛 修复

| 项 | 说明 |
|---|---|
| **子元素高程/时间未读取** | `GpxParser.readPoint` 只从 `lat`/`lon` 属性读取，从未解析子元素 `<ele>`/`<time>`，导致所有轨迹点高程与时间恒为 null，`ascent`/`descent`/`min`/`max`/`duration` 恒为 null；已改为延迟到子元素读取后再落库，与桌面端 `gpx.ts`（读 `n.ele`/`n.time`）一致 |
| **升降累计无迟滞** | 高程锚点原在每点更新，导致缓坡爬升（如 100→103 逐米）不计入爬升；已改为桌面端相同的 3m 迟滞（锚点仅在 `abs(delta)>=3` 时推进），与桌面端 `gpx.ts` 一致 |
| **死代码** | 移除未使用的 `depthLimit` 函数及多余的安全调用 |

---

### 🧪 新增测试

| 项 | 说明 |
|---|---|
| **`GpxParserChildElementTest.kt`** | 新增 6 个 JVM 回归用例：子元素缓坡爬升累计、缓坡下降累计、单次跳跃累计、子元素时间与历时计算、航点子元素高程与名称、缺高程置空 |

---

### ✅ 验证结果

| 测试 | 结果 |
|---|---|
| Android Gradle `testDebugUnitTest` | 通过（`BUILD SUCCESSFUL`，25 个测试：原有 19 + 新增 6） |
| Android Gradle `assembleDebug` | 通过（`BUILD SUCCESSFUL`） |
| 桌面 `npm test` | 通过（68/68） |
| 桌面 `npm run test:server` | 通过（6/6） |
| 桌面 `npm run build` | 通过（`✓ built in 1.67s`） |

---

## v0.3.11 - 2026-11-02

Android Native 修复 GPX 解析器跨段距离与航点名称缺陷，并补充回归用例。

---

### 🐛 修复

| 项 | 说明 |
|---|---|
| **跨段距离误计** | `GpxParser.buildTrack` 的 `previousPoint` 原声明在段外，导致把上一段最后一点与下一段第一点之间的间隔（可长达上百公里）计入总距离，与“断口不连线、不计距离”的语义冲突；已改为段内声明，仅统计段内相邻点距离，与桌面 `gpx.ts` 口径一致 |
| **航点名称读取错误** | 原用 `token.attrs["name"]` 读名称，但 GPX 标准航点名在子元素 `<wpt><name>…</name>`，导致所有航点恒显示“未命名航点”；已改为在 `<wpt>` 打开时记录待定航点，并从子 `<name>` 文本捕获名称，与桌面 `gpx.ts` 一致 |

---

### 🧪 新增测试

| 项 | 说明 |
|---|---|
| **`GpxParserRegressionTest.kt`** | 新增 7 个 JVM 回归用例：跨段不连线不计距离、多段独立求和、越界坐标断段、缺高程置空、子元素航点名、单点空轨迹拒绝、20MB 超限拒绝 |

---

### ✅ 验证结果

| 测试 | 结果 |
|---|---|
| Android Gradle `testDebugUnitTest` | 通过（`BUILD SUCCESSFUL`，19 个测试：原有 12 + 新增 7） |
| Android Gradle `assembleDebug` | 通过（`BUILD SUCCESSFUL`，`34 actionable tasks: 4 executed, 30 up-to-date`） |
| 桌面 `npm test` | 通过（68/68） |
| 桌面 `npm run test:server` | 通过（6/6） |
| 桌面 `npm run build` | 通过（`✓ built in 1.53s`） |

---

## v0.3.10 - 2026-11-01

Android Native 修复导航匹配距离计算缺陷并补充核心单测。

---

### 🐛 修复

| 项 | 说明 |
|---|---|
| **`Guidance.localXY` 距离低估** | 曾用 `radians() × 111320/110574`（度/米常量），把度当作弧度使用导致所有匹配距离被低估约 57.3 倍；已改为 `radians() × 6371008.8`（地球平均半径，与桌面 `geo.ts` 一致） |

---

### 🧪 新增测试

| 项 | 说明 |
|---|---|
| **`GuidanceTest.kt`** | 新增 5 个 JVM 用例：`localXY` 米制正确性、沿路线匹配、偏航距离量级、无效精度/过期时间戳拒绝、偏航告警触发与恢复 |

---

### ✅ 验证结果

| 测试 | 结果 |
|---|---|
| Android Gradle `testDebugUnitTest` | 通过（`BUILD SUCCESSFUL`，12 个测试） |
| Android Gradle `assembleDebug` | 通过（`BUILD SUCCESSFUL`，`34 actionable tasks: 4 executed, 30 up-to-date`） |

---

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
