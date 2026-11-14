/**
 * U-01: 路线难度分级 + 预计耗时估算
 * 规则明确可测，供行前快速判断"这条路线累不累、要走几小时"。
 * 纯函数、无副作用，便于单元测试覆盖边界。
 */

export type DifficultyLevel = 'easy' | 'moderate' | 'hard';

export interface DifficultyInput {
  /** 路线距离，单位米 */
  distance: number;
  /** 累计爬升，单位米；无高程数据时为 null */
  ascent: number | null;
}

export interface DifficultyResult {
  /** 难度等级 */
  level: DifficultyLevel;
  /** 难度中文标签 */
  label: string;
  /** 预计耗时，单位小时（含爬升加时） */
  estimatedHours: number;
  /** 估算所按规则的说明（展示用，让用户知道口径） */
  rule: string;
  /** 是否基于真实高程计算（无高程时爬升按 0 处理，耗时偏乐观） */
  hasElevation: boolean;
}

/** Naismith 规则系数：平地步速 km/h、每爬升 600m 加 1 小时 */
const WALK_SPEED_KMH = 5;
const ASCENT_METERS_PER_HOUR = 600;

/**
 * 估算预计耗时（小时）。采用 Naismith 规则：
 *   时长 = 距离/5km/h + 爬升/600m/h
 * 距离/爬升为负或非有限值时按 0 处理。
 */
export function estimateHours(distance: number, ascent: number | null): number {
  const km = Number.isFinite(distance) && distance > 0 ? distance / 1000 : 0;
  const climb = ascent != null && Number.isFinite(ascent) && ascent > 0 ? ascent : 0;
  return km / WALK_SPEED_KMH + climb / ASCENT_METERS_PER_HOUR;
}

/**
 * 难度分级。按预计耗时（已含爬升加时）判定，规则透明可复现：
 *   < 2h      → 简单 easy
 *   2h ~ 5h   → 中等 moderate
 *   >= 5h     → 困难 hard
 */
export function difficultyLevel(estimatedHours: number): DifficultyLevel {
  const h = Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : 0;
  if (h < 2) return 'easy';
  if (h < 5) return 'moderate';
  return 'hard';
}

const LABELS: Record<DifficultyLevel, string> = {
  easy: '简单',
  moderate: '中等',
  hard: '困难'
};

/**
 * 综合评估一条路线的难度与预计耗时。
 * 无高程数据（ascent 为 null）时爬升按 0 计入，耗时偏乐观，结果中标注 hasElevation=false。
 */
export function assessDifficulty(input: DifficultyInput): DifficultyResult {
  const estimatedHours = estimateHours(input.distance, input.ascent);
  const level = difficultyLevel(estimatedHours);
  const hasElevation = input.ascent != null;
  const km = (Number.isFinite(input.distance) && input.distance > 0 ? input.distance : 0) / 1000;
  const rule = hasElevation
    ? `Naismith 规则：${km.toFixed(1)}km ÷ ${WALK_SPEED_KMH}km/h + 爬升 ${Math.round(input.ascent ?? 0)}m ÷ ${ASCENT_METERS_PER_HOUR}m/h`
    : `Naismith 规则（无高程数据，爬升按 0）：${km.toFixed(1)}km ÷ ${WALK_SPEED_KMH}km/h`;
  return { level, label: LABELS[level], estimatedHours, rule, hasElevation };
}