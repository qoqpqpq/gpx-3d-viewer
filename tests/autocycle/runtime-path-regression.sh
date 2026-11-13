#!/usr/bin/env bash
# runtime-path-regression.sh — 周期 7 运行时 PATH / 依赖预检回归（R-012）
# 背景：周期 6 驱动在 systemd 下 rc=127（0s 失败），根因是 systemd 默认 PATH
#       既不含 node/npm(/.local/node/bin) 也不含 dsh(/.local/share/pnpm)，而 dsh 是
#       `#!/usr/bin/env node` 脚本。本回归锁定两类修复：
#         ① 静态：systemd unit 与 run-cycle.sh 必须显式补齐 node + dsh 的 bin 目录；
#         ② 动态：run-cycle.sh 在缺运行时时依赖预检快速失败，且不抢锁、不污染状态机。
# 用法: bash tests/autocycle/runtime-path-regression.sh
# 退出码: 0=全部通过  1=存在失败
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="$ROOT/scripts/autocycle/run-cycle.sh"
SVC_DIR="$ROOT/scripts/autocycle/systemd"
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
LOG="$WORK/state/audit/audit-$(date +%F).log"

init_state() {
  cat > "$ST" <<JSON
{"schema":1,"project":"t","charter":"c","branch":"feat/auto-cycle","mode":"auto",
 "current_cycle":7,"last_status":"completed","consecutive_degraded":0,"consecutive_push_failures":0,
 "lock":{"held":false,"holder":null,"acquired_at":null},
 "last_run":{"cycle":7,"status":"completed","model":"sensenova-6.8-flash","degrade_reason":null,
   "context_compressed":false,"task":"保留我","priority":"P1","result":"保留我","gates":{"t":"68/68"}},
 "stats":{"completed":0,"interrupted":0,"failed":0,"suspended":0,"await_confirm":0,"degraded":0,"skipped":0}}
JSON
  : > "$WORK/state/cycle-state.lock"
  : > "$LOG"
  : > "$WORK/dummy-agent"; chmod +x "$WORK/dummy-agent"
}

RC=0
run_case() { # run_case [extra VAR=.. ...] —— 结果码存入全局 RC，供用例断言
  init_state
  env AUTOCYCLE_STATE="$ST" AUTOCYCLE_LOCK="$WORK/state/cycle-state.lock" \
      AUTOCYCLE_AUDIT_DIR="$WORK/state/audit" AUTOCYCLE_AGENT_OUT_DIR="$WORK/out" \
      AUTOCYCLE_AGENT_CMD="$WORK/dummy-agent" "$@" bash "$RUN" >/dev/null 2>&1
  RC=$?
}

echo "=== 用例 1：run-cycle.sh 显式补齐 node 与 dsh 的 bin 目录（幂等 PATH 前置）==="
for _pat in '\.local/node/bin' '\.local/share/pnpm'; do
  # 只统计非注释代码行，避免被说明性注释干扰
  check "PATH 前置代码含 $_pat" 1 "$(grep -v '^[[:space:]]*#' "$RUN" | grep -c "$_pat")"
done
unset _pat
check "PATH 前置循环存在（case 去重）" 1 "$(grep -c 'case ":\$PATH:" in' "$RUN")"
check "目录存在才加入 PATH" 1 "$(grep -c '\[ -d "\$_d" \]' "$RUN")"

echo "=== 用例 2：两个 systemd unit 均声明补齐 PATH ==="
for u in gpx-autocycle.service gpx-autocycle-archive.service; do
  f="$SVC_DIR/$u"
  check "$u 存在" 1 "$([ -f "$f" ] && echo 1 || echo 0)"
  check "$u 声明 Environment=PATH" 1 "$(grep -c '^Environment=PATH=' "$f")"
  check "$u PATH 含 node bin" 1 "$(grep '^Environment=PATH=' "$f" | grep -c '/\.local/node/bin')"
  check "$u PATH 含 dsh(pnpm) bin" 1 "$(grep '^Environment=PATH=' "$f" | grep -c '/\.local/share/pnpm')"
  check "$u PATH 保留系统目录 /usr/bin" 1 "$(grep '^Environment=PATH=' "$f" | grep -c ':/usr/bin:')"
done

echo "=== 用例 3：unit 声明的 bin 目录在本机真实存在 ==="
UNIT_PATH="$(grep -h '^Environment=PATH=' "$SVC_DIR"/*.service | head -1 | sed 's/^Environment=PATH=//')"
check "可解析 unit PATH" 1 "$([ -n "$UNIT_PATH" ] && echo 1 || echo 0)"
MISSING=""
IFS=: read -ra _dirs <<< "$UNIT_PATH"
for d in "${_dirs[@]}"; do
  case "$d" in \$HOME*|~*) d="${d/#\$HOME/$HOME}";; esac
  [ -z "$d" ] && continue
  case "$d" in /usr/*|/bin|/sbin|/usr) continue;; esac   # 系统目录不校验（容器/发行版差异）
  [ -d "$d" ] || MISSING="$MISSING $d"
done
unset IFS
check "unit PATH 中非系统目录均存在" "" "$MISSING"
check "node 可由 unit PATH 解析" 1 "$(PATH="$UNIT_PATH" command -v node >/dev/null 2>&1 && echo 1 || echo 0)"
check "dsh 可由 unit PATH 解析" 1 "$(PATH="$UNIT_PATH" command -v dsh >/dev/null 2>&1 && echo 1 || echo 0)"

echo "=== 用例 4：systemd-analyze verify 语法校验（如可用）==="
if command -v systemd-analyze >/dev/null 2>&1; then
  for u in gpx-autocycle.service gpx-autocycle-archive.service; do
    out="$(systemd-analyze verify "$SVC_DIR/$u" 2>&1)"; rc=$?
    check "$u systemd-analyze verify rc=0" 0 "$rc"
  done
else
  echo "  ⚠️ systemd-analyze 不可用，跳过语法校验（不影响本轮门禁）"
fi

echo "=== 用例 5：缺运行时时依赖预检快速失败，不抢锁、不写状态 ==="
run_case AUTOCYCLE_REQUIRE_BINS="jq flock git definitely-not-a-bin-xyz"
check "退出码非 0（快速失败）" 1 "$([ "$RC" -ne 0 ] && echo 1 || echo 0)"
check "审计记录依赖预检失败" 1 "$(grep -c '依赖预检失败' "$LOG")"
check "审计点名缺失 bin" 1 "$(grep -c 'definitely-not-a-bin-xyz' "$LOG")"
check "未抢锁（lock 仍 held=false）" false "$(jq -r '.lock.held' "$ST")"
check "未改写 last_run.status" completed "$(jq -r '.last_run.status' "$ST")"
check "未动 current_cycle" 7 "$(jq -r '.current_cycle' "$ST")"
check "状态文件仍是合法 JSON" true "$(jq -e . "$ST" >/dev/null 2>&1 && echo true || echo false)"

echo "=== 用例 6：运行时齐全时预检放行，本轮正常跑完并释放锁 ==="
run_case AUTOCYCLE_REQUIRE_BINS="jq flock git"
check "退出码 0" 0 "$RC"
check "status 兜底为 completed" completed "$(jq -r '.last_run.status' "$ST")"
check "收尾后 lock.held=false" false "$(jq -r '.lock.held' "$ST")"
check "审计无依赖预检失败" 0 "$(grep -c '依赖预检失败' "$LOG")"

echo
echo "通过 $pass / $((pass+fail))"
[ "$fail" -eq 0 ] || exit 1
