import { describe, it, expect } from 'vitest';
import { barSignature, groupIdenticalBars, formatBarIndices, summarizePieces } from './cuttingPlanGroups.js';

const bar = (...lengths) => ({ pieces: lengths.map((length) => ({ length })) });

describe('barSignature', () => {
  it('rendezett darab-hosszak vesszővel', () => {
    expect(barSignature(bar(2500, 900, 2500))).toBe('2500,2500,900');
  });

  it('üres szál → üres string', () => {
    expect(barSignature({ pieces: [] })).toBe('');
    expect(barSignature(null)).toBe('');
  });

  it('érvénytelen hosszak kiszűrve', () => {
    expect(barSignature(bar(1500, 0, -100, NaN, 800))).toBe('1500,800');
  });
});

describe('groupIdenticalBars', () => {
  it('üres input → üres tömb', () => {
    expect(groupIdenticalBars([])).toEqual([]);
    expect(groupIdenticalBars(undefined)).toEqual([]);
  });

  it('különböző szálakat külön csoportba tesz', () => {
    const bars = [bar(2500, 2500, 900), bar(1500, 1500, 1500, 900), bar(900, 900, 900, 900)];
    const groups = groupIdenticalBars(bars);
    expect(groups).toHaveLength(3);
    expect(groups[0].indices).toEqual([0]);
    expect(groups[1].indices).toEqual([1]);
    expect(groups[2].indices).toEqual([2]);
  });

  it('azonos hosszú darabokat egy csoportba tesz, sorrendtől függetlenül', () => {
    const bars = [
      bar(2500, 2500, 900),
      bar(2500, 900, 2500), // ugyanaz, más sorrend
      bar(2500, 2500, 900),
    ];
    const groups = groupIdenticalBars(bars);
    expect(groups).toHaveLength(1);
    expect(groups[0].indices).toEqual([0, 1, 2]);
  });

  it('nem konszekutív azonos minták egy csoportba kerülnek', () => {
    const bars = [
      bar(2500, 2500),
      bar(1500, 1500, 1500),
      bar(2500, 2500),
    ];
    const groups = groupIdenticalBars(bars);
    expect(groups).toHaveLength(2);
    expect(groups[0].indices).toEqual([0, 2]); // azonos
    expect(groups[1].indices).toEqual([1]);
  });

  it('representative az első előfordulás', () => {
    const b1 = bar(2500, 2500);
    const b2 = bar(2500, 2500);
    const groups = groupIdenticalBars([b1, b2]);
    expect(groups[0].representative).toBe(b1);
  });
});

describe('summarizePieces', () => {
  it('üres input → üres tömb', () => {
    expect(summarizePieces([])).toEqual([]);
    expect(summarizePieces(undefined)).toEqual([]);
  });

  it('hosszanként összesít, csökkenő sorrend', () => {
    const out = summarizePieces([{ length: 900 }, { length: 2500 }, { length: 900 }, { length: 2500 }]);
    expect(out).toEqual([
      { length: 2500, count: 2 },
      { length: 900, count: 2 },
    ]);
  });

  it('érvénytelen hosszak kihagyva', () => {
    const out = summarizePieces([{ length: 0 }, { length: -100 }, { length: 'x' }, { length: 1500 }]);
    expect(out).toEqual([{ length: 1500, count: 1 }]);
  });

  it('sok különböző hossz csökkenő sorrendben', () => {
    const out = summarizePieces([
      { length: 10 }, { length: 320 }, { length: 490 }, { length: 10 },
      { length: 10 }, { length: 490 }, { length: 10 }, { length: 10 },
    ]);
    expect(out).toEqual([
      { length: 490, count: 2 },
      { length: 320, count: 1 },
      { length: 10, count: 5 },
    ]);
  });
});

describe('formatBarIndices', () => {
  it('üres → üres string', () => {
    expect(formatBarIndices([])).toBe('');
  });

  it('egyetlen index → 1-alapú szám', () => {
    expect(formatBarIndices([0])).toBe('1');
    expect(formatBarIndices([4])).toBe('5');
  });

  it('konszekutív tartomány → "1-4"', () => {
    expect(formatBarIndices([0, 1, 2, 3])).toBe('1-4');
  });

  it('nem konszekutív elemek vesszővel', () => {
    expect(formatBarIndices([0, 2])).toBe('1, 3');
  });

  it('vegyes tartományok és egyedi elemek', () => {
    expect(formatBarIndices([0, 1, 2, 4, 6, 7])).toBe('1-3, 5, 7-8');
  });

  it('rendezetlen bemenet rendezve formázódik', () => {
    expect(formatBarIndices([3, 0, 1, 2])).toBe('1-4');
  });
});
