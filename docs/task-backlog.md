# GPX 3D Viewer 任务看板

> 维护规则：任务完成后更新状态；每个任务关联需求编号或缺陷编号；未知项保留"待补充"。
> 状态标记：⚪待开始 → 🟡进行中 → 🟢完成 / 🔴阻塞 / ⏸暂停

---

## P0 工程与发布基线

| ID | 任务 | 优先级 | 前置条件 | 交付物 | 验收标准 | 状态 |
|---|---|---|---|---|---|---|
| T-01 | 建立 Git 基线并确认敏感文件排除规则 | P0 | — | Git 仓库、.gitignore 完善 | 仓库可推送/拉取，敏感文件不入库 | 🟢完成 |
| T-02 | 完成真实高德服务端代理验证 | P0 | 用户配置 .env.server 高德凭据 | 后端代理联调记录 | /api/map-config 返回正确配置，/_AMapService 代理返回真实地图数据 | 🟢完成 |
| T-03 | 确认 Android 技术方案和目标设备 | P0 | 用户确认最低 Android 版本、目标手机型号 | 技术决策记录 | 决策写入 docs/ 并更新项目规划 | 🟢完成 |
| T-04 | 建立定位→匹配→锁屏告警最小闭环 | P0 | T-03 完成 | Android 原生定位 + WebView 桥接原型 | 锁屏定位持续工作，偏航声音/振动可触发。**验收口径已按 C-01 重闭合（周期 10）**：① **双线界定** —— `android-app`(Flutter) 定位走真实 GNSS（`RidgelineLocationService.kt` 用 `FusedLocationProviderClient` + `PRIORITY_HIGH_ACCURACY`，前台服务 `START_STICKY`，EventChannel `ridgeline/location`，`AlertPlayer.kt` 声音 `RingtoneManager`+振动 `Vibrator`，Manifest 含 `FOREGROUND_SERVICE_LOCATION`/`VIBRATE`/`WAKE_LOCK`）；`android-native` 定位恒为 `LocationFix.Source.SIMULATION`（`MainActivity.kt:115`），Manifest **无 `<service>`**、无 `Vibrator`/`Ringtone`/`LocationManager`/SQLite。② **真机锁屏端到端复验未取证**（headless 无真机），该子项改判为未完成并入 T-13/T-14。③ 偏航告警「声音/振动可触发」在当前 `android-app` **未成立**（静态可证断裂，见 R-015/B-11） | 🟢完成（**仅原型级**：定位匹配桥接原型成立；真机锁屏复验 + 告警触发链路未闭环，见 C-01 / R-014 / R-015） |
| T-05 | 定义离线核心验收场景 | P0 | T-03 | 离线验收测试用例 | 验收标准明确，含无网络冷启动、路线读取、定位引导 | 🟢完成 |
| T-06 | 验证并修复第6章代码检查问题 | P1 | — | Bug 修复 + 回归测试 | B-01~B-08 全部完成 | 🟢完成 |
| T-07 | 同步 README 与当前实际能力 | P1 | — | README.md 更新 | README 准确反映 v0.2 功能、地图选项、后端能力 | 🟢完成 |
| T-08 | 建立自动化质量门禁 | P1 | T-01 | CI 配置（GitHub Actions） | npm test + npm run build + npm run test:server 在 PR 上自动执行 | 🟢完成 |
| T-09 | 进行大轨迹及目标设备性能测试 | P1 | T-03 | 性能基准报告 | 1万/5万/20万点轨迹在目标设备的解析耗时、内存、帧率 | 🟡进行中 |

---

## P1 Bug 修复

| ID | Bug | 优先级 | 描述 | 验收要求 | 状态 |
|---|---|---|---|---|---|
| B-01 | 定位过期后保留旧位置标记 | P1 | 过期处理主要更新状态文字，旧标记不消失 | 统一判定有效位置，失效标记有明确处理 | 🟢完成 |
| B-02 | 定位期间分段/进度控件未禁用 | P1 | 控件表现与实际可操作状态不一致 | 控件表现与实际状态一致 | 🟢完成 |
| B-03 | Canvas 选点断段边界可能选错 | P1 | 仅传累计里程，共享里程断段端点可能选错段 | 同时传递分段身份并补端到端回归 | 🟢完成 |
| B-04 | 定位校验条件不一致 | P1 | 位置展示层与 Guidance 校验条件不同 | 时间、精度、坐标校验统一 | 🟢完成 |
| B-05 | 高德视图未展示 GPX 航点 | P1 | 高德适配器缺少航点渲染 | 补齐航点显示或明确说明不支持 | 🟢完成 |
| B-06 | /api/usage 跨日统计口径 | P2 | 跨 UTC 日但无新请求时仍显示上一日计数 | 查询时也按当前日更新统计口径 | 🟢完成 |
| B-07 | 文档落后于实际功能 | P1 | README 等文档未反映 v0.2 新能力 | README 与代码一致（同 T-07） | 🟢完成 |
| B-08 | 多轨迹删除后重导入回归缺失 | P1 | 修复已有但浏览器端端到端回归未闭环 | 保留已有重命名并恢复缺失路线 | 🟢完成 |
| B-11 | `android-app` 偏航告警触发链路断裂 | P1 | Dart 侧 `lib/main.dart:179` `_playAlert()` 调 `SystemChannels.platform.invokeMethod('ridgeline/playAlert')` —— 走的是 Flutter 系统 platform channel（`flutter/platform`），不识别自定义方法，抛异常被 `catch (_)` 静默吞掉；原生侧 `MainActivity.kt:40` `locationService` 字段声明后**从未赋值**恒为 null，`"playAlert"` 分支（:110）`locationService?.handleMethodCall(...)` 空安全跳过、`getLocationServiceState`（:114）恒 false。二者叠加 → `AlertPlayer.play()` 永不可达 | ①`lib/main.dart` 改调 `_methodChannel.invokeMethod('playAlert')`；②`MainActivity` 持有真实服务引用（bind 或静态可达）使 `playAlert`/`getLocationServiceState` 生效；③补告警链路断言 + `flutter analyze` 与 Gradle `assembleDebug` 通过 | 🔴阻塞（缺 Flutter/Android SDK 工具链，headless 无法编译验证，禁盲改不可验证代码） |

---

## P1 功能增强

| ID | 需求 | 优先级 | 描述 | 验收要求 | 状态 |
|---|---|---|---|---|---|
| R-107 | 路线搜索、排序与管理增强 | P1 | 路线库添加搜索框和排序下拉 | 按名称搜索过滤、按名称/导入时间/距离排序、响应式布局 | 🟢完成 |
| R-106 | 行进轨迹记录与导出 | P1 | 记录实际行走轨迹并导出 GPX | 行进中记录坐标、速度、时间；结束后可导出为 GPX | 🟢完成 |
| R-112 | 打开外部地图前往路线起点 | P1 | 从路线起点打开高德/百度地图导航 | 支持跳转高德、百度地图 App；未安装时有提示 | 🟢完成 |

---

## P1/P2 开发任务（自动循环候选池）

> 由 cycle 6 治理轮从基线文档 + 代码只读核查梳理，每项均标注依据，非凭空生成。
> 状态标记同上。这些是 18:20 起整点自动循环的可执行池（按 P1→P2、前置条件就绪度选取）。

| ID | 任务 | 优先级 | 方向 | 前置条件 | 验收标准（摘要） | 依据 | 状态 |
|---|---|---|---|---|---|---|---|
| T-10 | Android 目标设备性能基准与报告 | P1 | T-09 真机收尾 | T-13 至少可运行 | ≥1 中端+1 低配真机记录：5万点解析≤3s 可取消、1万显示点 p95 帧耗时≤33.3ms、连续定位 60min 电池≤15%、内存峰值≤300MB、冷启动≤3s；报告落 docs/performance-t09-device.md | performance-t09-desktop.md 结论段；决策-Android §4.2；规划 §8.1 | ⚪待开始 |
| T-11 | 离线验收 P0 用例落地执行（O-01/02/03/05/08） | P1 | 离线验收 | T-13/T-14/T-15 | O-01/02/03/05/08 各出执行记录（飞行模式、截图/日志），勾掉离线验收场景 §4.1；O-03 偏离 150m 告警/回 20m 清除；O-05 锁屏 10min 时间戳持续更新；O-08 重启显示"引导已中断"可恢复 | 离线验收场景 §2、§4.1；管理文档 §1.2 | ⚪待开始 |
| T-12 | 离线验收 P1 用例落地执行（O-04/06/07/09/10） | P2 | 离线验收 | T-11 完成 | 逐用例执行记录+勾选 §4.2；O-04 三维失败提示不崩溃；O-06 不误报偏航；O-07 精度>35m 提示仍可偏航；O-09 联网恢复无重复请求；O-10 空间不足不损坏数据 | 离线验收场景 §4.2；管理文档 §4.4 | ⚪待开始 |
| T-13 | android-native 真机定位链路（前台服务+锁屏+真实 GNSS） | P1 | Android 首版 | 真机可部署 debug APK | 导入后"开始引导"位置来自真实 GNSS（Source≠SIMULATION）；锁屏 10min 时间戳持续更新；进程被杀重启显示"引导已中断"；拒绝/撤权有明确状态与恢复；前台通知显示定位状态 | 决策-Android §2.3；规划 §7；实测 android-native 仅 SIMULATION、无 Service | ⚪待开始 |
| T-14 | android-native 偏航声音/振动提醒与锁屏端到端 | P1 | Android 首版 | T-13 | 偏离超 max(40m,2×accuracy) 连续 5s 触发声音+振动；锁屏可感知；回 20m 持续 3s 清除；提供"停止提醒"；无路口语义不虚构转向口令 | 规划 §7；阶段验证 v0.2 户外首版 P0；管理文档 §4.4；实测无声音/振动实现 | ⚪待开始 |
| T-15 | android-native 本地轨迹持久化 + 离线冷启动 + 会话恢复 | P1 | Android 首版/离线 | 可与 T-13 并行 | 导入路线写本地库，杀进程重启仍在；飞行模式冷启动≤3s 加载路线库；引导中断重启显示"引导已中断"可从断点恢复；schema 带迁移版本、导入用事务 | 决策-Android §2、§2.2；规划 §2.2、§3.1、§3.2、§7；管理文档 R-006/R-007；实测无 SQLite/Room | ⚪待开始 |
| T-16 | 后端限流/统计持久化与用量额度告警 | P2 | 后端 | 明确 D-04/D-05 再定存储选型 | 限流计数与 UTC 日累计重启不归零（或明确记录内存+网关兜底）；达 PROXY_DAILY_LIMIT/PER_MINUTE 产生可配置告警非仅 429；/api/usage 口径与持久化一致；保留现有边界（不记录含密钥 URL、错误固定代码），回归 6 项 server 测试不回退 | 后端与部署 §限流（内存、重启清零）及末段"无自动告警"；管理文档 R-110、A-07 | ⚪待开始 |
| B-09 | 文档漂移收口 | P1 | 文档一致性 | — | README 版本号与 package.json 一致；管理文档 §1.2 Git 相关行按实际更正；§5 里程碑状态与 T-01/T-07/T-08 完成态对齐；T-04 加注 android-app 真机 vs android-native 模拟界定（联动 C-01）；CHANGELOG/README/package.json 三者版本一致 | README L5（写 v0.3.12，实际 0.3.14）；管理文档 §1.2"不是 Git 仓库"与实际矛盾、§5 M1 标未完成但 T-08 已完成 | 🟢完成（周期 8：三方版本统一 0.3.16；README 补 v0.3.13–16 记录；管理文档 §1.2 Git 行、§5 M1/M2、§5.1 T-01/T-04/T-07/T-08 按实际更正；残留漂移转 R-013） |
| C-01 | 重新闭合 T-04 验收口径 | P1 | 治理 | — | backlog T-04 明确区分 android-app（Flutter 真实定位，EventChannel ridgeline/location）与 android-native（仅 SIMULATION）两条线，附实测证据；给真机锁屏闭环复验结论或改判进行中；风险台账补登"模拟闭环被误认真机闭环"（对应 K-01） | backlog T-04 标🟢完成 + 变更记录 2026-10-09 仅提 android-app；实测 android-native 无定位/声音/持久化；管理文档 K-01 | 🟢完成（周期 10：backlog T-04 双线界定 + 附代码级实测证据（android-app FusedLocationProviderClient/START_STICKY/EventChannel ridgeline/location/AlertPlayer vs android-native SIMULATION、Manifest 无 `<service>`）；真机锁屏复验**未取证** → 改判未完成并入 T-13/T-14（不伪造真机结果）；风险台账新增 R-014（模拟闭环被误认真机闭环，K-01）与 R-015（android-app 偏航告警链路断裂）→ 转 B-11；管理文档 K-01 同步加注） |
| B-10 | 管理文档残留漂移收口 | P1 | 文档一致性 | — | 管理文档 §1.2 工作目录按实际更正；§1.3 移动端目标按 android-app/android-native 双线实际补全；§6.1 测试证据按实跑更正（前端/后端/Android JVM）；§8 K-06 更正「不是 Git 仓库」；项目版本真源对齐 package.json | risk-register R-013（周期 8 有意遗留，建议独立小粒度轮收口） | 🟢完成（周期 9：§1.2 工作目录 `/home/ubuntu/gpx-3d-viewer` + HEAD 提交数改真源引用；项目版本 0.3.12→0.3.16 对齐 package.json；§1.3 移动端双线补全；§6.1 前端 68/68、后端 6/6、新增 Android JVM 25/25；§8 K-06 改「已缓解+残留无 tag」；R-013 关闭） |

**选取约束（对自动循环）**：
- T-13/T-14/T-15/T-10/T-11 需 Android 真机，headless agent 无法自动执行真机步骤 → 这些在自动循环里标 `blocked`（缺真机），**不得**由 agent 凭空伪造真机结果；仅可做其可自动化的子项（如补单测、补文档、补 CI 校验）。
- ~~B-09~~（周期 8 已完成）、~~B-10~~（周期 9 已完成）、~~C-01~~（周期 10 已完成）为已收口的文档/治理项；**剩余可自动执行候选仅 T-16**（代码/文档侧，前置 D-04/D-05 存储选型待明确）。
- **B-11**（周期 10 新登记，`android-app` 偏航告警链路断裂）为静态可定位的 P1 缺陷，但修复需 Flutter/Android SDK 工具链做编译/构建验证，headless 缺工具链 → 标 `blocked`，禁盲改不可验证代码（R-015）。
- 详见 `docs/auto-cycle/CHARTER.md` §4.2（无可验证验收项不得启动）与 §3.5（无任务标 skipped）。

---

## P2 候选任务（待确认需求）

| ID | 任务 | 优先级 | 当前状态 | 状态 |
|---|---|---|---|---|
| R-201 | AI 助手 | P2 | 未实现，需明确问题、数据边界与费用 | ⏸暂停 |
| R-202 | 大语言模型配置 | P2 | 待 AI 需求确认后设计 | ⏸暂停 |
| R-203 | 产品内 Skill 体系 | P2 | 待确认执行权限和治理 | ⏸暂停 |
| R-204 | 账号、云同步与多人共享 | P2 | 待明确公开运营范围 | ⏸暂停 |
| R-205 | 自定义三维模型/3D Tiles 导入 | P2 | 待确认 | ⏸暂停 |
| R-206 | iOS 版本 | P2 | Android 首版验收后评估 | ⏸暂停 |

---

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-29 | 创建任务看板，从项目综合管理文档提取任务/缺陷；T-01 标记完成（Git 基线已建立） |
| 2026-10-09 | T-02 完成：.env.server 配置高德凭据，后端代理联调验证通过（6/6 后端测试、30/30 前端测试、TypeScript 构建通过） |
| 2026-10-09 | T-03 完成：确认 Android 目标设备（小米系列）、最低版本（Android 10/API 29）、技术架构（Flutter + WebView + CesiumJS），决策文档 docs/决策-Android技术选型.md |
| 2026-10-09 | T-04 完成：Flutter Android 工程创建，前台定位服务 + WebView 桥接 + 导航匹配（Dart 移植）+ 偏航告警（声音/振动），最小闭环原型 android-app/ |
| 2026-10-09 | T-05 完成：定义 10 个离线验收场景（离线冷启动、GPX 导入、定位引导、锁屏定位、进程恢复等），文档 docs/离线验收场景-v1.0.md |
| 2026-10-09 | T-07 完成：README 全面更新，反映 Android 原型、P0 完成状态、任务看板链接 |
| 2026-10-09 | B-01~B-05 完成：定位过期清标记、定位期间控件禁用、Canvas 选点分段索引、定位校验统一、高德航点渲染 |
| 2026-10-09 | T-08 完成：GitHub Actions CI 工作流（测试、构建、类型检查、密钥扫描） |
| 2026-10-19 | R-107 完成：路线搜索（按名称过滤）、排序（按名称/导入时间/距离）、路线项增强（显示导入日期），新增 9 个排序测试，测试总数 41 个 |
| 2026-10-19 | R-112 完成：外部地图导航（高德/百度/Apple/Google），新增 external-nav.ts 模块和 11 个测试，测试总数 52 个 |
| 2026-10-19 | R-106 完成：浏览器定位轨迹记录与 GPX 导出，新增 TrackRecorder/gpx-export 模块和 16 个测试，测试总数 68 个 |
| 2026-10-19 | T-09 部分完成：新增桌面 GPX 解析性能基准 benchmark/gpx-parse.bench.test.ts，记录 1万/5万/20万点解析结果；真机内存、帧率仍待补 |
| 2026-11-01 | T-09 桌面基准补强：基准扩展为解析+2D 几何精简（simplifyLine/localXY）+内存测量（--expose-gc），10k/50k/200k 点解析 318/1155/4382 ms、堆增长 26/69/192 MB、几何精简 0.2/52.8/120.4 ms；真机帧率/内存仍待补 |
| 2026-10-19 | 新增 `android-native/` 原生 Android 工程骨架，包含模型、GPX 解析、导航匹配、Manifest、MainActivity 和 JVM 测试入口；本地 Kotlin 核心编译与 `GpxParserTest` 2/2 通过；Gradle/APK 构建待标准环境 |
| 2026-10-23 | Android Native Gradle 链路验证：`AGP 8.6.1 + Gradle 8.7` 下 `testDebugUnitTest` 与 `assembleDebug` 通过，生成 Debug APK；仍待真机安装、签名发布、完整地图 UI/定位功能 |
| 2026-10-24 | Android Native GPX 导入最小 UI 完成：接入文件选择器，解析 GPX 后展示路线名称、点数、距离、累计升降、海拔范围和警告；Android JVM 测试 4/4 通过，Debug APK 构建通过 |
| 2026-10-24 | Android Native 模拟导航最小 UI 完成：导入后可点击模拟定位推进，展示导航状态、距路线距离、行点里程、偏航提醒和下一参考点；Android JVM 测试 7/7 通过，Debug APK 构建通过 |
| 2026-11-01 | Android Native 修复 `Guidance.localXY` 度/弧度距离低估约 57.3 倍缺陷（改用地球平均半径 6371008.8，与桌面 `geo.ts` 一致）；新增 `GuidanceTest` 5 个用例覆盖公式与偏航状态机；Android JVM 测试 12/12 通过，Debug APK 构建通过 |
| 2026-11-02 | Android Native 修复 GPX 解析器跨段距离误计（`previousPoint` 原在段外，把段间上百公里间隔计入总距离，与“断口不连线”语义冲突；改为段内声明，与桌面 `gpx.ts` 一致）和航点名称读取错误（原读属性，应读子元素 `<wpt><name>`，导致恒为“未命名航点”；改为捕获子元素文本）；新增 `GpxParserRegressionTest` 7 个用例；Android JVM 测试 19/19 通过，Debug APK 构建通过 |
| 2026-11-02 | Android Native 修复 GPX 解析器子元素高程/时间未读取（`readPoint` 只读 `lat`/`lon` 属性，从不读子元素 `<ele>`/`<time>`，导致高程/时间恒为 null、`ascent`/`descent`/`min`/`max`/`duration` 恒为 null；改为延迟到子元素读取后再落库，与桌面 `gpx.ts` 一致）和升降累计无迟滞（高程锚点原每点更新，缓坡爬升不计入爬升；改为与桌面一致的 3m 迟滞，锚点仅在 `abs(delta)>=3` 时推进）；新增 `GpxParserChildElementTest` 6 个用例；Android JVM 测试 25/25 通过，Debug APK 构建通过 |
| 2026-11-13 | 自动化循环驱动修复（周期 3）：`run-cycle.sh` 触发 PM agent 的调用方式错误（多行 prompt 被当作 web profile 应用参数 + lighthouse-expert 插件在 headless 上下文缺 tools 服务），周期 1/2 均在 2s 内失败；改为 `printf '%s' "$PROMPT" \| dsh --profile headless -`（stdin 传 prompt）并注入 `SENSENOVA_API_KEY`/PATH；周期 3 实跑 agent 正常推理，自动循环首次跑通。门禁：前端 68/68、服务端 6/6、build 通过。遗留 headless 无文件工具（risk-register R-005/R-006） |
| 2026-11-13 | 自动化循环锁生命周期加固（周期 5，对应 risk-register R-008 已关闭 / R-009 已缓解）：EXIT trap 条件化释放防并行轮互覆盖、失败/超时/降级路径统一清空 holder、抢锁后增加陈旧锁接管自愈、收尾改 jq coalesce 不再覆盖 PM agent 写回的 task/priority/result/gates、`STATE/LOCK/AUDIT_DIR/AGENT_CMD/AGENT_OUT_DIR/FROZEN/STOP/READONLY` 改为可环境覆盖变量；新增回归 `tests/autocycle/run-cycle-lock-regression.sh` 22/22 通过。门禁：bash -n 全通过、前端 68/68、服务端 6/6（首跑+复跑）、build、guards.sh 通过 |
| 2026-11-13 | 自动化循环运行时 PATH 收口（周期 7 resume 续跑周期 6 rc=127 遗留，对应 risk-register R-012 已关闭）：`gpx-autocycle.service`/`gpx-autocycle-archive.service` 显式声明补齐 node+dsh 的 `Environment=PATH`；`run-cycle.sh` 改幂等循环同时前置 `~/.local/node/bin` 与 `~/.local/share/pnpm`；抢锁前新增依赖预检（`AUTOCYCLE_REQUIRE_BINS` 可覆盖）缺失即快速失败且不抢锁/不写状态机；新增回归 `tests/autocycle/runtime-path-regression.sh` 31/31 通过。门禁：bash -n 全通过、锁回归 22/22、前端 68/68、服务端 6/6、build、guards.sh 通过。B-09（README 版本漂移）仍未收口 |
| 2026-11-13 | B-09 文档漂移收口完成（周期 8 new 轮）：`package.json`/`README.md`/`CHANGELOG.md` 三方版本统一 `0.3.16`；README 首屏注明版本真源为 `package.json` 并补齐 v0.3.13–v0.3.15 变更记录；管理文档 §1.2 Git 三行按实际更正（仓库/origin/分支/35 提交/无 tag）、§5 M1「未完成→基本达成」与 M2「未启动→部分完成」对齐 backlog 完成态、§5.1 T-01/T-07/T-08 标完成且 T-04 补 android-app（真机）/android-native（SIMULATION）界定。门禁：三方版本一致、README 版本表无断号、前端 68/68、服务端 6/6、build、guards.sh 通过。残留基线文档漂移转登记 R-013，C-01 仍开放 |
| 2026-11-13 | B-10 管理文档残留漂移收口完成（周期 9 new 轮，关闭 R-013）：管理文档 §1.2 工作目录 `E:\project\gpx-3d-viewer`→`/home/ubuntu/gpx-3d-viewer`、HEAD 提交数 35 改为真源引用（`git rev-list --count HEAD`，当时 36）防固化漂移；项目版本真源 0.3.12→0.3.16 对齐 `package.json`；§1.3 移动端目标「尚未落地」→android-app/android-native 双线实际补全（锁屏真实 GNSS/声音振动/持久化仍标未实现，指向 T-13/14/15）；§6.1 测试证据按周期 9 实跑更正（前端 30→68/68、后端补 6/6、新增 Android JVM 25/25 行、26/30 历史快照不可与当前混同）；§8 K-06「当前不是 Git 仓库」→「已缓解（仓库存在）+ 残留无 tag」。门禁：前端 68/68、服务端 6/6、guards.sh 通过。C-01 仍开放，为下一文档治理候选 |
| 2026-11-13 | C-01 重闭合 T-04 验收口径完成（周期 10 new 轮）：**T-04 由单一「🟢完成」改为「仅原型级」双线界定** —— `android-app`(Flutter) 定位走真实 GNSS（`FusedLocationProviderClient`+`PRIORITY_HIGH_ACCURACY`、前台 `START_STICKY`、EventChannel `ridgeline/location`、`AlertPlayer` 声音+振动、Manifest `FOREGROUND_SERVICE_LOCATION`/`VIBRATE`/`WAKE_LOCK`）；`android-native` 定位恒为 `LocationFix.Source.SIMULATION`、Manifest 无 `<service>`、无 `Vibrator`/`Ringtone`/SQLite。**真机锁屏端到端复验未取证 → 改判未完成并入 T-13/T-14**（headless 无真机，严禁伪造）。代码只读核查另发现 `android-app` 偏航告警触发链路静态可证断裂（Dart 走错 channel + `MainActivity.locationService` 永不赋值）→ 新增 **B-11**(P1，标 blocked 缺 Flutter/Android SDK) 与 **R-015**；「模拟闭环被误认真机闭环」正式登记为 **R-014**（对应管理文档 K-01，K-01 行同步加注）。剩余可自动执行候选仅 T-16 |
