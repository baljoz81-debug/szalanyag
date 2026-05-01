import { describe, it, expect } from 'vitest';
import { buildCalculationTsv } from './clipboardExport.js';

const mkGroup = (overrides = {}) => ({
  quality: 'S235', type: 'Laposacél', size: '40x5',
  barLength: 6000, totalBars: 2, totalRemainder: 1500, avgUtilization: 0.75,
  displayBars: { full: 2, hasPartial: false, partialMeters: 0 },
  ...overrides,
});

const HEADER_LINE =
  'Anyagminőség\tTípus\tMéret\tSzálhossz (mm)\tSzükséges anyagmennyiség (m)\tVágási veszteség (mm)\tSzükséges szálak (db)\tUtolsó szál (m)\tMaradék (mm)\tKihasználtság (%)';

describe('buildCalculationTsv — P21', () => {
  it('üres groups → csak fejléc', () => {
    const tsv = buildCalculationTsv([], 3);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(HEADER_LINE);
  });

  it('nincs részleges → utolsó szál üres, anyagmennyiség hu-HU 1 tizedessel', () => {
    const tsv = buildCalculationTsv([mkGroup()], 3);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].split('\t')).toEqual([
      'S235', 'Laposacél', '40x5',
      '6000', '12,0', '3', '2', '', '1500', '75,0',
    ]);
  });

  it('részleges szál → utolsó szál vesszős méter', () => {
    const g = mkGroup({
      totalBars: 2,
      displayBars: { full: 1, hasPartial: true, partialMeters: 1.5 },
    });
    const cells = buildCalculationTsv([g], 3).split('\n')[1].split('\t');
    expect(cells[4]).toBe('7,5'); // anyagmennyiség
    expect(cells[6]).toBe('1');   // szükséges szálak (db) = d.full, nem totalBars
    expect(cells[7]).toBe('1,5'); // utolsó szál
  });

  it('üres mező → üres string a TSV-ben', () => {
    const g = mkGroup({ quality: undefined, type: null, size: '' });
    const cells = buildCalculationTsv([g], 3).split('\n')[1].split('\t');
    expect(cells[0]).toBe('');
    expect(cells[1]).toBe('');
    expect(cells[2]).toBe('');
  });
});
