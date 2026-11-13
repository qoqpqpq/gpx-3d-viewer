#!/usr/bin/env bash
# run-cycle.sh — gpx-3d-viewer 自动化开发循环：单轮驱动
# 职责：抢锁 → 读状态机 → 状态分支 → 触发 PM agent → 超时保护 → 审计落盘
# 治理依据：docs/auto-cycle/CHARTER.md
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

STATE="state/cycle-state.json"
LOCK="state/cycle-state.lock"
AUDIT_DIR="state/audit"
AUDIT="$AUDIT_DIR/audit-$(date +%F).log"
SOFT_TIMEOUT=${SOFT_TIMEOUT:-1200}   # 20min 软目标
HARD_TIMEOUT=${HARD_TIMEOUT:-2400}   # 40min 硬上限
GIT_HTTP=(git -c http.version=HTTP/1.1)
mkdir -p "$AUDIT_DIR"

# ---------- 审计（append-only，不可覆盖） ----------
audit() { # audit <level> <msg...>
  local lvl="$1"; shift
  printf '%s | %-8s | %s\n' "$(date '+%F %T')" "$lvl" "$*" >> "$AUDIT"
}
audit_json() { # 追加结构化审计（一行 JSON）
  printf '%s\n' "$1" >> "$AUDIT"
}

# ---------- 注入模型凭据（headless 需要环境变量形式的 API key） ----------
# 从 DSH 凭证服务读取，仅注入本次进程环境，不落盘、不写日志
CRED_FILE="${DSH_CREDENTIALS:-$HOME/.dsh/.credentials.yaml}"
if [ -z "${SENSENOVA_API_KEY:-}" ] && [ -r "$CRED_FILE" ]; then
  SENSENOVA_API_KEY="$(python3 -c "import yaml;print(yaml.safe_load(open('$CRED_FILE'))['refs'].get('SENSENOVA_API_KEY',''))" 2>/dev/null)"
  export SENSENOVA_API_KEY
fi
# 确保 dsh 在 PATH（systemd 环境默认不含 pnpm 全局 bin）
case ":$PATH:" in *":$HOME/.local/share/pnpm:"*) ;; *) export PATH="$HOME/.local/share/pnpm:$PATH";; esac

# ---------- 兜底模式检查 ----------
if [ -f state/FROZEN ]; then
  audit WARN "FROZEN 模式：自动周期已冻结，本轮 skip。"
  echo "[run-cycle] FROZEN：自动周期已冻结，本轮跳过。"; exit 0
fi
if [ -f state/STOP ]; then
  audit WARN "STOP：调度已被永久停止。"
  echo "[run-cycle] STOP：调度已永久停止。"; exit 0
fi

# ---------- 磁盘水位告警 (CHARTER §6.4) ----------
DISK_PCT=$(df -P "$ROOT" | awk 'NR==2{gsub("%","",$5);print $5}')
if [ "${DISK_PCT:-0}" -ge 90 ]; then
  audit ALERT "磁盘高水位：占用 ${DISK_PCT}%（阈值 90%）。"
fi

# ---------- 抢锁 (CHARTER §3.1) ----------
exec 9>"$LOCK"
if ! flock -n 9; then
  audit ALERT "锁冲突：上一轮仍在运行，本轮 skip，不并行拉起。"
  echo "[run-cycle] 锁被占用，本轮跳过（防竞态）。"; exit 0
fi

# ---------- 读状态 ----------
jq_ok() { jq -e . "$STATE" >/dev/null 2>&1; }
if ! jq_ok; then
  audit ERROR "cycle-state.json 损坏，本轮中止，等待人工。"
  echo "[run-cycle] 状态文件损坏，中止。"; exit 1
fi

MODE=$(jq -r '.mode // "auto"' "$STATE")
PREV=$(jq -r '.last_run.status // "completed"' "$STATE")
CYCLE=$(jq -r '.current_cycle // 0' "$STATE")
NEXT=$((CYCLE + 1))
DEGRADED_N=$(jq -r '.consecutive_degraded // 0' "$STATE")

audit INFO "==== 周期 $NEXT 启动 | 前一轮=$PREV | mode=$MODE ===="

# 连续 3 轮降级 → 等人工 (CHARTER §2.4)
if [ "$DEGRADED_N" -ge 3 ]; then
  audit ALERT "连续 ${DEGRADED_N} 轮模型降级，标记告警并等待人工介入，本轮阻塞。"
  jq '.last_run.status="await_confirm" | .lock.held=false' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
  exit 0
fi

# ---------- 状态分支 (CHARTER §3.2-3.4) ----------
case "$PREV" in
  await_confirm)
    audit WARN "上一轮 await_confirm：保持阻塞，等待人工确认，本轮不启动。"
    echo "[run-cycle] 上一轮等待人工确认，阻塞。"; exit 0
    ;;
  suspended)
    audit WARN "上一轮 suspended：等待人工恢复点，本轮不启动。"
    echo "[run-cycle] 人工介入中（suspended），本轮不启动。"; exit 0
    ;;
  interrupted|failed)
    audit INFO "上一轮 $PREV：优先续跑遗留。"
    MODE_LABEL="resume"
    ;;
  completed|degraded|skipped|initialized)
    audit INFO "上一轮 $PREV：启动新任务。"
    MODE_LABEL="new"
    ;;
  *)
    audit INFO "上一轮 $PREV（未知）：按新任务处理。"
    MODE_LABEL="new"
    ;;
esac

# 写入运行中状态 + 锁持有者
jq --argjson c "$NEXT" --arg t "$(date -Iseconds)" \
   '.current_cycle=$c | .lock.held=true | .lock.holder="run-cycle" | .lock.acquired_at=$t | .last_run.cycle=$c | .last_run.started_at=$t | .last_run.status="running"' \
   "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"

# ---------- 只读模式 (CHARTER §1 兜底) ----------
READONLY=0
[ -f state/READONLY ] && READONLY=1 && audit WARN "READONLY 模式：本轮只分析/记录，不改代码。"

# ---------- 触发 PM agent ----------
PROMPT="你是 gpx-3d-viewer 自动化开发 PM。严格遵循 docs/auto-cycle/CHARTER.md 执行【单轮标准流程】。
本轮周期号=${NEXT}，模式=${MODE_LABEL}。只做一轮，完成即停，禁止连续多轮。
把本轮结果按 CHARTER 第十节模板输出，并更新 state/cycle-state.json 的 last_run 与 docs/auto-cycle/risk-register.md。"
[ "$READONLY" -eq 1 ] && PROMPT="$PROMPT
【只读模式】不得修改/提交任何代码，仅分析与记录。"

audit INFO "触发 PM agent (headless)，mode=$MODE_LABEL readonly=$READONLY"
START=$(date +%s)
set +e
# 用 headless profile（已接入 sensenova）；多行 prompt 走 stdin（"-"），避免参数切分
printf '%s' "$PROMPT" | timeout --signal=TERM --kill-after=30s "$HARD_TIMEOUT" \
  dsh --profile headless - > "state/.cycle-${NEXT}.out" 2>&1
RC=$?
set -e
END=$(date +%s)
DUR=$((END - START))

# ---------- 超时/失败判定 (CHARTER §3.6) ----------
if [ $RC -eq 124 ] || [ $RC -eq 137 ]; then
  audit ALERT "周期 $NEXT 硬超时（${DUR}s ≥ ${HARD_TIMEOUT}s），强制中断、保存现场、释放锁。"
  jq --argjson c "$NEXT" --arg s "$(date -Iseconds)" --arg m "sensenova-6.8-flash" \
     '.last_run.status="interrupted" | .last_run.finished_at=$s | .last_run.model=$m | .lock.held=false | .stats.interrupted=(.stats.interrupted//0)+1' \
     "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
  audit ALERT "告警：单轮超时。"
  exit 0
fi
if [ $RC -ne 0 ]; then
  audit ERROR "周期 $NEXT agent 异常退出 rc=$RC（${DUR}s），标记 failed、释放锁。"
  jq --arg s "$(date -Iseconds)" \
     '.last_run.status="failed" | .last_run.finished_at=$s | .lock.held=false | .stats.failed=(.stats.failed//0)+1' \
     "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
  exit 0
fi

# ---------- 正常结束：以 agent 写入的状态为准，兜底置 completed ----------
FINAL=$(jq -r '.last_run.status // "completed"' "$STATE")
[ "$FINAL" = "running" ] && FINAL="completed"
jq --arg s "$(date -Iseconds)" --arg st "$FINAL" \
   '.last_run.finished_at=$s | .last_run.status=$st | .lock.held=false | .stats[$st]=(.stats[$st]//0)+1' \
   "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
audit INFO "周期 $NEXT 结束：status=$FINAL 用时=${DUR}s"

# ---------- 结构化审计落盘 ----------
jq -c --arg ts "$(date -Iseconds)" --argjson c "$NEXT" --argjson dur "$DUR" --arg mode "$MODE_LABEL" \
  '{audit:{ts:$ts,cycle:$c,duration_s:$dur,status:.last_run.status,model:.last_run.model,degrade_reason:.last_run.degrade_reason,context_compressed:.last_run.context_compressed,mode:$mode}}' \
  "$STATE" >> "$AUDIT" 2>/dev/null || true

flock -u 9
echo "[run-cycle] 周期 $NEXT 完成（$FINAL，${DUR}s）。等待下一个整点。"
exit 0