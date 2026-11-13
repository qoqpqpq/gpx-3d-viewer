#!/usr/bin/env bash
# run-cycle-lock-regression.sh — 周期 5 锁生命周期回归（R-008 / R-009）
# 目的：在沙箱副本上验证 run-cycle.sh 的锁释放守护，不触碰真实 state/。
# 机制：通过 AUTOCYCLE_* 环境变量把 STATE/LOCK/AUDIT/agent 命令指向沙箱。
# 用法: bash tests/autocycle/run-cycle-lock-regression.sh
# 退出码: 0=全部通过  1=存在失败
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="$ROOT/scripts/autocycle/run-cycle.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/state/audit" "$WORK/out"

pass=0; fail=0
check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then
    echo "  ✅ $1 (=$3)"; pass=$((pass+1))
  else
    echo "  ❌ $1: expected=$2 actual=$3"; fail=$((fail+1))
  fi
}

ST="$WORK/state/cycle-state.json"
# 与 run-cycle.sh 的 $AUDIT_DIR/audit-$(date +%F).log 对齐
LOG="$WORK/state/audit/audit-$(date +%F).log"

env_for() { # 打桩环境：状态/锁/审计指向沙箱，agent 命令替换为空操作
  echo "AUTOCYCLE_STATE=$ST AUTOCYCLE_LOCK=$WORK/state/cycle-state.lock AUTOCYCLE_AUDIT_DIR=$WORK/state/audit AUTOCYCLE_AGENT_OUT_DIR=$WORK/out AUTOCYCLE_AGENT_CMD=$WORK/dummy-agent"
}

init_state() { # init_state <last_run.status> <lock.held>
  cat > "$ST" <<JSON
{"schema":1,"project":"t","charter":"c","branch":"feat/auto-cycle","mode":"auto",
 "current_cycle":5,"last_status":"$1","consecutive_degraded":0,"consecutive_push_failures":0,
 "lock":{"held":$2,"holder":null,"acquired_at":null},
 "last_run":{"cycle":5,"status":"$1","model":"sensenova-6.8-flash","degrade_reason":null,
   "context_compressed":false,"task":"保留我","priority":"P1","result":"保留我","gates":{"t":"68/68"}},
 "stats":{"completed":0,"interrupted":0,"failed":0,"suspended":0,"await_confirm":0,"degraded":0,"skipped":0}}
JSON
  : > "$WORK/state/cycle-state.lock"
  : > "$LOG"
  # 桩 agent 默认空脚本（成功、不写状态），各用例可自行覆盖
  : > "$WORK/dummy-agent"; chmod +x "$WORK/dummy-agent"
}

run_case() { env $(env_for) bash "$RUN" >/dev/null 2>&1; }

echo "=== 用例 1：早退路径（上一轮 await_confirm）不再留下陈旧 held=true ==="
init_state await_confirm false
run_case
check "lock.held 复位为 false" false "$(jq -r '.lock.held' "$ST")"

echo "=== 用例 2：陈旧锁接管（flock 空闲但 JSON 记 held=true）被安全复位 ==="
init_state completed true
jq '.lock.holder="run-cycle" | .lock.acquired_at="2026-11-13T00:00:00+08:00"' "$ST" > "$WORK/t" && mv "$WORK/t" "$ST"
run_case
check "lock.held 复位为 false" false "$(jq -r '.lock.held' "$ST")"
check "审计记录陈旧锁接管" 1 "$(grep -c '陈旧锁接管' "$LOG")"

echo "=== 用例 3：正常收尾保留 PM agent 写入字段，不回退为 null ==="
init_state completed false
# 桩 agent：模拟 PM agent 在轮内写回 task/priority/result/gates（驱动收尾不得覆盖）
cat > "$WORK/dummy-agent" <<EOF
#!/usr/bin/env bash
jq '.last_run.status="completed" | .last_run.task="agent任务" | .last_run.priority="P1"
   | .last_run.result="agent结果" | .last_run.gates={"frontend_tests":"68/68"}' "$ST" > "$WORK/t" && mv "$WORK/t" "$ST"
EOF
chmod +x "$WORK/dummy-agent"
run_case
check "task 未被覆盖" "agent任务" "$(jq -r '.last_run.task' "$ST")"
check "priority 未被覆盖" "P1" "$(jq -r '.last_run.priority' "$ST")"
check "result 未被覆盖" "agent结果" "$(jq -r '.last_run.result' "$ST")"
check "gates 未被覆盖" "68/68" "$(jq -r '.last_run.gates.frontend_tests' "$ST")"
check "status 兜底为 completed" completed "$(jq -r '.last_run.status' "$ST")"
check "收尾后 lock.held=false" false "$(jq -r '.lock.held' "$ST")"
check "状态文件仍是合法 JSON" true "$(jq -e . "$ST" >/dev/null 2>&1 && echo true || echo false)"
check "无残留 .tmp 文件" 0 "$(ls "$WORK"/state/cycle-state.json.tmp 2>/dev/null | wc -l)"

echo "=== 用例 4：锁被真并发持有者占用时，本轮 skip 且不改写他人锁字段 ==="
init_state completed false
( flock 9 2>/dev/null; sleep 3 ) 9>"$WORK/state/cycle-state.lock" &
BG=$!
sleep 0.5
run_case
check "上一轮状态未被改写（仍 completed）" completed "$(jq -r '.last_run.status' "$ST")"
check "未抢占他人锁（held 仍 false）" false "$(jq -r '.lock.held' "$ST")"
kill "$BG" 2>/dev/null; wait "$BG" 2>/dev/null

echo "=== 用例 5：agent 异常退出（rc=1）后锁仍被复位 ==="
init_state completed false
cat > "$WORK/dummy-agent" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod +x "$WORK/dummy-agent"
run_case
check "lock.held 复位为 false" false "$(jq -r '.lock.held' "$ST")"
check "lock.holder 清空（无残留）" "null" "$(jq -r '.lock.holder // "null"' "$ST")"
check "lock.acquired_at 清空（无残留）" "null" "$(jq -r '.lock.acquired_at // "null"' "$ST")"
check "状态标记 failed" failed "$(jq -r '.last_run.status' "$ST")"
check "stats.failed 递增" 1 "$(jq -r '.stats.failed' "$ST")"
check "agent 输出落在沙箱目录（不污染真实 state/）" 1 "$(ls "$WORK"/out/.cycle-*.out 2>/dev/null | wc -l)"

echo "=== 用例 6：硬超时（RC=124）标记 interrupted 且锁复位 ==="
init_state completed false
cat > "$WORK/dummy-agent" <<'EOF'
#!/usr/bin/env bash
sleep 30
EOF
chmod +x "$WORK/dummy-agent"
env $(env_for) HARD_TIMEOUT=1 bash "$RUN" >/dev/null 2>&1
check "lock.held 复位为 false" false "$(jq -r '.lock.held' "$ST")"
check "状态标记 interrupted" interrupted "$(jq -r '.last_run.status' "$ST")"
check "审计告警单轮超时" 1 "$(grep -c '告警：单轮超时' "$LOG")"

echo
echo "回归结果：通过 $pass / 失败 $fail"
[ "$fail" -eq 0 ] || exit 1
