export interface QuotaThresholds { warning: number; critical: number }
export interface QuotaAlert { level?: string; scope?: string; message?: string; [k: string]: unknown }
export interface QuotaUsage {
  ok: true;
  day: string;
  dayRequests: number;
  dailyLimit: number;
  perMinute: number;
  thresholds: { day: QuotaThresholds; perMinute: QuotaThresholds };
  alerts: QuotaAlert[];
  scope: string;
}
export type QuotaState =
  | { ok: false; reason: 'unauthorized' | 'unavailable'; message: string };

/** 拉取代理额度用量；401（未配 ADMIN_TOKEN）或网络失败时降级为友好提示，不抛错、不阻塞主链路。 */
export async function refreshQuotaUsage(fetchImpl: typeof fetch = fetch): Promise<QuotaUsage | QuotaState> {
  try {
    const response = await fetchImpl('/api/usage', { signal: AbortSignal.timeout(3000), cache: 'no-store' });
    if (response.status === 401) {
      return { ok: false, reason: 'unauthorized', message: '需要管理员令牌（ADMIN_TOKEN）才能查看额度；浏览器端不保管该令牌。' };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return {
      ok: true,
      day: typeof data.day === 'string' ? data.day : '',
      dayRequests: Number(data.dayRequests) || 0,
      dailyLimit: Number(data.dailyLimit) || 0,
      perMinute: Number(data.perMinute) || 0,
      thresholds: {
        day: { warning: Number(data.thresholds?.day?.warning) || 0, critical: Number(data.thresholds?.day?.critical) || 0 },
        perMinute: { warning: Number(data.thresholds?.perMinute?.warning) || 0, critical: Number(data.thresholds?.perMinute?.critical) || 0 }
      },
      alerts: Array.isArray(data.alerts) ? data.alerts : [],
      scope: typeof data.scope === 'string' ? data.scope : ''
    };
  } catch {
    return { ok: false, reason: 'unavailable', message: '无法获取额度数据（后端未配置或网络不可用）。' };
  }
}

/** 用量占日上限的百分比（上限为 0 时返回 0，避免除零）。 */
export function dayUsagePercent(dayRequests: number, dailyLimit: number): number {
  if (!dailyLimit) return 0;
  return Math.min(100, Math.round((dayRequests / dailyLimit) * 100));
}