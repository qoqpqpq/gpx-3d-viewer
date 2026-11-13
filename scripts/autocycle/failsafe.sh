#!/usr/bin/env bash
# failsafe.sh — 一键兜底 (CHARTER §1)
# 用法:
#   failsafe.sh freeze            冻结自动周期（下轮 skip）
#   failsafe.sh unfreeze          解除冻结
#   failsafe.sh readonly          只读模式（只分析不改代码）
#   failsafe.sh readwrite         解除只读
#   failsafe.sh rollback <ref>    回滚至指定基线（高风险，需 --yes 确认）
#   failsafe.sh stop              永久停止调度（摘除 systemd timer）
#   failsafe.sh resume            解除 stop 并重启 timer
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
STATE="state/cycle-state.json"
GIT=(git -c http.version=HTTP/1.1)

cmd="${1:-}"; shift || true
case "$cmd" in
  freeze)
    : > state/FROZEN
    jq '.mode="frozen"' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
    echo "✅ 已冻结自动周期（下轮驱动读到 FROZEN 即 skip）。";;

  unfreeze)
    rm -f state/FROZEN
    jq '.mode="auto"' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
    echo "✅ 已解除冻结。";;

  readonly)
    : > state/READONLY
    jq '.mode="readonly"' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
    echo "✅ 已切换只读模式（仅分析/记录，不改代码）。";;

  readwrite)
    rm -f state/READONLY
    jq '.mode="auto"' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
    echo "✅ 已恢复读写。";;

  rollback)
    REF="${1:-}"; YES="${2:-}"
    [ -z "$REF" ] && { echo "用法: failsafe.sh rollback <ref> [--yes]"; exit 1; }
    if [ "$YES" != "--yes" ]; then
      echo "⚠️  回滚属高风险变更，必须人工确认。请复核后执行："
      echo "     scripts/autocycle/failsafe.sh rollback $REF --yes"
      exit 1
    fi
    echo "回滚至基线 $REF ..." | tee -a state/audit/rollback-$(date +%F).log
    $GIT checkout "$REF" -- . 2>&1 | tee -a state/audit/rollback-$(date +%F).log
    printf 'rollback: ref=%s time=%s operator=manual\n' "$REF" "$(date -Iseconds)" >> state/audit/rollback-$(date +%F).log
    echo "✅ 已回滚至 $REF（仅工作区，未提交；请人工复核后决定是否提交）。";;

  stop)
    : > state/STOP
    sudo systemctl disable --now gpx-autocycle.timer gpx-autocycle-archive.timer 2>/dev/null || true
    jq '.mode="stopped"' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
    echo "✅ 已永久停止调度（systemd timer 已摘除，state/STOP 已置位）。";;

  resume)
    rm -f state/STOP
    sudo systemctl enable --now gpx-autocycle.timer gpx-autocycle-archive.timer 2>/dev/null || true
    jq '.mode="auto"' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
    echo "✅ 已恢复调度。";;

  *)
    sed -n '/^# 用法:/,/^set -uo/p' "$0" | sed '$d'; exit 1;;
esac