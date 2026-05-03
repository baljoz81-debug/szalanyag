import { describe, it, expect } from 'vitest';
import { buildCalculationTsv } from './clipboardExport.js';

const mkGroup = (overrides = {}) => ({
  quality: 'S235', type: 'Laposacél', size: '40x5',
  barLength: 6000, totalBars: 2, totalRemainder: 1500, avgUtilization: 0.75,
  displayBars: { full: 2, hasPartial: false, partialMeters: 0 },
  ...overrides,
});

const HEADER_LINE =
  'Anyagminőség\tTípus\tMéret\tSzálhossz (mm)\tSzükséges anyagmennyiség (m)\tSzükséges teljes szálak (db)\tUtolsó szál (m)\tMaradék (mm)\tKihasználtság (%)';

describe('buildCalculationTsv — P21', () => {
  // A cutLoss mindig metadata-ként kerül a TSV elejére; a fejléc utáni adat-sorok
  // a 3-as indextől kezdődnek (meta + üres + header + adatok).
  const dataLineFor = (tsv) => tsv.split('\n')[3];

  it('üres groups → meta(cutLoss) + üres + fejléc', () => {
    const tsv = buildCalculationTsv([], 3);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Vágási veszteség (mm)\t3');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(HEADER_LINE);
  });

  it('nincs részleges → utolsó szál üres, anyagmennyiség hu-HU 1 tizedessel', () => {
    const tsv = buildCalculationTsv([mkGroup()], 3);
    expect(dataLineFor(tsv).split('\t')).toEqual([
      'S235', 'Laposacél', '40x5',
      '6000', '12,0', '2', '', '1500', '75,0',
    ]);
  });

  it('részleges szál → utolsó szál vesszős méter', () => {
    const g = mkGroup({
      totalBars: 2,
      displayBars: { full: 1, hasPartial: true, partialMeters: 1.5 },
    });
    const cells = dataLineFor(buildCalculationTsv([g], 3)).split('\t');
    expect(cells[4]).toBe('7,5'); // anyagmennyiség
    expect(cells[5]).toBe('1');   // szükséges szálak (db) = d.full, nem totalBars
    expect(cells[6]).toBe('1,5'); // utolsó szál
  });

  it('üres mező → üres string a TSV-ben', () => {
    const g = mkGroup({ quality: undefined, type: null, size: '' });
    const cells = dataLineFor(buildCalculationTsv([g], 3)).split('\t');
    expect(cells[0]).toBe('');
    expect(cells[1]).toBe('');
    expect(cells[2]).toBe('');
  });

  it('projektnév + setCount + cutLoss metadata kerül a TSV elejére, üres elválasztóval', () => {
    const tsv = buildCalculationTsv([mkGroup()], 3, {
      projectName: 'Csarnok-2026',
      setCount: 4,
    });
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('Projekt\tCsarnok-2026');
    expect(lines[1]).toBe('Szettek száma\t4');
    expect(lines[2]).toBe('Vágási veszteség (mm)\t3');
    expect(lines[3]).toBe(''); // üres sor
    expect(lines[4]).toBe(HEADER_LINE);
    expect(lines).toHaveLength(6); // meta(3) + üres + header + 1 adat
  });

  it('csak projektnév → csak az + cutLoss kerül a meta blokkba', () => {
    const tsv = buildCalculationTsv([mkGroup()], 3, { projectName: 'X' });
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('Projekt\tX');
    expect(lines[1]).toBe('Vágási veszteség (mm)\t3');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe(HEADER_LINE);
  });

  it('cutLoss → meta blokkba kerül még options nélkül is', () => {
    const tsv = buildCalculationTsv([mkGroup()], 3);
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('Vágási veszteség (mm)\t3');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(HEADER_LINE);
  });
});
