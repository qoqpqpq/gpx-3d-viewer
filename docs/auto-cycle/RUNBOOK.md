# 运维手册 (RUNBOOK)

自动化循环的日常运维。治理规则见 `CHARTER.md`。

## 组件
- 调度：systemd timer（常驻，重启不丢）+ DSH 会话级调度（冗余）
- 驱动：`scripts/autocycle/run-cycle.sh`（单轮）、`archive-daily.sh`（00:00 归档）
- 状态：`state/cycle-state.json`（状态机+锁）、`state/audit/`（审计日志，append-only）
- 分支：所有自动提交只进 `feat/auto-cycle`

## 常用命令
```bash
# 手动跑一轮（与整点触发等价，会抢锁）
scripts/autocycle/run-cycle.sh

# 看当前状态机
cat state/cycle-state.json

# 看今天审计
tail -f state/audit/audit-$(date +%F).log

# 一键兜底
scripts/autocycle/failsafe.sh freeze           # 冻结自动周期
scripts/autocycle/failsafe.sh readonly         # 只读模式
scripts/autocycle/failsafe.sh rollback <ref>   # 回滚（需人工确认）
scripts/autocycle/failsafe.sh stop             # 永久停止（摘除 timer）

# systemd
systemctl status gpx-autocycle.timer
sudo systemctl start gpx-autocycle.service      # 手动触发一轮
journalctl -u gpx-autocycle.service -n 50
```

## 恢复被中断的轮次
驱动读 `cycle-state.json`：若上一轮 `interrupted/failed`，下轮自动优先续跑遗留。无需人工干预，除非状态为 `await_confirm`（需人工确认）。

## 人工介入
1. 直接下指令（PM 会标 `suspended`、释放锁、优先执行）。
2. 完成后 PM 在 `CHARTER.md`「恢复点」表填一行。
3. 下一个整点自动恢复。

## 解除兜底
- 冻结解除：编辑 `state/cycle-state.json` 把 `mode` 改回 `auto`，或删 `state/FROZEN` / `state/READONLY` 标记文件。
- 永久停止后重启：`sudo systemctl enable --now gpx-autocycle.timer`。