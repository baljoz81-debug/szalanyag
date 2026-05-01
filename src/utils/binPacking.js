// Best-Fit Decreasing (BFD) bin-packing — P15
// Tiszta függvény, nincs Zustand/UI függés.

const DEFAULT_FALLBACK_BAR_LENGTH = 6000;

// Csoportonkénti megjelenítés: ha a legrövidebb szál usedLength-je eléri a
// barLength * FULL_BAR_THRESHOLD-ot, az is "teljesnek" számít — különben
// "részleges" és a hossza méterben (felfelé 0,1 m-re kerekítve) jelenik meg.
const FULL_BAR_THRESHOLD = 0.9;

const ceilToTenthMeter = (mm) => Math.ceil(mm / 100) / 10;

const normalizeType = (s) => String(s ?? '').trim().toLowerCase();

const buildBarLengthResolver = (barLengths) => {
  const map = new Map();
  let fallback = DEFAULT_FALLBACK_BAR_LENGTH;
  for (const bl of barLengths ?? []) {
    if (!bl?.type) continue;
    const len = Number(bl.length);
    if (!Number.isFinite(len) || len <= 0) continue;
    map.set(normalizeType(bl.type), len);
    if (bl.deletable === false) fallback = len;
  }
  return (type) => {
    const hit = map.get(normalizeType(type));
    if (hit != null) return { length: hit, source: 'matched' };
    return { length: fallback, source: 'default' };
  };
};

const isRowEmpty = (row) =>
  !row.quality && !row.type && !row.size && !row.cutLength && !row.quantity;

export function calculatePacking({ rows = [], barLengths = [], cutLoss = 0, setCount = 1, barLengthOverrides = {} } = {}) {
  const safeCutLoss = Math.max(0, Number(cutLoss) || 0);
  const safeSetCount = Math.max(1, Math.floor(Number(setCount) || 1));
  const resolveBar = buildBarLengthResolver(barLengths);

  const errors = [];
  const groupMap = new Map();

  for (const row of rows) {
    if (!row || isRowEmpty(row)) continue;
    const cutLength = Number(row.cutLength);
    const quantity = Number(row.quantity);
    if (!Number.isFinite(cutLength) || cutLength <= 0 ||
        !Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ rowId: row.id, reason: 'invalid_row', detail: { cutLength: row.cutLength, quantity: row.quantity } });
      continue;
    }

    const key = `${row.quality ?? ''}|${row.type ?? ''}|${row.size ?? ''}`;
    let group = groupMap.get(key);
    if (!group) {
      const overrideLen = Number(barLengthOverrides?.[key]);
      const hasOverride = Number.isFinite(overrideLen) && overrideLen > 0;
      const resolved = hasOverride
        ? { length: overrideLen, source: 'override' }
        : resolveBar(row.type);
      group = {
        key,
        quality: row.quality ?? '',
        type: row.type ?? '',
        size: row.size ?? '',
        barLength: resolved.length,
        barLengthSource: resolved.source,
        pieces: [],
      };
      groupMap.set(key, group);
    }

    const totalQty = Math.floor(quantity) * safeSetCount;
    for (let i = 0; i < totalQty; i++) {
      group.pieces.push({ length: cutLength, rowId: row.id });
    }
  }

  const groups = [];
  let totalPiecesPlaced = 0;

  for (const group of groupMap.values()) {
    const { barLength } = group;
    const fits = [];
    for (const p of group.pieces) {
      if (p.length > barLength) {
        errors.push({ rowId: p.rowId, reason: 'piece_too_long', detail: { length: p.length, barLength } });
      } else {
        fits.push(p);
      }
    }

    fits.sort((a, b) => b.length - a.length);

    const bars = [];
    for (const piece of fits) {
      let bestIdx = -1;
      let bestRemainder = Infinity;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const newUsed = bar.usedLength + safeCutLoss + piece.length;
        if (newUsed <= barLength) {
          const newRemainder = barLength - newUsed;
          if (newRemainder < bestRemainder) {
            bestRemainder = newRemainder;
            bestIdx = i;
          }
        }
      }
      if (bestIdx === -1) {
        bars.push({ pieces: [piece], usedLength: piece.length });
      } else {
        const bar = bars[bestIdx];
        bar.usedLength += safeCutLoss + piece.length;
        bar.pieces.push(piece);
      }
    }

    const finalBars = bars.map((b) => ({
      pieces: b.pieces,
      usedLength: b.usedLength,
      remainder: barLength - b.usedLength,
      utilization: barLength > 0 ? b.usedLength / barLength : 0,
    }));

    const totalBars = finalBars.length;
    const totalRemainder = finalBars.reduce((s, b) => s + b.remainder, 0);
    const avgUtilization = totalBars > 0
      ? finalBars.reduce((s, b) => s + b.utilization, 0) / totalBars
      : 0;

    totalPiecesPlaced += fits.length;

    groups.push({
      key: group.key,
      quality: group.quality,
      type: group.type,
      size: group.size,
      barLength,
      barLengthSource: group.barLengthSource,
      bars: finalBars,
      totalBars,
      totalRemainder,
      avgUtilization,
    });
  }

  // Súlyozott összesített kihasználtság: Σ usedLength / Σ barLength
  let sumUsed = 0;
  let sumCapacity = 0;
  let totalBars = 0;
  for (const g of groups) {
    totalBars += g.totalBars;
    sumCapacity += g.totalBars * g.barLength;
    for (const b of g.bars) sumUsed += b.usedLength;
  }
  const summary = {
    materialTypeCount: groups.length,
    totalBars,
    totalPiecesPlaced,
    avgUtilization: sumCapacity > 0 ? sumUsed / sumCapacity : 0,
  };

  return { groups, summary, errors };
}

// ────────────────────────────────────────────────────────────────────────
// Display helper-ek
// A számolás a calculatePacking eredményét NEM módosítja — egy display
// rétegben adja vissza az "utolsó szál mint részleges anyag" mutatókat.
// ────────────────────────────────────────────────────────────────────────

export function summarizeGroupForDisplay(group, fullThreshold = FULL_BAR_THRESHOLD) {
  if (!group || group.totalBars === 0) {
    return { full: 0, partialMeters: 0, hasPartial: false };
  }
  let minUsedLength = Infinity;
  for (const b of group.bars) {
    if (b.usedLength < minUsedLength) minUsedLength = b.usedLength;
  }
  if (group.barLength > 0 && minUsedLength / group.barLength >= fullThreshold) {
    return { full: group.totalBars, partialMeters: 0, hasPartial: false };
  }
  return {
    full: group.totalBars - 1,
    partialMeters: ceilToTenthMeter(minUsedLength),
    hasPartial: true,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Probléma-megoldások: rows preprocesszor wrapper
// solution mezők:
//   { kind: 'skip' }                              — sor kihagyása
//   { kind: 'split', parts: [length, length, …] } — sor felbontása részekre
//   { kind: 'customBar', barLength: number }      — egyedi szálhossz
// A wrapper a rows-t transzformálja, majd a calculatePacking-et hívja.
// Az eredmény groups-ai közül a customBar-csoportok flagelve és az eredeti
// type-pal jelennek meg.
// ────────────────────────────────────────────────────────────────────────

const CBAR_TYPE_PREFIX = '__cbar';

export function calculatePackingWithSolutions({ rows = [], barLengths = [], cutLoss = 0, setCount = 1, barLengthOverrides = {} } = {}) {
  const transformedRows = [];
  const customBarTypeMap = new Map();   // 'origType__cbar9000' → origType
  const customBarLengthMap = new Map(); // 'origType__cbar9000' → 9000
  const skippedRowIds = [];

  for (const row of rows) {
    const sol = row?.solution;
    if (!sol || !sol.kind) {
      transformedRows.push(row);
      continue;
    }

    if (sol.kind === 'skip') {
      skippedRowIds.push(row.id);
      continue;
    }

    if (sol.kind === 'split' && Array.isArray(sol.parts) && sol.parts.length > 0) {
      sol.parts.forEach((partLen, i) => {
        const len = Number(partLen);
        if (!Number.isFinite(len) || len <= 0) return;
        transformedRows.push({
          ...row,
          id: `${row.id}__sp${i}`,
          cutLength: len,
          solution: null,
        });
      });
      continue;
    }

    if (sol.kind === 'customBar' && Number(sol.barLength) > 0) {
      const origType = row.type ?? '';
      const customType = `${origType}${CBAR_TYPE_PREFIX}${sol.barLength}`;
      customBarTypeMap.set(customType, origType);
      customBarLengthMap.set(customType, Number(sol.barLength));
      transformedRows.push({
        ...row,
        id: `${row.id}__cbar`,
        type: customType,
        solution: null,
      });
      continue;
    }

    // Ismeretlen kind → változatlan
    transformedRows.push(row);
  }

  // Ad-hoc barLengths bejegyzések a customBar típusoknak
  const effectiveBarLengths = [
    ...Array.from(customBarLengthMap.entries()).map(([type, length]) => ({
      type, length, deletable: true,
    })),
    ...barLengths,
  ];

  const result = calculatePacking({
    rows: transformedRows,
    barLengths: effectiveBarLengths,
    cutLoss,
    setCount,
    barLengthOverrides,
  });

  // Type visszaállítás + customBar flag
  const groups = result.groups.map((g) => {
    const origType = customBarTypeMap.get(g.type);
    if (origType !== undefined) {
      return {
        ...g,
        key: `${g.quality}|${origType}|${g.size}|@${g.barLength}`,
        type: origType,
        customBar: true,
        barLengthSource: 'custom',
      };
    }
    return g;
  });

  return {
    ...result,
    groups,
    skippedRowIds,
  };
}

export function summarizeForDisplay(result, fullThreshold = FULL_BAR_THRESHOLD) {
  const groups = result.groups.map((g) => ({
    ...g,
    displayBars: summarizeGroupForDisplay(g, fullThreshold),
  }));
  let totalFullBars = 0;
  let totalPartialGroups = 0;
  for (const g of groups) {
    totalFullBars += g.displayBars.full;
    if (g.displayBars.hasPartial) totalPartialGroups += 1;
  }
  return {
    ...result,
    groups,
    summary: {
      ...result.summary,
      totalFullBars,
      totalPartialGroups,
    },
  };
}

