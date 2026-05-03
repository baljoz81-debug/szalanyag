// F3a — Azonos szabási tervű szálak összevonása a vizualizációban.
// Két szál akkor "azonos", ha pontosan ugyanazokat a darab-hosszakat tartalmazza
// (multiset egyenlőség — sorrend mindegy). A binPacking BFD-vel pakol csökkenő
// sorrend szerint, így az ugyanolyan minták egymás mellé esnek.

/**
 * Egy szál szignatúrája: rendezett darab-hosszak vesszővel.
 * Nem-érvényes hossz (NaN, <=0) kihagyva.
 */
export function barSignature(bar) {
  if (!bar || !Array.isArray(bar.pieces)) return '';
  return bar.pieces
    .map((p) => Number(p?.length) || 0)
    .filter((n) => n > 0)
    .sort((a, b) => b - a)
    .join(',');
}

/**
 * Csoportosítja a szálakat azonos szignatúra szerint.
 * @returns Array of { signature, indices: number[], representative: bar }
 *   - indices: a szál pozíciója a `bars` tömbben (0-alapú)
 *   - representative: az első szál ezzel a szignatúrával (vizualizációhoz)
 *   - A csoportok abban a sorrendben jönnek, ahogy az első szál előfordult.
 */
export function groupIdenticalBars(bars) {
  if (!Array.isArray(bars) || bars.length === 0) return [];
  const sigToGroup = new Map();
  const result = [];
  bars.forEach((bar, idx) => {
    const sig = barSignature(bar);
    let group = sigToGroup.get(sig);
    if (!group) {
      group = { signature: sig, indices: [], representative: bar };
      sigToGroup.set(sig, group);
      result.push(group);
    }
    group.indices.push(idx);
  });
  return result;
}

/**
 * Darab-hosszak tömörítése: hossz → darabszám, csökkenő hossz szerint.
 * @returns Array of { length: number, count: number }
 *
 * Példa: [2500, 900, 2500] → [{length:2500,count:2},{length:900,count:1}]
 */
export function summarizePieces(pieces) {
  if (!Array.isArray(pieces)) return [];
  const counts = new Map();
  for (const p of pieces) {
    const len = Number(p?.length) || 0;
    if (len <= 0) continue;
    counts.set(len, (counts.get(len) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([length, count]) => ({ length, count }))
    .sort((a, b) => b.length - a.length);
}

/**
 * Indexlista tömörítése konszekutív intervallumokká, 1-alapú megjelenítésre.
 * [0,1,2,4,6,7] → "1-3, 5, 7-8"
 * [0]           → "1"
 * [0,2]         → "1, 3"
 * [0,1,2,3]     → "1-4"
 */
export function formatBarIndices(indices) {
  if (!Array.isArray(indices) || indices.length === 0) return '';
  const sorted = [...indices].map((n) => Number(n) | 0).sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? String(start + 1) : `${start + 1}-${end + 1}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? String(start + 1) : `${start + 1}-${end + 1}`);
  return ranges.join(', ');
}
