# 风险台账 (Risk Register)

> 自动化循环维护。每轮新增风险及时录入；阻断/严重缺陷必须单独登记。
> 列：ID | 类型 | 描述 | 等级 | 状态 | 发现周期 | 缓解/负责人

| ID | 类型 | 描述 | 等级 | 状态 | 发现 | 缓解 |
|---|---|---|---|---|---|---|
| R-001 | 外部依赖 | git 默认 HTTP/2 连 GitHub 不稳（GnuTLS -110 / 连接挂起），会致克隆/推送失败 | 中 | 开放 | 建设期 | 所有 git 操作强制 `-c http.version=HTTP/1.1`；推送退避重试 2 次 |
| R-002 | 进度 | backlog 当前无新的独立粒度 P0/P1/P2（T-01~T-08、B-01~B-08 已完成，仅 T-09 性能测试进行中），自动循环易空转 | 中 | 开放 | 建设期 | 无可执行任务时按 CHARTER §3.5 标记 skipped，禁止编造需求 |
| R-003 | 调度 | 会话级调度 DSH 重启即失效；systemd 常驻为唯一重启保障 | 中 | 开放 | 建设期 | 双载体冗余（会话级 + systemd），锁互斥防抢跑 |
| R-004 | 交付 | Android 户外导航首版未达交付条件（见项目综合管理文档） | 高 | 开放 | 历史 | 按 T-09→离线验收→真机门槛推进，不在自动轮里强行闯关 |
| R-005 | 调度 | 自动化驱动 `run-cycle.sh` 触发 PM agent 的调用方式错误：原 `dsh headless --profile web "$PROMPT"` 把 `headless` 与多行 prompt 当作 web profile 的应用参数，报 "too many arguments. Expected 0 arguments but got 2"，周期 1/2 均在 2s 内 rc=1 失败；且 web profile 的 lighthouse-expert 插件在 headless 上下文报 "cannot get required service tools in inactive context" | 高 | 已缓解 | 周期 3 | 改为 `printf '%s' "$PROMPT" \| dsh --profile headless -`（多行 prompt 走 stdin，避免参数切分），并注入 `SENSENOVA_API_KEY` 与 pnpm 全局 bin 到 PATH；周期 3 验证 agent 正常推理。遗留：headless profile 尚未挂载工具类插件，agent 只能推理、暂不能直接改文件，见 R-006 |
| R-006 | 工具链 | headless profile 仅挂载 `dsh-base`/`dsh-headless` + LLM 插件，无文件/命令工具；PM agent 无法在轮内直接写 `state/cycle-state.json`、`risk-register.md` 或提交代码，CHARTER §4.7/§4.8 的台账与审计更新需由驱动或人工兜底 | 中 | 开放 | 周期 3 | 后续轮评估为 headless profile 挂载工具插件，或在 `run-cycle.sh` 内固化「轮末状态/审计写回」逻辑，避免依赖 agent 主动落盘 |
| R-007 | 门禁 | `npm run test:server` 首次执行出现过 `actual 404 / expected 200` 断言失败，重跑 6/6 全通过，疑似首跑冷启动/端口时序抖动 | 低 | 观察 | 周期 3 | 下次门禁复现即升级登记；必要时排查 server 测试的启动就绪等待逻辑 |

## 技术债
- （暂无登记）

## 已知缺陷
- （暂无登记；门禁阻断/严重缺陷在此登记）