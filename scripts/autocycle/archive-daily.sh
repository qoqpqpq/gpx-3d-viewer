#!/usr/bin/env bash
# archive-daily.sh — 每日 00:00 归档与同步 (CHARTER §5)
# 汇总当日轮次 → 推送前置扫描 → 仅在 feat/auto-cycle 提交推送 → 退避重试 2 次
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

STATE="state/cycle-state.json"
AUDIT_DIR="state/audit"
BRANCH="feat/auto-cycle"
GIT=(git -c http.version=HTTP/1.1)
LOG="state/audit/archive-$(date +%F).log"
mkdir -p "$AUDIT_DIR"

log() { printf '%s | %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }

# 冻结/停止检查
[ -f state/FROZEN ] && { log "FROZEN：归档跳过。"; exit 0; }
[ -f state/STOP ]    && { log "STOP：归档跳过。"; exit 0; }

# 确保在特性分支
CUR=$($GIT rev-parse --abbrev-ref HEAD)
if [ "$CUR" != "$BRANCH" ]; then
  $GIT rev-parse --verify "$BRANCH" >/dev/null 2>&1 || $GIT branch "$BRANCH"
  $GIT checkout "$BRANCH" || { log "ERROR：切到 $BRANCH 失败。"; exit 1; }
fi

# 汇总当日审计
TODAY=$(date +%F)
SUMMARY="state/.archive-summary-${TODAY}.md"
{
  echo "# 每日归档摘要 ${TODAY}"
  echo
  echo "## 当日轮次（来自审计日志）"
  grep -E "周期 [0-9]+ (启动|结束)" "$AUDIT_DIR/audit-${TODAY}.log" 2>/dev/null | tail -50 || echo "（无）"
  echo
  echo "## 告警"
  grep -E "\| ALERT \|" "$AUDIT_DIR/audit-${TODAY}.log" 2>/dev/null | tail -30 || echo "（无）"
} > "$SUMMARY"

# 推送前置检查 (CHARTER §5.3)
if ! scripts/autocycle/guards.sh; then
  log "ERROR：推送前置检查阻断，禁止提交/推送。等待人工。"
  jq '.last_run.status="await_confirm" | .stats.await_confirm=(.stats.await_confirm//0)+1' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
  exit 1
fi

# 提交（小粒度，带周期号）
$GIT add -A
if ! $GIT diff --cached --quiet; then
  CYCLE=$(jq -r '.current_cycle // 0' "$STATE")
  $GIT commit -q -m "chore(auto-cycle): 每日归档 周期${CYCLE} ${TODAY}" || { log "commit 失败"; exit 1; }
  log "已提交归档 周期${CYCLE}。"
else
  log "无改动，跳过提交。"
fi

# 推送（退避重试 2 次，CHARTER §5.5）
# 先判断是否真的需要推送：无本地领先提交且工作区干净则跳过，避免无谓 push 失败告警
BEHIND_COUNT=$($GIT rev-list --count origin/"$BRANCH"..HEAD 2>/dev/null || echo "0")
UNPUSHED=$( [ "${BEHIND_COUNT:-0}" -gt 0 ] && echo 1 || echo 0 )
if [ "$UNPUSHED" -eq 0 ] && [ -z "$($GIT status --porcelain)" ]; then
  log "本地与远端一致，无需要推送的提交，跳过 push。"
else
  # 推送用带 token 的临时 URL（凭据不驻留 .git/config）；token 从 DSH 凭证服务读取
  ARCH_TOKEN="$(python3 -c "import yaml;print(yaml.safe_load(open('${DSH_CREDENTIALS:-$HOME/.dsh/.credentials.yaml}'))['refs'].get('GITHUB_TOKEN',''))" 2>/dev/null)"
  PUSH_URL="origin"
  if [ -n "$ARCH_TOKEN" ]; then
    PUSH_URL="https://x-access-token:${ARCH_TOKEN}@github.com/qoqpqpq/gpx-3d-viewer.git"
  fi
  PUSH_OK=0
  for attempt in 1 2 3; do
    if timeout 120 "$GIT" -c http.version=HTTP/1.1 push "$PUSH_URL" "$BRANCH":refs/heads/"$BRANCH" 2>&1 | sed -E 's#x-access-token:[^@]*@#***@#g' | tee -a "$LOG"; then
      PUSH_OK=1; log "推送成功（第 ${attempt} 次）。"; break
    fi
    log "推送失败（第 ${attempt} 次），退避重试。"
    [ $attempt -lt 3 ] && sleep $((attempt * 15))
  done

  if [ $PUSH_OK -eq 0 ]; then
    log "ALERT：推送持续失败（已重试 2 次），记录告警，不再循环重试。"
    jq '.consecutive_push_failures=(.consecutive_push_failures//0)+1 | .last_run.status="failed"' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
    exit 1
  fi
fi

jq '.consecutive_push_failures=0' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
log "归档完成。"

# 磁盘水位 (CHARTER §6.4)
DISK_PCT=$(df -P "$ROOT" | awk 'NR==2{gsub("%","",$5);print $5}')
if [ "${DISK_PCT:-0}" -ge 90 ]; then
  log "ALERT：磁盘高水位 ${DISK_PCT}%。建议清理（仅白名单外）。"
fi
exit 0