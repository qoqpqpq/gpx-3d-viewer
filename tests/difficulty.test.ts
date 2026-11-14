import { describe, it, expect } from 'vitest';
import { estimateHours, difficultyLevel, assessDifficulty } from '../src/core/difficulty';

describe('estimateHours（Naismith 规则）', () => {
  it('纯平地：10km 无爬升 → 2 小时', () => {
    expect(estimateHours(10000, 0)).toBeCloseTo(2, 5);
  });
  it('纯爬升：600m 无距离 → 1 小时', () => {
    expect(estimateHours(0, 600)).toBeCloseTo(1, 5);
  });
  it('距离+爬升叠加：10km + 600m → 3 小时', () => {
    expect(estimateHours(10000, 600)).toBeCloseTo(3, 5);
  });
  it('负值/非法输入按 0 处理', () => {
    expect(estimateHours(-5000, -100)).toBeCloseTo(0, 5);
    expect(estimateHours(NaN, NaN)).toBeCloseTo(0, 5);
  });
});

describe('difficultyLevel', () => {
  it('< 2h → easy', () => {
    expect(difficultyLevel(1.9)).toBe('easy');
    expect(difficultyLevel(0)).toBe('easy');
  });
  it('2h ~ 5h → moderate', () => {
    expect(difficultyLevel(2)).toBe('moderate');
    expect(difficultyLevel(4.9)).toBe('moderate');
  });
  it('>= 5h → hard', () => {
    expect(difficultyLevel(5)).toBe('hard');
    expect(difficultyLevel(10)).toBe('hard');
  });
});

describe('assessDifficulty', () => {
  it('简单路线：5km 平地 → easy，1 小时', () => {
    const r = assessDifficulty({ distance: 5000, ascent: 0 });
    expect(r.level).toBe('easy');
    expect(r.label).toBe('简单');
    expect(r.estimatedHours).toBeCloseTo(1, 5);
    expect(r.hasElevation).toBe(true);
    expect(r.rule).toContain('Naismith');
  });
  it('困难路线：20km + 1800m 爬升 → hard', () => {
    const r = assessDifficulty({ distance: 20000, ascent: 1800 });
    // 20/5 + 1800/600 = 4 + 3 = 7h
    expect(r.estimatedHours).toBeCloseTo(7, 5);
    expect(r.level).toBe('hard');
    expect(r.label).toBe('困难');
  });
  it('无高程数据：hasElevation=false，rule 标注爬升按 0', () => {
    const r = assessDifficulty({ distance: 10000, ascent: null });
    expect(r.hasElevation).toBe(false);
    expect(r.estimatedHours).toBeCloseTo(2, 5);
    expect(r.rule).toContain('无高程数据');
  });
  it('中等路线边界：10km + 600m → moderate', () => {
    const r = assessDifficulty({ distance: 10000, ascent: 600 });
    expect(r.estimatedHours).toBeCloseTo(3, 5);
    expect(r.level).toBe('moderate');
    expect(r.label).toBe('中等');
  });
});