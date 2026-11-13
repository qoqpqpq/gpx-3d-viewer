#!/usr/bin/env bash
# guards.sh — 推送前置检查 (CHARTER §5.3, §7)
# 用法: guards.sh [path...]   默认扫描暂存区/工作区改动
# 退出码: 0=通过  1=发现阻断项
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
  mapfile -t FILES < <(git diff --cached --name-only; git diff --name-only)
fi

BLOCK=0
declare -a REASONS

# 保护白名单 (CHARTER §6.1) —— 命中即阻断
PROTECTED=('.env' '.env.local' '.env.production' '*.pem' '*.key' '*credentials*' '*secret*' '*.keystore')
for f in "${FILES[@]}"; do
  for pat in "${PROTECTED[@]}"; do
    # shellcheck disable=SC2254
    case "$f" in
      $pat) BLOCK=1; REASONS+=("触碰保护文件: $f");;
    esac
  done
done

# 密钥/敏感信息扫描
SECRET_PAT='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|x-access-token:[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|api[_-]?key["'"'"']?\s*[:=]\s*["'"'"'][A-Za-z0-9]{16,})'
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  if grep -qIEm "$SECRET_PAT" "$f" 2>/dev/null; then
    BLOCK=1; REASONS+=("疑似密钥/敏感信息: $f")
  fi
done

# 调试代码扫描（仅提醒，不阻断，除非 .env）
DEBUG_HITS=0
for f in "${FILES[@]}"; do
  case "$f" in
    *.js|*.ts|*.jsx|*.tsx|*.kt|*.java)
      [ -f "$f" ] || continue
      if grep -qEn '(console\.(log|debug)|debugger|TODO.{0,4}DEBUG)' "$f" 2>/dev/null; then
        DEBUG_HITS=$((DEBUG_HITS+1))
      fi
    ;;
  esac
done

# 本地路径 / 临时调试 (CHARTER §4.4)
for f in "${FILES[@]}"; do
  case "$f" in
    *.js|*.ts|*.tsx|*.kt)
      [ -f "$f" ] || continue
      if grep -qEn '(/home/ubuntu|/Users/|C:\\\\Users\\\\)' "$f" 2>/dev/null; then
        BLOCK=1; REASONS+=("硬编码本地路径: $f")
      fi
    ;;
  esac
done

echo "[guards] 扫描文件数: ${#FILES[@]} | 调试代码命中: $DEBUG_HITS"
if [ $BLOCK -eq 1 ]; then
  echo "[guards] ❌ 阻断："
  for r in "${REASONS[@]}"; do echo "   - $r"; done
  exit 1
fi
echo "[guards] ✅ 通过（无密钥/保护文件/本地路径）"
exit 0