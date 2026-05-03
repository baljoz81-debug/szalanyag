import { describe, it, expect } from 'vitest';
import {
  PRODUCTS_HEADER,
  buildProductsRows,
  buildProductsTsv,
} from './productsExport.js';

const mkRow = (overrides = {}) => ({
  id: 'r1',
  quality: 'S235',
  type: 'Laposacél',
  size: '40x5',
  cutLength: '1500',
  quantity: '10',
  ...overrides,
});

describe('buildProductsRows', () => {
  it('üres input → üres tömb', () => {
    expect(buildProductsRows([])).toEqual([]);
    expect(buildProductsRows(undefined)).toEqual([]);
  });

  it('üres helykitöltő sorokat kihagyja', () => {
    const rows = [
      { id: 'a', quality: '', type: '', size: '', cutLength: '', quantity: '' },
      mkRow({ id: 'b' }),
    ];
    expect(buildProductsRows(rows)).toHaveLength(1);
  });

  it('cutLength és quantity számmá konvertálva', () => {
    const r = buildProductsRows([mkRow()])[0];
    expect(r).toEqual(['S235', 'Laposacél', '40x5', 1500, 10]);
    expect(typeof r[3]).toBe('number');
    expect(typeof r[4]).toBe('number');
  });

  it('hiányzó számértékek üres stringként', () => {
    const r = buildProductsRows([mkRow({ cutLength: '', quantity: null })])[0];
    expect(r[3]).toBe('');
    expect(r[4]).toBe('');
  });

  it('header és sor hossz egyezik', () => {
    expect(buildProductsRows([mkRow()])[0]).toHaveLength(PRODUCTS_HEADER.length);
  });

  it('részlegesen kitöltött sor (csak quality) érdeminek számít', () => {
    const rows = [{ id: 'p', quality: 'S355', type: '', size: '', cutLength: '', quantity: '' }];
    expect(buildProductsRows(rows)).toEqual([['S355', '', '', '', '']]);
  });
});

describe('buildProductsTsv', () => {
  const HEADER_LINE =
    'Anyagminőség\tTípus\tMéret\tSzabási hossz (mm)\tDarabszám (db)';

  it('üres rows → csak fejléc', () => {
    expect(buildProductsTsv([])).toBe(HEADER_LINE);
  });

  it('rows + projektnév → meta + üres + fejléc + adatok', () => {
    const tsv = buildProductsTsv([mkRow()], { projectName: 'Csarnok-2026' });
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('Projekt\tCsarnok-2026');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(HEADER_LINE);
    expect(lines[3]).toBe('S235\tLaposacél\t40x5\t1500\t10');
  });

  it('üres projektnév → nincs meta blokk', () => {
    const tsv = buildProductsTsv([mkRow()], { projectName: '' });
    const lines = tsv.split('\n');
    expect(lines[0]).toBe(HEADER_LINE);
    expect(lines[1]).toBe('S235\tLaposacél\t40x5\t1500\t10');
  });

  it('érdektelen sor kihagyása az exportból', () => {
    const tsv = buildProductsTsv([
      { id: 'empty', quality: '', type: '', size: '', cutLength: '', quantity: '' },
      mkRow({ id: 'real' }),
    ]);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 adat
  });
});
