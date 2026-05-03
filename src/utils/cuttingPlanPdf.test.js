import { describe, it, expect, vi } from 'vitest';
import { buildCuttingPlanPdf } from './cuttingPlanPdf.js';

// A pdfFonts.js fetch-elne TTF-et — itt mockoljuk no-op-ra
vi.mock('./pdfFonts.js', () => ({
  ensureRobotoRegistered: vi.fn(async () => {}),
}));

const mkBar = (...lengths) => ({
  pieces: lengths.map((length) => ({ length })),
  usedLength: lengths.reduce((s, n) => s + n, 0),
  remainder: 0,
  utilization: 0.9,
});

const mkGroup = (overrides = {}) => ({
  key: 'k1',
  quality: 'S235',
  type: 'Laposacél',
  size: '40x5',
  barLength: 6000,
  bars: [mkBar(2500, 2500, 900), mkBar(2500, 2500, 900), mkBar(900, 900, 900, 900)],
  totalBars: 3,
  totalRemainder: 100,
  avgUtilization: 0.94,
  ...overrides,
});

describe('buildCuttingPlanPdf', () => {
  it('generál egy doc-ot legalább 1 oldallal', async () => {
    const doc = await buildCuttingPlanPdf({
      groups: [mkGroup()],
      cutLoss: 3,
      projectName: 'Teszt',
      setCount: 1,
    });
    expect(doc).toBeTruthy();
    expect(typeof doc.getNumberOfPages).toBe('function');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('üres groups → 1 oldal "Nincs megjeleníthető szabás" felirattal', async () => {
    const doc = await buildCuttingPlanPdf({ groups: [], cutLoss: 0 });
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('groups, ahol totalBars 0, kihagyva', async () => {
    const doc = await buildCuttingPlanPdf({
      groups: [{ ...mkGroup(), bars: [], totalBars: 0 }],
      cutLoss: 0,
    });
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('sok anyagcsoport → több oldal', async () => {
    const groups = Array.from({ length: 10 }, (_, i) => mkGroup({
      key: `k${i}`,
      size: `${20 + i}x5`,
    }));
    const doc = await buildCuttingPlanPdf({ groups, cutLoss: 3, projectName: 'Sok' });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('a generált PDF blob nem üres', async () => {
    const doc = await buildCuttingPlanPdf({
      groups: [mkGroup()],
      cutLoss: 3,
      projectName: 'Teszt',
    });
    const blob = doc.output('blob');
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/pdf');
  });
});
