// F4 — Teljes projekt mentés/betöltés JSON fájlban.
// Egy fájl tartalmazza a settingsStore + productsStore + calculationStore érdemi
// állapotát + projektnév és metaadatok. Verziózott séma a jövőbeli kompatibilitáshoz.
import { buildExportFilename } from './pdfExport.js';

export const SCHEMA = 'szalanyag-project';
export const SCHEMA_VERSION = '1.0';

const isMeaningfulProductRow = (r) =>
  !!(r && (r.quality || r.type || r.size || r.cutLength || r.quantity));

const isMeaningfulCalcRow = (r) =>
  !!(r && (r.quality || r.type || r.size || r.cutLength || r.quantity));

// ────────── Build payload ──────────

export function buildProjectJson({ settings, products, calculation, savedAt } = {}) {
  const s = settings || {};
  const p = products || {};
  const c = calculation || {};
  return {
    schema: SCHEMA,
    version: SCHEMA_VERSION,
    savedAt: savedAt || new Date().toISOString(),
    projectName: c.projectName || '',
    settings: {
      barLengths:        Array.isArray(s.barLengths)        ? s.barLengths        : [],
      materialQualities: Array.isArray(s.materialQualities) ? s.materialQualities : [],
      defaultCutLoss:    Number.isFinite(s.defaultCutLoss)  ? s.defaultCutLoss    : 0,
      defaultSetCount:   Number.isFinite(s.defaultSetCount) ? s.defaultSetCount   : 1,
    },
    products: {
      rows: (Array.isArray(p.rows) ? p.rows : []).filter(isMeaningfulProductRow),
    },
    calculation: {
      rows: (Array.isArray(c.rows) ? c.rows : []).filter(isMeaningfulCalcRow),
      cutLossOverride:    c.cutLossOverride  ?? null,
      setCountOverride:   c.setCountOverride ?? null,
      barLengthOverrides: c.barLengthOverrides && typeof c.barLengthOverrides === 'object'
        ? { ...c.barLengthOverrides }
        : {},
    },
  };
}

// ────────── Letöltés ──────────

export function downloadProjectJson(payload, { projectName, date } = {}) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const filename = buildExportFilename({
    prefix: 'szalanyag_projekt',
    projectName: projectName ?? payload?.projectName,
    ext: 'json',
    date,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return filename;
}

// ────────── Parse + validate ──────────

const ERR_INVALID_JSON       = 'A fájl nem érvényes JSON.';
const ERR_NOT_PROJECT        = 'A fájl nem szálanyag-projekt mentés.';
const ERR_MISSING_FIELDS     = 'A projekt fájlból hiányoznak kötelező mezők.';

/**
 * Visszaadja: { ok: true, data, warnings } vagy { ok: false, error }
 * - data: normalizált payload, mindig megvan az összes mező
 * - warnings: nem-blokkoló figyelmeztetések (pl. ismeretlen verzió)
 */
export function parseProjectJson(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: ERR_INVALID_JSON };
  }
  if (!raw || typeof raw !== 'object' || raw.schema !== SCHEMA) {
    return { ok: false, error: ERR_NOT_PROJECT };
  }
  if (!raw.settings || !raw.products || !raw.calculation) {
    return { ok: false, error: ERR_MISSING_FIELDS };
  }

  const warnings = [];
  if (raw.version !== SCHEMA_VERSION) {
    warnings.push(`Ismeretlen mentési verzió: ${raw.version ?? '?'} (várt: ${SCHEMA_VERSION}). A betöltés megkísérelhető.`);
  }

  const settings = raw.settings || {};
  const products = raw.products || {};
  const calculation = raw.calculation || {};

  const data = {
    schema: SCHEMA,
    version: raw.version || SCHEMA_VERSION,
    savedAt: raw.savedAt || null,
    projectName: typeof raw.projectName === 'string' ? raw.projectName : '',
    settings: {
      barLengths:        Array.isArray(settings.barLengths)        ? settings.barLengths        : [],
      materialQualities: Array.isArray(settings.materialQualities) ? settings.materialQualities : [],
      defaultCutLoss:    Number.isFinite(settings.defaultCutLoss)  ? settings.defaultCutLoss    : 0,
      defaultSetCount:   Number.isFinite(settings.defaultSetCount) ? settings.defaultSetCount   : 1,
    },
    products: {
      rows: Array.isArray(products.rows) ? products.rows.filter(isMeaningfulProductRow) : [],
    },
    calculation: {
      rows: Array.isArray(calculation.rows) ? calculation.rows.filter(isMeaningfulCalcRow) : [],
      cutLossOverride:    calculation.cutLossOverride  ?? null,
      setCountOverride:   calculation.setCountOverride ?? null,
      barLengthOverrides: calculation.barLengthOverrides && typeof calculation.barLengthOverrides === 'object'
        ? { ...calculation.barLengthOverrides }
        : {},
    },
  };

  return { ok: true, data, warnings };
}

// ────────── Fájl beolvasás (browser) ──────────

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('A fájl beolvasása sikertelen.'));
    reader.readAsText(file, 'utf-8');
  });
}
