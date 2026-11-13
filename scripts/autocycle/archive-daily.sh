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
  # 写独立的 last_archive_run，不碰 PM 轮的 last_run（修复 R-018：归档失败曾越权覆盖
  # last_run.status，致下一个 PM 轮误读 PREV=failed 而空转 resume）
  jq '.last_archive_run.status="await_confirm" | .last_archive_run.finished_at=(now|todateiso8601) | .stats.await_confirm=(.stats.await_confirm//0)+1' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
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

# 推送（退避重试 2 次 + 推送后对账，修复 R-018 根因 a/c，CHARTER §5.5）
# 凭据：token 从 DSH 凭证服务读取，构造临时 URL，不驻留 .git/config
ARCH_TOKEN="$(python3 -c "import yaml;print(yaml.safe_load(open('${DSH_CREDENTIALS:-$HOME/.dsh/.credentials.yaml}'))['refs'].get('GITHUB_TOKEN',''))" 2>/dev/null)"
REMOTE_URL="https://github.com/qoqpqpq/gpx-3d-viewer.git"
PUSH_URL="origin"
[ -n "$ARCH_TOKEN" ] && PUSH_URL="https://x-access-token:${ARCH_TOKEN}@${REMOTE_URL#https://}"

# 远端 HEAD 查询（ls-remote 不依赖本地跟踪引用，规避根因 c 的 refspec 缺失）
remote_head() {
  timeout 60 "$GIT" -c http.version=HTTP/1.1 ls-remote "$PUSH_URL" "refs/heads/${BRANCH}" 2>/dev/null | awk '{print $1}'
}
LOCAL_HEAD=$("$GIT" rev-parse HEAD)
REMOTE_HEAD=$(remote_head)

# 判断是否真的需要推送：远端 HEAD 已等于本地 HEAD 则无需 push（不依赖 origin/<branch> 跟踪引用）
if [ -n "$REMOTE_HEAD" ] && [ "$REMOTE_HEAD" = "$LOCAL_HEAD" ] && [ -z "$($GIT status --porcelain)" ]; then
  log "对账：远端 ${BRANCH} 已=本地 HEAD ${LOCAL_HEAD:0:7}，无需要推送的提交，跳过 push。"
else
  PUSH_OK=0
  for attempt in 1 2 3; do
    timeout 120 "$GIT" -c http.version=HTTP/1.1 push "$PUSH_URL" "$BRANCH":refs/heads/"$BRANCH" 2>&1 | sed -E 's#x-access-token:[^@]*@#***@#g' | tee -a "$LOG"
    # 推送后对账（根因 a）：以远端 HEAD 是否追平本地为准，规避网络假阴性（TLS 抖动但实际已送达）
    sleep 2
    REMOTE_HEAD=$(remote_head)
    if [ -n "$REMOTE_HEAD" ] && [ "$REMOTE_HEAD" = "$("$GIT" rev-parse HEAD)" ]; then
      PUSH_OK=1; log "推送对账成功：远端 ${BRANCH} 已=本地 HEAD（第 ${attempt} 次尝试后）。"; break
    fi
    log "推送后对账未通过（第 ${attempt} 次），退避重试。"
    [ $attempt -lt 3 ] && sleep $((attempt * 15))
  done

  if [ $PUSH_OK -eq 0 ]; then
    log "ALERT：推送对账 3 次仍未追平（远端=${REMOTE_HEAD:-空} 本地=${LOCAL_HEAD:0:7}），记录告警，不再循环重试。"
    # 同 R-018 根因 b：写 last_archive_run 而非 last_run，避免污染 PM 轮状态机
    jq '.consecutive_push_failures=(.consecutive_push_failures//0)+1 | .last_archive_run.status="failed" | .last_archive_run.finished_at=(now|todateiso8601)' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
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