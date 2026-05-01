import { describe, it, expect } from 'vitest';
import {
  calculatePacking,
  calculatePackingWithSolutions,
  summarizeGroupForDisplay,
  summarizeForDisplay,
} from './binPacking.js';

const defaultBars = [
  { id: '1', type: 'Laposacél',             length: 6000, deletable: true  },
  { id: '2', type: 'Köranyag',              length: 3000, deletable: true  },
  { id: '7', type: 'Egyéb / alapértelmezett', length: 6000, deletable: false },
];

describe('calculatePacking — alapeset', () => {
  it('üres input → üres groups, summary 0', () => {
    const r = calculatePacking({ rows: [], barLengths: defaultBars });
    expect(r.groups).toEqual([]);
    expect(r.summary).toEqual({ materialTypeCount: 0, totalBars: 0, totalPiecesPlaced: 0, avgUtilization: 0 });
    expect(r.errors).toEqual([]);
  });

  it('1 db pontosan szálhossz → 1 szál, 100%, 0 maradék', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 6000, quantity: 1 }],
      barLengths: defaultBars,
      cutLoss: 3,
      setCount: 1,
    });
    expect(r.groups).toHaveLength(1);
    const g = r.groups[0];
    expect(g.totalBars).toBe(1);
    expect(g.bars[0].usedLength).toBe(6000);
    expect(g.bars[0].remainder).toBe(0);
    expect(g.bars[0].utilization).toBe(1);
    expect(g.avgUtilization).toBe(1);
  });

  it('teljesen üres sort csendben kihagy, nem ad hibát', () => {
    const r = calculatePacking({
      rows: [{ id: 'empty', quality: '', type: '', size: '', cutLength: '', quantity: '' }],
      barLengths: defaultBars,
    });
    expect(r.groups).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});

describe('calculatePacking — vágási veszteség', () => {
  it('2 db × 2900 + cutLoss 200 → 1 szál (2900+200+2900=6000)', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 2900, quantity: 2 }],
      barLengths: defaultBars,
      cutLoss: 200,
    });
    expect(r.groups[0].totalBars).toBe(1);
    expect(r.groups[0].bars[0].usedLength).toBe(6000);
    expect(r.groups[0].bars[0].remainder).toBe(0);
  });

  it('3 darab szálban: usedLength = sum + 2*cutLoss', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 3 }],
      barLengths: defaultBars,
      cutLoss: 5,
    });
    expect(r.groups[0].totalBars).toBe(1);
    expect(r.groups[0].bars[0].usedLength).toBe(1000 + 5 + 1000 + 5 + 1000); // 3010
    expect(r.groups[0].bars[0].pieces).toHaveLength(3);
  });

  it('cutLoss=0 → tiszta összeg', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 2000, quantity: 3 }],
      barLengths: defaultBars,
      cutLoss: 0,
    });
    expect(r.groups[0].totalBars).toBe(1);
    expect(r.groups[0].bars[0].usedLength).toBe(6000);
    expect(r.groups[0].bars[0].remainder).toBe(0);
  });
});

describe('calculatePacking — több szál', () => {
  it('5 db × 2500, bar 6000, cutLoss 0 → 3 szál (2/2/1)', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 2500, quantity: 5 }],
      barLengths: defaultBars,
      cutLoss: 0,
    });
    expect(r.groups[0].totalBars).toBe(3);
    const used = r.groups[0].bars.map((b) => b.usedLength).sort((a, b) => b - a);
    expect(used).toEqual([5000, 5000, 2500]);
  });

  it('a darabok csökkenő rendezést követnek a packolás előtt', () => {
    const r = calculatePacking({
      rows: [
        { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 1 },
        { id: 'b', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 5000, quantity: 1 },
      ],
      barLengths: defaultBars,
      cutLoss: 0,
    });
    expect(r.groups[0].totalBars).toBe(1);
    expect(r.groups[0].bars[0].pieces.map((p) => p.length)).toEqual([5000, 1000]);
  });
});

describe('calculatePacking — csoportosítás', () => {
  it('különböző quality / type / size → külön csoportok', () => {
    const r = calculatePacking({
      rows: [
        { id: 'a', quality: 'S235', type: 'Laposacél',  size: '40x5',  cutLength: 1000, quantity: 1 },
        { id: 'b', quality: 'S355', type: 'Laposacél',  size: '40x5',  cutLength: 1000, quantity: 1 },
        { id: 'c', quality: 'S235', type: 'Köranyag',  size: 'D20',   cutLength: 1000, quantity: 1 },
        { id: 'd', quality: 'S235', type: 'Laposacél',  size: '50x10', cutLength: 1000, quantity: 1 },
      ],
      barLengths: defaultBars,
    });
    expect(r.groups).toHaveLength(4);
    expect(r.summary.materialTypeCount).toBe(4);
  });

  it('azonos quality/type/size egyetlen csoportba kerül a darabok összevontan', () => {
    const r = calculatePacking({
      rows: [
        { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 2 },
        { id: 'b', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1500, quantity: 1 },
      ],
      barLengths: defaultBars,
    });
    expect(r.groups).toHaveLength(1);
    expect(r.summary.totalPiecesPlaced).toBe(3);
  });
});

describe('calculatePacking — setCount', () => {
  it('setCount=3 → minden quantity ×3', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 2 }],
      barLengths: defaultBars,
      setCount: 3,
    });
    expect(r.summary.totalPiecesPlaced).toBe(6);
  });

  it('setCount < 1 vagy nem szám → 1-re igazítva', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 2 }],
      barLengths: defaultBars,
      setCount: 0,
    });
    expect(r.summary.totalPiecesPlaced).toBe(2);
  });

  it('setCount tört érték → lefelé kerekítés', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 1 }],
      barLengths: defaultBars,
      setCount: 2.9,
    });
    expect(r.summary.totalPiecesPlaced).toBe(2);
  });
});

describe('calculatePacking — type matching', () => {
  it('case-insensitive trim', () => {
    const r = calculatePacking({
      rows: [
        { id: 'a', quality: 'S235', type: '  laposacél ', size: '40x5', cutLength: 1000, quantity: 1 },
        { id: 'b', quality: 'S235', type: 'LAPOSACÉL',    size: '40x5', cutLength: 1000, quantity: 1 },
      ],
      barLengths: defaultBars,
    });
    // különböző type string → KÜLÖN csoport, de mindkettőre 6000 a barLength
    expect(r.groups.every((g) => g.barLength === 6000)).toBe(true);
    expect(r.groups.every((g) => g.barLengthSource === 'matched')).toBe(true);
  });

  it('ismeretlen type → fallback (Egyéb / alapértelmezett)', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'X', type: 'ValamiSpeciális', size: 'Y', cutLength: 1000, quantity: 1 }],
      barLengths: defaultBars,
    });
    expect(r.groups[0].barLength).toBe(6000);
    expect(r.groups[0].barLengthSource).toBe('default');
  });

  it('Köranyag típus a saját 3000-es szálhosszt használja', () => {
    const r = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Köranyag', size: 'D20', cutLength: 2000, quantity: 1 }],
      barLengths: defaultBars,
    });
    expect(r.groups[0].barLength).toBe(3000);
    expect(r.groups[0].barLengthSource).toBe('matched');
  });
});

describe('calculatePacking — hibák', () => {
  it('cutLength > barLength → piece_too_long, nem packolódik', () => {
    const r = calculatePacking({
      rows: [{ id: 'long', quality: 'S235', type: 'Köranyag', size: 'D20', cutLength: 5000, quantity: 2 }],
      barLengths: defaultBars,
    });
    expect(r.groups[0].totalBars).toBe(0);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0].reason).toBe('piece_too_long');
    expect(r.errors[0].rowId).toBe('long');
  });

  it('érvénytelen cutLength/quantity → invalid_row, számítás folytatódik', () => {
    const r = calculatePacking({
      rows: [
        { id: 'bad',  quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 0,    quantity: 1 },
        { id: 'good', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 1 },
      ],
      barLengths: defaultBars,
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].rowId).toBe('bad');
    expect(r.errors[0].reason).toBe('invalid_row');
    expect(r.groups[0].totalBars).toBe(1);
  });
});

describe('calculatePacking — összesítő', () => {
  it('avgUtilization súlyozott (Σ used / Σ capacity) több csoport esetén', () => {
    const r = calculatePacking({
      rows: [
        // 1 csoport: 1 db 6000mm → 1 szál 100%
        { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 6000, quantity: 1 },
        // 2 csoport: 1 db 1500mm → 1 szál 50% (Köranyag, bar=3000)
        { id: 'b', quality: 'S235', type: 'Köranyag',  size: 'D20',  cutLength: 1500, quantity: 1 },
      ],
      barLengths: defaultBars,
      cutLoss: 0,
    });
    // súlyozott: (6000 + 1500) / (6000 + 3000) = 7500 / 9000 = 0.8333...
    expect(r.summary.totalBars).toBe(2);
    expect(r.summary.materialTypeCount).toBe(2);
    expect(r.summary.avgUtilization).toBeCloseTo(7500 / 9000, 5);
  });
});

describe('summarizeGroupForDisplay — 90% küszöb', () => {
  const makeGroup = (barLength, usedLengths) => ({
    barLength,
    totalBars: usedLengths.length,
    bars: usedLengths.map((u) => ({ usedLength: u })),
  });

  it('üres csoport (totalBars=0) → 0 teljes, nincs részleges', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, []))).toEqual({
      full: 0, partialMeters: 0, hasPartial: false,
    });
  });

  it('1 szál 4312mm @ bar 6000 → 0 teljes + 4.4 m részleges', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, [4312]))).toEqual({
      full: 0, partialMeters: 4.4, hasPartial: true,
    });
  });

  it('1 szál pontosan 5400mm @ bar 6000 (= 90%) → 1 teljes, nincs részleges', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, [5400]))).toEqual({
      full: 1, partialMeters: 0, hasPartial: false,
    });
  });

  it('1 szál 5399mm @ bar 6000 (89.98%) → 0 teljes + 5.4 m részleges', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, [5399]))).toEqual({
      full: 0, partialMeters: 5.4, hasPartial: true,
    });
  });

  it('3 szál [6000, 6000, 4312] → 2 teljes + 4.4 m', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, [6000, 6000, 4312]))).toEqual({
      full: 2, partialMeters: 4.4, hasPartial: true,
    });
  });

  it('3 szál [6000, 5400, 6000] (min=90%) → 3 teljes', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, [6000, 5400, 6000]))).toEqual({
      full: 3, partialMeters: 0, hasPartial: false,
    });
  });

  it('3 szál mind 100% → 3 teljes', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, [6000, 6000, 6000]))).toEqual({
      full: 3, partialMeters: 0, hasPartial: false,
    });
  });

  it('felfelé kerekítés 0,1 m-re: 4300mm → 4.3 m, 4301mm → 4.4 m', () => {
    expect(summarizeGroupForDisplay(makeGroup(6000, [4300])).partialMeters).toBe(4.3);
    expect(summarizeGroupForDisplay(makeGroup(6000, [4301])).partialMeters).toBe(4.4);
  });
});

describe('summarizeForDisplay — összesítő', () => {
  const defaultBars = [
    { id: '1', type: 'Laposacél',             length: 6000, deletable: true  },
    { id: '7', type: 'Egyéb / alapértelmezett', length: 6000, deletable: false },
  ];

  it('totalFullBars + totalPartialGroups megjelenik a summary-ban', () => {
    const raw = calculatePacking({
      rows: [
        // 1 csoport: 1 db 6000mm → 1 teljes, 0 részleges (mind 100%)
        { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 6000, quantity: 1 },
        // 2 csoport: 1 db 4000mm → 0 teljes, 1 részleges (4.0 m)
        { id: 'b', quality: 'S235', type: 'Laposacél', size: '50x10', cutLength: 4000, quantity: 1 },
      ],
      barLengths: defaultBars,
      cutLoss: 0,
    });
    const r = summarizeForDisplay(raw);
    expect(r.summary.totalFullBars).toBe(1);
    expect(r.summary.totalPartialGroups).toBe(1);
  });

  it('minden csoport displayBars-szal bővül', () => {
    const raw = calculatePacking({
      rows: [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 4312, quantity: 1 }],
      barLengths: defaultBars,
      cutLoss: 0,
    });
    const r = summarizeForDisplay(raw);
    expect(r.groups[0].displayBars).toEqual({
      full: 0, partialMeters: 4.4, hasPartial: true,
    });
  });
});

describe('calculatePackingWithSolutions — probléma-megoldások', () => {
  const bars = [
    { id: '1', type: 'Laposacél',             length: 6000, deletable: true  },
    { id: '7', type: 'Egyéb / alapértelmezett', length: 6000, deletable: false },
  ];

  it('solution nélkül megegyezik a calculatePacking eredményével (groups)', () => {
    const rows = [{ id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 1 }];
    const r1 = calculatePacking({ rows, barLengths: bars });
    const r2 = calculatePackingWithSolutions({ rows, barLengths: bars });
    expect(r2.groups[0].totalBars).toBe(r1.groups[0].totalBars);
    expect(r2.skippedRowIds).toEqual([]);
  });

  it('skip → sor kihagyva, skippedRowIds tartalmazza', () => {
    const rows = [
      { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 9000, quantity: 1, solution: { kind: 'skip' } },
      { id: 'b', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 1 },
    ];
    const r = calculatePackingWithSolutions({ rows, barLengths: bars });
    expect(r.skippedRowIds).toEqual(['a']);
    expect(r.summary.totalPiecesPlaced).toBe(1);
    expect(r.errors.filter((e) => e.reason === 'piece_too_long')).toHaveLength(0);
  });

  it('split → 1 sor felbontása N részre, mind packolódik', () => {
    const rows = [{
      id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5',
      cutLength: 9000, quantity: 1,
      solution: { kind: 'split', parts: [6000, 3000] },
    }];
    const r = calculatePackingWithSolutions({ rows, barLengths: bars, cutLoss: 0 });
    expect(r.errors.filter((e) => e.reason === 'piece_too_long')).toHaveLength(0);
    expect(r.summary.totalPiecesPlaced).toBe(2); // 6000 + 3000 = 2 darab
    expect(r.groups[0].totalBars).toBe(2);       // 1 db 6000-es + 1 db 3000-es szál
  });

  it('split + quantity>1 → minden darab felosztódik a részekre', () => {
    const rows = [{
      id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5',
      cutLength: 9000, quantity: 2,
      solution: { kind: 'split', parts: [6000, 3000] },
    }];
    const r = calculatePackingWithSolutions({ rows, barLengths: bars, cutLoss: 0 });
    expect(r.summary.totalPiecesPlaced).toBe(4); // 2 db × 2 rész = 4
  });

  it('customBar → sor egyedi szálhosszal külön csoportba kerül', () => {
    const rows = [
      { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5',
        cutLength: 9000, quantity: 1,
        solution: { kind: 'customBar', barLength: 12000 } },
      { id: 'b', quality: 'S235', type: 'Laposacél', size: '40x5',
        cutLength: 1000, quantity: 1 },
    ];
    const r = calculatePackingWithSolutions({ rows, barLengths: bars });
    // 2 csoport: az egyik customBar-ral, a másik a normál
    expect(r.groups).toHaveLength(2);
    const cbarGroup  = r.groups.find((g) => g.customBar);
    const normGroup  = r.groups.find((g) => !g.customBar);
    expect(cbarGroup.type).toBe('Laposacél');                       // visszaállított
    expect(cbarGroup.barLength).toBe(12000);
    expect(cbarGroup.barLengthSource).toBe('custom');
    expect(cbarGroup.totalBars).toBe(1);
    expect(normGroup.barLength).toBe(6000);
    expect(normGroup.totalBars).toBe(1);
  });

  it('customBar barLength < cutLength → még mindig piece_too_long', () => {
    const rows = [{
      id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5',
      cutLength: 9000, quantity: 1,
      solution: { kind: 'customBar', barLength: 8000 },
    }];
    const r = calculatePackingWithSolutions({ rows, barLengths: bars });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].reason).toBe('piece_too_long');
  });

  it('skip + split + customBar kombinálva ugyanazon hívásban', () => {
    const rows = [
      { id: 's',  quality: 'S235', type: 'Laposacél', size: '40x5',
        cutLength: 9000, quantity: 1, solution: { kind: 'skip' } },
      { id: 'sp', quality: 'S235', type: 'Laposacél', size: '40x5',
        cutLength: 8000, quantity: 1,
        solution: { kind: 'split', parts: [4000, 4000] } },
      { id: 'cb', quality: 'S235', type: 'Laposacél', size: '40x5',
        cutLength: 9000, quantity: 1,
        solution: { kind: 'customBar', barLength: 12000 } },
    ];
    const r = calculatePackingWithSolutions({ rows, barLengths: bars });
    expect(r.skippedRowIds).toEqual(['s']);
    expect(r.errors.filter((e) => e.reason === 'piece_too_long')).toHaveLength(0);
    expect(r.summary.totalPiecesPlaced).toBe(3); // 2 split-rész + 1 customBar darab
  });
});

describe('calculatePacking — barLengthOverrides (P17)', () => {
  const bars = [
    { id: '1', type: 'Laposacél',             length: 6000, deletable: true  },
    { id: '7', type: 'Egyéb / alapértelmezett', length: 6000, deletable: false },
  ];

  it('override felülírja a típus-szintű szálhosszt az adott group-ra', () => {
    const rows = [
      { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 5000, quantity: 1 },
    ];
    const key = 'S235|Laposacél|40x5';
    const r = calculatePacking({
      rows, barLengths: bars, cutLoss: 0,
      barLengthOverrides: { [key]: 9000 },
    });
    expect(r.groups[0].barLength).toBe(9000);
    expect(r.groups[0].barLengthSource).toBe('override');
    expect(r.groups[0].bars[0].usedLength).toBe(5000);
    expect(r.groups[0].bars[0].remainder).toBe(4000);
  });

  it('override csak a megegyező key-re hat — másik csoport változatlan', () => {
    const rows = [
      { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 5000, quantity: 1 },
      { id: 'b', quality: 'S235', type: 'Laposacél', size: '50x5', cutLength: 5000, quantity: 1 },
    ];
    const r = calculatePacking({
      rows, barLengths: bars, cutLoss: 0,
      barLengthOverrides: { 'S235|Laposacél|40x5': 9000 },
    });
    const g40 = r.groups.find((g) => g.size === '40x5');
    const g50 = r.groups.find((g) => g.size === '50x5');
    expect(g40.barLength).toBe(9000);
    expect(g40.barLengthSource).toBe('override');
    expect(g50.barLength).toBe(6000);
    expect(g50.barLengthSource).toBe('matched');
  });

  it('érvénytelen override (0, negatív, NaN) → fallback a settings értékére', () => {
    const rows = [
      { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 1000, quantity: 1 },
    ];
    for (const v of [0, -1, 'foo', null, undefined]) {
      const r = calculatePacking({
        rows, barLengths: bars,
        barLengthOverrides: { 'S235|Laposacél|40x5': v },
      });
      expect(r.groups[0].barLength).toBe(6000);
      expect(r.groups[0].barLengthSource).toBe('matched');
    }
  });

  it('calculatePackingWithSolutions átadja az override-okat a calculatePacking-nek', () => {
    const rows = [
      { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: 5000, quantity: 1 },
    ];
    const r = calculatePackingWithSolutions({
      rows, barLengths: bars,
      barLengthOverrides: { 'S235|Laposacél|40x5': 9000 },
    });
    expect(r.groups[0].barLength).toBe(9000);
    expect(r.groups[0].barLengthSource).toBe('override');
  });

  it('customBar megoldás kulcsa eltér az override key-től → customBar nyer', () => {
    // A customBar key formája: `${quality}|${origType}|${size}|@${barLength}` —
    // a sima override key (`quality|type|size`) nem matchel rá.
    const rows = [
      { id: 'a', quality: 'S235', type: 'Laposacél', size: '40x5',
        cutLength: 9000, quantity: 1,
        solution: { kind: 'customBar', barLength: 12000 } },
    ];
    const r = calculatePackingWithSolutions({
      rows, barLengths: bars,
      barLengthOverrides: { 'S235|Laposacél|40x5': 7000 },
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].customBar).toBe(true);
    expect(r.groups[0].barLength).toBe(12000);
  });
});

describe('calculatePacking — perf', () => {
  it('100 sor × 10 db (1000 darab) < 500ms', () => {
    const rows = [];
    for (let i = 0; i < 100; i++) {
      rows.push({
        id: `r${i}`,
        quality: 'S235',
        type: i % 2 === 0 ? 'Laposacél' : 'Köranyag',
        size: `s${i % 5}`,
        cutLength: 500 + (i * 37) % 2000,
        quantity: 10,
      });
    }
    const t0 = performance.now();
    const r = calculatePacking({ rows, barLengths: defaultBars, cutLoss: 3 });
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(500);
    expect(r.summary.totalPiecesPlaced).toBe(1000);
  });
});
