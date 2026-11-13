# 风险台账 (Risk Register)

> 自动化循环维护。每轮新增风险及时录入；阻断/严重缺陷必须单独登记。
> 列：ID | 类型 | 描述 | 等级 | 状态 | 发现周期 | 缓解/负责人

| ID | 类型 | 描述 | 等级 | 状态 | 发现 | 缓解 |
|---|---|---|---|---|---|---|
| R-001 | 外部依赖 | git 默认 HTTP/2 连 GitHub 不稳（GnuTLS -110 / 连接挂起），会致克隆/推送失败 | 中 | 开放 | 建设期 | 所有 git 操作强制 `-c http.version=HTTP/1.1`；推送退避重试 2 次 |
| R-002 | 进度 | 自动循环候选池曾为空（T-01~T-08、B-01~B-08 已完成，仅 T-09 进行中），循环易空转 | 中 | 已缓解 | 建设期 | 周期 6 治理轮从基线文档+代码核查梳理出 T-10~T-16、B-09、C-01 共 9 项入池（见 task-backlog「P1/P2 开发任务」节）；仍无可执行任务时按 CHARTER §3.5 标 skipped，禁止编造需求 |
| R-003 | 调度 | 会话级调度 DSH 重启即失效；systemd 常驻为唯一重启保障 | 中 | 开放 | 建设期 | 双载体冗余（会话级 + systemd），锁互斥防抢跑 |
| R-004 | 交付 | Android 户外导航首版未达交付条件（见项目综合管理文档） | 高 | 开放 | 历史 | 按 T-09→离线验收→真机门槛推进，不在自动轮里强行闯关 |
| R-005 | 调度 | 自动化驱动 `run-cycle.sh` 触发 PM agent 的调用方式错误：原 `dsh headless --profile web "$PROMPT"` 把 `headless` 与多行 prompt 当作 web profile 的应用参数，报 "too many arguments. Expected 0 arguments but got 2"，周期 1/2 均在 2s 内 rc=1 失败；且 web profile 的 lighthouse-expert 插件在 headless 上下文报 "cannot get required service tools in inactive context" | 高 | 已关闭 | 周期 3 | 改为 `printf '%s' "$PROMPT" \| dsh --profile headless -`（多行 prompt 走 stdin，避免参数切分），并注入 `SENSENOVA_API_KEY` 与 pnpm 全局 bin 到 PATH；周期 3 起 agent 正常推理。原「遗留无文件工具」判断系误诊，见 R-006 |
| R-006 | 工具链 | 【已证伪】周期 3 曾判断「headless 无文件/命令工具」，实为误诊——周期 3 真实失败原因是 R-005 的调用方式错误。实测 headless profile 经 `dsh-base` 已注册 `tool-fs`/`tool-fs-search`/`tool-bash` 等且未按 profileContext 门控：探针验证 agent 可创建/读写/删除文件、跑 `npm test` 68/68、`git commit` 本地提交 | 中 | 已关闭 | 周期 6 | 探针实测：文件写 ✓、门禁 ✓、本地 commit ✓；唯一缺口是 push 凭据，见 R-010。PM agent 可在轮内直接改文件、跑门禁、本地提交 |
| R-007 | 门禁 | `npm run test:server` 首次执行出现过 `actual 404 / expected 200` 断言失败，重跑 6/6 全通过，疑似首跑冷启动/端口时序抖动 | 低 | 观察 | 周期 3 | 下次门禁复现即升级登记；必要时排查 server 测试的启动就绪等待逻辑 |
| R-008 | 调度 | `run-cycle.sh` 早退/失败/超时路径未复位 JSON 锁标记，且部分路径仅置 `held=false` 却残留 `holder`/`acquired_at`；`flock` 已空闲而 JSON 仍记 `held=true` 会误导后续轮判读（周期 4 已实锤孤儿进程持锁致 skip） | 高 | 已关闭 | 周期 4 | 周期 5 收口：① EXIT trap 条件化释放（仅当 `holder`/`acquired_at` 仍属本进程才写回，防并行轮互覆盖）；② 抢锁后加「陈旧锁接管」检测，flock 空闲即复位 JSON 并告警；③ 失败/超时/降级路径统一写 `.lock={held:false,holder:null,acquired_at:null}`。回归 `tests/autocycle/run-cycle-lock-regression.sh` 22/22 通过 |
| R-009 | 门禁 | 驱动收尾用 `.last_run.status=$st` 整体覆盖，会把 PM agent 写回的 `task/priority/result/gates` 冲成 null（周期 3 状态记录即因此缺失真实任务描述）；另 agent 输出路径 `state/.cycle-N.out` 与 `state/READONLY` 为硬编码相对路径，非仓库根调用时会写错位置 | 中 | 已缓解 | 周期 5 | 收尾改 jq coalesce（仅兜底缺失字段，不再覆盖 agent 写入值）；`STATE/LOCK/AUDIT_DIR/AGENT_CMD/AGENT_OUT_DIR/FROZEN/STOP/READONLY` 全部改为可环境覆盖变量（默认行为不变），回归用例 3/5 验证字段保留与输出落点 |
| R-010 | 工具链 | headless agent 的 shell 无 GitHub 推送凭据：驱动仅在自身 push 时注入 token URL，不落到 agent 环境，故 agent 轮内 `git push` 报 `could not read Username`（探针周期 6 实锤）。本地 commit 正常 | 中 | 开放 | 周期 6 | 按 CHARTER §5 设计：**agent 轮内只本地 commit 到 feat/auto-cycle，推送由每日 00:00 archive-daily.sh 注入 token 完成**。PM_PROMPT 已明确「不要自行 push」。若未来需轮内即时推送，须评估 token 注入 agent 环境的泄露面（token 可能进入 agent 上下文/日志），当前不做 |
| R-011 | 交付 | 自动循环候选池中 T-10~T-15 需 Android 真机，headless agent 无法执行真机步骤，易出现「选了任务但无法推进」或更糟的「伪造真机结果」 | 中 | 开放 | 周期 6 | CHARTER §4.2 已要求可验证验收项；选取约束已在 task-backlog 标注：真机任务标 `blocked`（缺真机），agent 仅可做其可自动化子项（单测/文档/CI 校验），**严禁伪造真机结果**；优先选 B-09/C-01/T-16 等纯代码文档任务 |
| R-012 | 部署/工具链 | systemd 载体下 `PATH` 缺 `~/.local/node/bin`（node/npm）与 `~/.local/share/pnpm`（dsh），而 `dsh` 是 `#!/usr/bin/env node` 脚本 → 整点轮 agent 0s 内 rc=127 记 failed（周期 6 实锤；`run-cycle.sh` 原只前置 pnpm bin、漏 node bin，非 systemd 调用时同样可能踩） | 高 | 已关闭 | 周期 6 | 周期 7 收口：①`gpx-autocycle.service`/`gpx-autocycle-archive.service` 显式声明 `Environment=PATH=`（node bin + pnpm bin + 系统目录）；②`run-cycle.sh` 改幂等循环同时前置 node/pnpm bin（去重、目录存在才加）；③抢锁前新增依赖预检（`AUTOCYCLE_REQUIRE_BINS` 可覆盖，默认 node/jq/flock/git），缺失即 ERROR 审计并快速失败、不抢锁不写状态机。回归 `tests/autocycle/runtime-path-regression.sh` 31/31（含 `systemd-analyze verify`） |
| R-013 | 进度/文档 | 基线《项目综合管理文档》除 B-09 已收口项外仍有漂移未清：§1.2 工作目录写 `E:\project\gpx-3d-viewer`（实际 `/home/ubuntu/gpx-3d-viewer`）；§1.3 移动端目标写「尚未落地」（`android-native` 已落地骨架+解析/导航/导入 UI）；§6.1 前端测试证据写「30 项通过」（实际 `npm test` 68/68）；§8 K-06 仍写「当前不是 Git 仓库」。周期 8 按 B-09 验收范围只收口 Git 行/里程碑/T-04 界定，以上残留有意留待独立轮，避免单轮粒度过大 | 低 | 开放 | 周期 8 | 已在 B-09 变更记录与本轮输出中显式披露；下一轮可作纯文档小粒度任务（建议 ID B-10）一次性对齐工作目录/测试证据/K-06/移动端行，并与 §6.1 补 Android JVM 25/25 等真实证据；文档版本真源以 `package.json` 为准 |

## 技术债
- （暂无登记）

## 已知缺陷
- （暂无登记；门禁阻断/严重缺陷在此登记）
