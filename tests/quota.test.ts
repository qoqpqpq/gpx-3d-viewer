import { describe, it, expect, vi } from 'vitest';
import { refreshQuotaUsage, dayUsagePercent } from '../src/adapters/quota';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body });
}

describe('refreshQuotaUsage', () => {
  it('正常返回时归一化额度字段', async () => {
    const fetchImpl = mockFetch(200, {
      day: '2026-11-14', dayRequests: 120, dailyLimit: 20000, perMinute: 180,
      thresholds: { day: { warning: 16000, critical: 20000 }, perMinute: { warning: 144, critical: 180 } },
      alerts: [{ level: 'warning', message: '接近日上限' }],
      scope: 'This process only'
    });
    const state = await refreshQuotaUsage(fetchImpl as unknown as typeof fetch);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(state.dayRequests).toBe(120);
      expect(state.dailyLimit).toBe(20000);
      expect(state.thresholds.day.critical).toBe(20000);
      expect(state.alerts).toHaveLength(1);
    }
  });

  it('401 时降级为 unauthorized 提示，不抛错', async () => {
    const state = await refreshQuotaUsage(mockFetch(401, { error: 'unauthorized' }) as unknown as typeof fetch);
    expect(state.ok).toBe(false);
    if (!state.ok) expect(state.reason).toBe('unauthorized');
  });

  it('网络失败时降级为 unavailable 提示，不抛错', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const state = await refreshQuotaUsage(fetchImpl as unknown as typeof fetch);
    expect(state.ok).toBe(false);
    if (!state.ok) expect(state.reason).toBe('unavailable');
  });

  it('异常响应体（缺字段）不崩，按 0 兜底', async () => {
    const state = await refreshQuotaUsage(mockFetch(200, {}) as unknown as typeof fetch);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(state.dayRequests).toBe(0);
      expect(state.dailyLimit).toBe(0);
      expect(state.alerts).toEqual([]);
    }
  });
});

describe('dayUsagePercent', () => {
  it('正常计算百分比', () => {
    expect(dayUsagePercent(100, 200)).toBe(50);
    expect(dayUsagePercent(200, 200)).toBe(100);
  });
  it('超限封顶 100%', () => {
    expect(dayUsagePercent(300, 200)).toBe(100);
  });
  it('上限为 0 时返回 0（避免除零）', () => {
    expect(dayUsagePercent(50, 0)).toBe(0);
  });
});