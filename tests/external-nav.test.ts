import { describe, it, expect } from 'vitest';
import { externalNavUrl, EXTERNAL_MAP_SERVICES } from '../src/core/external-nav';

const dest = { lat: 40.0436, lon: 116.3025, name: '香山公园' };
const destSpecial = { lat: 40.0, lon: 116.0, name: 'A&M Route' };

describe('externalNavUrl', () => {
  it('高德地图 URL 包含坐标、名称和步行模式', () => {
    const url = externalNavUrl('amap', dest);
    expect(url).toContain('uri.amap.com/navigation');
    expect(url).toContain('mode=walking');
    expect(url).toContain('116.302500,40.043600');
    expect(url).toContain(encodeURIComponent('香山公园'));
  });

  it('百度地图 URL 使用 destination 参数', () => {
    const url = externalNavUrl('baidu', dest);
    expect(url).toContain('api.map.baidu.com/direction');
    expect(url).toContain('destination=40.043600,116.302500');
    expect(url).toContain('mode=walking');
    expect(url).toContain('output=html');
  });

  it('Apple 地图 URL 使用 daddr 参数', () => {
    const url = externalNavUrl('apple', dest);
    expect(url).toContain('maps.apple.com');
    expect(url).toContain('daddr=40.043600,116.302500');
    expect(url).toContain('dirflg=w');
  });

  it('Google 地图 URL 使用 api=1 和 travelmode', () => {
    const url = externalNavUrl('google', dest);
    expect(url).toContain('google.com/maps/dir/');
    expect(url).toContain('api=1');
    expect(url).toContain('destination=40.043600,116.302500');
    expect(url).toContain('travelmode=walking');
  });

  it('坐标保留 6 位小数', () => {
    for (const service of ['amap', 'baidu', 'apple', 'google'] as const) {
      const url = externalNavUrl(service, { lat: 40.1234567, lon: 116.1234567, name: 'T' });
      expect(url).toContain('40.123457');
      expect(url).toContain('116.123457');
    }
  });

  it('特殊字符名称被正确编码', () => {
    const url = externalNavUrl('amap', destSpecial);
    expect(url).toContain(encodeURIComponent('A&M Route'));
  });

  it('整数坐标格式化为浮点数', () => {
    const url = externalNavUrl('amap', { lat: 40, lon: 116, name: '整数坐标' });
    expect(url).toContain('40.000000');
    expect(url).toContain('116.000000');
  });
});

describe('EXTERNAL_MAP_SERVICES', () => {
  it('包含四个地图服务', () => {
    expect(EXTERNAL_MAP_SERVICES).toHaveLength(4);
  });

  it('每个服务有唯一 id', () => {
    const ids = EXTERNAL_MAP_SERVICES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个服务有 label 和 note', () => {
    for (const s of EXTERNAL_MAP_SERVICES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.note.length).toBeGreaterThan(0);
    }
  });

  it('所有 id 都能生成有效 URL', () => {
    for (const s of EXTERNAL_MAP_SERVICES) {
      const url = externalNavUrl(s.id, dest);
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});
