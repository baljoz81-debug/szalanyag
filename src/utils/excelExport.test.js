import { describe, it, expect } from 'vitest';
import { buildCalculationRows, buildMetadataRows } from './excelExport.js';

const mkGroup = (overrides = {}) => ({
  quality: 'S235', type: 'Laposacél', size: '40x5',
  barLength: 6000, totalBars: 2, totalRemainder: 1500, avgUtilization: 0.75,
  displayBars: { full: 2, hasPartial: false, partialMeters: 0 },
  ...overrides,
});

describe('buildCalculationRows — P20 Excel export', () => {
  it('üres groups → üres rows', () => {
    expect(buildCalculationRows([])).toEqual([]);
    expect(buildCalculationRows(undefined)).toEqual([]);
  });

  it('nincs részleges → utolsó szál mező üres, anyagmennyiség = szálhossz × full / 1000', () => {
    const rows = buildCalculationRows([mkGroup()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      'S235', 'Laposacél', '40x5',
      6000,        // szálhossz
      12.0,        // szükséges anyagmennyiség (m) — 6000 × 2 / 1000
      2,           // szálak
      '',          // utolsó szál — üres ha nincs partial
      1500,        // maradék mm
      75,          // kihasználtság %
    ]);
  });

  it('részleges szál → anyagmennyiség = full × szálhossz / 1000 + partialMeters', () => {
    const g = mkGroup({
      totalBars: 2,
      displayBars: { full: 1, hasPartial: true, partialMeters: 1.5 },
    });
    const rows = buildCalculationRows([g]);
    // 6000 × 1 / 1000 + 1.5 = 7.5
    expect(rows[0][4]).toBe(7.5);
    expect(rows[0][5]).toBe(1);   // szükséges szálak (db) = d.full, nem totalBars
    expect(rows[0][6]).toBe(1.5); // utolsó szál
  });

  it('totalBars=0 → mennyiség 0, utolsó szál üres, kihasználtság 0', () => {
    const g = mkGroup({
      totalBars: 0,
      displayBars: { full: 0, hasPartial: false, partialMeters: 0 },
      avgUtilization: 0,
    });
    const r = buildCalculationRows([g])[0];
    expect(r[4]).toBe(0);
    expect(r[6]).toBe('');
    expect(r[8]).toBe(0);
  });

  it('avgUtilization → 1 tizedes pontosság', () => {
    const g = mkGroup({ avgUtilization: 0.7956 });
    expect(buildCalculationRows([g])[0][8]).toBe(79.6);
  });

  it('hiányzó quality/type/size → üres string a kimenetben', () => {
    const g = mkGroup({ quality: undefined, type: null, size: '' });
    const r = buildCalculationRows([g])[0];
    expect(r[0]).toBe('');
    expect(r[1]).toBe('');
    expect(r[2]).toBe('');
  });
});

describe('buildMetadataRows — projekt fejléc', () => {
  it('mindhárom érték → 4 sor (Projekt, Szettek, Vágási veszteség, üres)', () => {
    const rows = buildMetadataRows({ projectName: 'Csarnok-2026', setCount: 4, cutLoss: 3 });
    expect(rows).toEqual([
      ['Projekt', 'Csarnok-2026'],
      ['Szettek száma', 4],
      ['Vágási veszteség (mm)', 3],
      [],
    ]);
  });

  it('csak projektnév', () => {
    expect(buildMetadataRows({ projectName: 'X' })).toEqual([['Projekt', 'X'], []]);
  });

  it('csak setCount=0 is megjelenik (≠ null/undefined)', () => {
    expect(buildMetadataRows({ setCount: 0 })).toEqual([['Szettek száma', 0], []]);
  });

  it('csak cutLoss=0 is megjelenik (≠ null/undefined)', () => {
    expect(buildMetadataRows({ cutLoss: 0 })).toEqual([['Vágási veszteség (mm)', 0], []]);
  });

  it('üres projekt + nincs setCount/cutLoss → üres tömb', () => {
    expect(buildMetadataRows({})).toEqual([]);
    expect(buildMetadataRows({ projectName: '' })).toEqual([]);
  });
});
