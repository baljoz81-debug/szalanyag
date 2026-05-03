import { describe, it, expect } from 'vitest';
import {
  HEADER,
  buildPdfRows,
  buildPdfSummary,
  slugifyProjectName,
  buildExportFilename,
} from './pdfExport.js';

const mkGroup = (overrides = {}) => ({
  quality: 'S235', type: 'Laposacél', size: '40x5',
  barLength: 6000, totalBars: 2, totalRemainder: 1500, avgUtilization: 0.75,
  displayBars: { full: 2, hasPartial: false, partialMeters: 0 },
  ...overrides,
});

describe('buildPdfRows — PDF export', () => {
  it('üres groups → üres rows', () => {
    expect(buildPdfRows([])).toEqual([]);
    expect(buildPdfRows(undefined)).toEqual([]);
  });

  it('header hossza egyezik a sor hosszával', () => {
    const rows = buildPdfRows([mkGroup()]);
    expect(rows[0]).toHaveLength(HEADER.length);
  });

  it('nincs részleges → utolsó szál üres string', () => {
    const r = buildPdfRows([mkGroup()])[0];
    expect(r[0]).toBe('S235');
    expect(r[1]).toBe('Laposacél');
    expect(r[2]).toBe('40x5');
    expect(r[3]).toBe('6000');
    // 6000 × 2 / 1000 = 12.0 — hu-HU: "12,0"
    expect(r[4]).toBe('12,0');
    expect(r[5]).toBe('2');   // szükséges szálak
    expect(r[6]).toBe('');    // utolsó szál — üres ha nincs partial
    expect(r[7]).toBe('1500'); // maradék
  });

  it('részleges szál → anyagmennyiség = full × szálhossz / 1000 + partialMeters', () => {
    const g = mkGroup({
      totalBars: 2,
      displayBars: { full: 1, hasPartial: true, partialMeters: 1.5 },
    });
    const r = buildPdfRows([g])[0];
    expect(r[4]).toBe('7,5');
    expect(r[5]).toBe('1');
    expect(r[6]).toBe('1,5');
  });

  it('totalBars=0 → mennyiség "0,0", utolsó szál üres, kihasználtság "0,0"', () => {
    const g = mkGroup({
      totalBars: 0,
      displayBars: { full: 0, hasPartial: false, partialMeters: 0 },
      avgUtilization: 0,
    });
    const r = buildPdfRows([g])[0];
    expect(r[4]).toBe('0,0');
    expect(r[6]).toBe('');
    expect(r[8]).toBe('0,0');
  });

  it('avgUtilization → 1 tizedes hu-HU formátum', () => {
    const g = mkGroup({ avgUtilization: 0.7956 });
    expect(buildPdfRows([g])[0][8]).toBe('79,6');
  });

  it('hiányzó quality/type/size → üres string', () => {
    const g = mkGroup({ quality: undefined, type: null, size: '' });
    const r = buildPdfRows([g])[0];
    expect(r[0]).toBe('');
    expect(r[1]).toBe('');
    expect(r[2]).toBe('');
  });
});

describe('buildPdfSummary', () => {
  it('üres groups → 0 értékek', () => {
    const s = buildPdfSummary([]);
    expect(s).toEqual({
      materialTypeCount: 0,
      totalFullBars: 0,
      totalPartial: 0,
      avgUtilizationPct: 0,
    });
  });

  it('súlyozott átlag-kihasználtság a szálszámmal', () => {
    const a = mkGroup({ totalBars: 2, avgUtilization: 0.5 });
    const b = mkGroup({ totalBars: 4, avgUtilization: 0.8 });
    // (0.5*2 + 0.8*4) / 6 = 4.2/6 = 0.7
    const s = buildPdfSummary([a, b]);
    expect(s.materialTypeCount).toBe(2);
    expect(s.totalFullBars).toBe(4); // 2 + 2 (mindkettőnél displayBars.full=2)
    expect(s.avgUtilizationPct).toBeCloseTo(70.0, 1);
  });

  it('részleges szálak számolása', () => {
    const a = mkGroup({ displayBars: { full: 1, hasPartial: true, partialMeters: 1.0 } });
    const b = mkGroup({ displayBars: { full: 3, hasPartial: false, partialMeters: 0 } });
    const s = buildPdfSummary([a, b]);
    expect(s.totalFullBars).toBe(4);
    expect(s.totalPartial).toBe(1);
  });
});

describe('slugifyProjectName', () => {
  it('üres → ""', () => {
    expect(slugifyProjectName('')).toBe('');
    expect(slugifyProjectName(null)).toBe('');
    expect(slugifyProjectName(undefined)).toBe('');
  });

  it('magyar ékezetek eltávolítása', () => {
    expect(slugifyProjectName('Csarnok-2026 Ősz')).toBe('Csarnok-2026_Osz');
  });

  it('különleges karakterek → "_"', () => {
    expect(slugifyProjectName('A/B C:D')).toBe('A_B_C_D');
  });

  it('vezető és záró underscore-ok eltávolítása', () => {
    expect(slugifyProjectName('  /  test  /  ')).toBe('test');
  });

  it('40 karakterre vágás', () => {
    expect(slugifyProjectName('a'.repeat(60))).toHaveLength(40);
  });
});

describe('buildExportFilename', () => {
  const fixedDate = new Date('2026-05-03T14:30:00');

  it('projektnév nélkül → szalanyag_export_{stamp}.{ext}', () => {
    expect(buildExportFilename({ ext: 'pdf', date: fixedDate }))
      .toBe('szalanyag_export_2026-05-03_14-30.pdf');
  });

  it('projektnévvel → {slug}_szalanyag_export_{stamp}.{ext}', () => {
    expect(buildExportFilename({ projectName: 'Csarnok 2026', ext: 'xlsx', date: fixedDate }))
      .toBe('Csarnok_2026_szalanyag_export_2026-05-03_14-30.xlsx');
  });
});
