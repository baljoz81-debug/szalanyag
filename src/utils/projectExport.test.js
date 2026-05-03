import { describe, it, expect } from 'vitest';
import {
  SCHEMA,
  SCHEMA_VERSION,
  buildProjectJson,
  parseProjectJson,
} from './projectExport.js';

const sampleSettings = {
  barLengths: [{ id: '1', type: 'Laposacél', length: 6000, deletable: true }],
  materialQualities: [{ id: 'q1', name: 'S235' }],
  defaultCutLoss: 3,
  defaultSetCount: 2,
};

const sampleProductsRows = [
  { id: 'p1', quality: 'S235', type: 'Laposacél', size: '40x5', cutLength: '1500', quantity: '10' },
  { id: 'p2', quality: '',     type: '',          size: '',     cutLength: '',     quantity: ''   }, // üres → kiszűrve
];

const sampleCalculation = {
  rows: [
    {
      id: 'c1', quality: 'S235', type: 'Laposacél', size: '40x5',
      cutLength: '2000', quantity: '5',
      solution: { kind: 'split', parts: [4000, 1500] },
    },
  ],
  cutLossOverride: 5,
  setCountOverride: null,
  barLengthOverrides: { 'S235|Laposacél|40x5': 8000 },
  projectName: 'Tesztprojekt',
};

describe('buildProjectJson', () => {
  it('kötelező mezőket állít elő', () => {
    const out = buildProjectJson({
      settings: sampleSettings,
      products: { rows: sampleProductsRows },
      calculation: sampleCalculation,
    });
    expect(out.schema).toBe(SCHEMA);
    expect(out.version).toBe(SCHEMA_VERSION);
    expect(typeof out.savedAt).toBe('string');
    expect(out.projectName).toBe('Tesztprojekt');
  });

  it('üres products / üres calculation soroknál kiszűr', () => {
    const out = buildProjectJson({
      settings: sampleSettings,
      products: { rows: sampleProductsRows },
      calculation: { rows: [] },
    });
    expect(out.products.rows).toHaveLength(1);
    expect(out.calculation.rows).toEqual([]);
  });

  it('barLengthOverrides shallow-másolva, nem ugyanaz a referencia', () => {
    const out = buildProjectJson({
      settings: sampleSettings,
      products: { rows: [] },
      calculation: sampleCalculation,
    });
    expect(out.calculation.barLengthOverrides).toEqual(sampleCalculation.barLengthOverrides);
    expect(out.calculation.barLengthOverrides).not.toBe(sampleCalculation.barLengthOverrides);
  });

  it('hiányzó input → biztonságos default-ok', () => {
    const out = buildProjectJson({});
    expect(out.settings.barLengths).toEqual([]);
    expect(out.settings.defaultCutLoss).toBe(0);
    expect(out.settings.defaultSetCount).toBe(1);
    expect(out.products.rows).toEqual([]);
    expect(out.calculation.rows).toEqual([]);
    expect(out.calculation.cutLossOverride).toBeNull();
    expect(out.calculation.barLengthOverrides).toEqual({});
  });

  it('JSON.stringify-olható kör nélkül', () => {
    const out = buildProjectJson({
      settings: sampleSettings,
      products: { rows: sampleProductsRows },
      calculation: sampleCalculation,
    });
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it('a megőrzi a calculation rows solution mezőjét', () => {
    const out = buildProjectJson({
      settings: sampleSettings,
      products: { rows: [] },
      calculation: sampleCalculation,
    });
    expect(out.calculation.rows[0].solution).toEqual({ kind: 'split', parts: [4000, 1500] });
  });
});

describe('parseProjectJson', () => {
  const validPayload = () => buildProjectJson({
    settings: sampleSettings,
    products: { rows: sampleProductsRows },
    calculation: sampleCalculation,
  });

  it('sikeres parse-olás visszaadja a normalizált payloadot', () => {
    const text = JSON.stringify(validPayload());
    const result = parseProjectJson(text);
    expect(result.ok).toBe(true);
    expect(result.data.projectName).toBe('Tesztprojekt');
    expect(result.data.calculation.rows).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('érvénytelen JSON → ok: false', () => {
    const result = parseProjectJson('nem json');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/JSON/);
  });

  it('idegen schema → ok: false', () => {
    const text = JSON.stringify({ schema: 'masik-app', version: '1.0' });
    const result = parseProjectJson(text);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/szálanyag-projekt/);
  });

  it('hiányzó settings/products/calculation → ok: false', () => {
    const text = JSON.stringify({ schema: SCHEMA, version: SCHEMA_VERSION });
    const result = parseProjectJson(text);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/kötelező/);
  });

  it('ismeretlen verzió → warning, de ok: true', () => {
    const payload = validPayload();
    payload.version = '2.7-future';
    const result = parseProjectJson(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/2\.7-future/);
  });

  it('roundtrip: build → JSON → parse → ekvivalens kalkuláció', () => {
    const built = validPayload();
    const result = parseProjectJson(JSON.stringify(built));
    expect(result.ok).toBe(true);
    expect(result.data.calculation.rows).toEqual(built.calculation.rows);
    expect(result.data.calculation.barLengthOverrides).toEqual(built.calculation.barLengthOverrides);
    expect(result.data.settings.barLengths).toEqual(built.settings.barLengths);
  });
});
