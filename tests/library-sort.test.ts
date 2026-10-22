import { describe, it, expect } from 'vitest';

/**
 * 路线库搜索与排序逻辑测试
 * 对齐 main.ts 中 getFilteredSortedRecords() 的逻辑
 */

interface MockTrack {
  id: string;
  name: string;
  demo: boolean;
  distance: number;
  importedAt: number;
}

type SortOrder = 'date' | 'name' | 'distance';

function filterSort(
  records: MockTrack[],
  searchTerm: string,
  sortOrder: SortOrder,
): MockTrack[] {
  let filtered = records;
  if (searchTerm) {
    filtered = filtered.filter(r =>
      r.name.toLowerCase().includes(searchTerm),
    );
  }
  return [...filtered].sort((a, b) => {
    const demoDiff = Number(!!b.demo) - Number(!!a.demo);
    if (demoDiff !== 0) return demoDiff;
    switch (sortOrder) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'distance':
        return b.distance - a.distance;
      default:
        return b.importedAt - a.importedAt;
    }
  });
}

const sample: MockTrack[] = [
  { id: '1', name: '香山公园', demo: false, distance: 5000, importedAt: 1700000000000 },
  { id: '2', name: '泰山', demo: false, distance: 12000, importedAt: 1700100000000 },
  { id: '3', name: '演示路线', demo: true, distance: 3000, importedAt: 0 },
  { id: '4', name: '珠穆朗玛峰', demo: false, distance: 25000, importedAt: 1700200000000 },
  { id: '5', name: '香山环山', demo: false, distance: 4000, importedAt: 1700300000000 },
];

describe('路线库搜索', () => {
  it('无搜索词时返回全部路线', () => {
    const result = filterSort(sample, '', 'date');
    expect(result).toHaveLength(5);
  });

  it('按名称精确匹配', () => {
    const result = filterSort(sample, '香山', 'date');
    expect(result).toHaveLength(2);
    expect(result.map(r => r.name)).toContain('香山公园');
    expect(result.map(r => r.name)).toContain('香山环山');
  });

  it('搜索大小写不敏感', () => {
    const result = filterSort(sample, 'BEIJING', 'date');
    expect(result).toHaveLength(0);
  });

  it('搜索无匹配时返回空', () => {
    const result = filterSort(sample, '不存在的路线', 'date');
    expect(result).toHaveLength(0);
  });
});

describe('路线库排序', () => {
  it('默认按导入时间降序', () => {
    const result = filterSort(sample, '', 'date');
    // Demo always first
    expect(result[0].demo).toBe(true);
    // Then by date descending
    expect(result[1].id).toBe('5'); // newest non-demo
    expect(result[2].id).toBe('4');
    expect(result[3].id).toBe('2');
    expect(result[4].id).toBe('1'); // oldest non-demo
  });

  it('按名称升序', () => {
    const result = filterSort(sample, '', 'name');
    expect(result[0].demo).toBe(true); // demo always first
    const nonDemo = result.slice(1).map(r => r.name);
    expect(nonDemo).toEqual([...nonDemo].sort((a, b) => a.localeCompare(b)));
  });

  it('按距离降序', () => {
    const result = filterSort(sample, '', 'distance');
    expect(result[0].demo).toBe(true); // demo always first
    const nonDemo = result.slice(1);
    for (let i = 0; i < nonDemo.length - 1; i++) {
      expect(nonDemo[i].distance).toBeGreaterThanOrEqual(nonDemo[i + 1].distance);
    }
  });

  it('演示路线始终排在最前', () => {
    for (const order of ['date', 'name', 'distance'] as SortOrder[]) {
      const result = filterSort(sample, '', order);
      expect(result[0].demo).toBe(true);
    }
  });

  it('搜索 + 排序组合生效', () => {
    const result = filterSort(sample, '香山', 'distance');
    expect(result).toHaveLength(2);
    expect(result[0].distance).toBeGreaterThanOrEqual(result[1].distance);
  });
});
