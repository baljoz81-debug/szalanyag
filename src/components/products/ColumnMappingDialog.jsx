// P9 — Manuális oszlop-hozzárendelés UI (mindig megjelenik import után)
import { useState, useMemo } from 'react';

const APP_FIELDS = [
  { key: 'quality',   label: 'Anyagminőség', required: false, fallback: 'S235 (alapértelmezett)' },
  { key: 'type',      label: 'Típus',        required: false, fallback: 'nincs megadva' },
  { key: 'size',      label: 'Méret',        required: true,  fallback: null },
  { key: 'cutLength', label: 'Szabási hossz (mm)', required: true,  fallback: null },
  { key: 'quantity',  label: 'Darabszám (db)',     required: true,  fallback: null },
];

const SIZE_EXTRA_FIELDS = [
  { key: 'size2', label: 'Méret 2 (opcionális)' },
  { key: 'size3', label: 'Méret 3 (opcionális)' },
];

function ColumnMappingDialog({
  headerRow,        // string[] | null — fejléc sor (ha volt)
  dataRows,         // any[][] — nyers adatsorok
  columnCount,      // number — oszlopok száma
  initialMapping,   // { quality: colIdx, ... } — előtöltés (auto-detected)
  autoDetected,     // boolean — sikerült-e automatikusan felismerni
  detectedType,     // string | null — felismert típus a címből
  detectedCategories, // string[] | null — anyaglista kategória típusok
  sheetName,        // string — munkalap neve
  onApply,          // (mapping, detectedType) => void
  onCancel,         // () => void
}) {
  const [mapping, setMapping] = useState(() => {
    const m = {};
    for (const f of APP_FIELDS) {
      m[f.key] = initialMapping[f.key] !== undefined ? String(initialMapping[f.key]) : '';
    }
    m.size2 = initialMapping.size2 !== undefined ? String(initialMapping.size2) : '';
    m.size3 = initialMapping.size3 !== undefined ? String(initialMapping.size3) : '';
    return m;
  });

  // Oszlopnevek generálása a legördülőhöz
  const columnOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < columnCount; i++) {
      const label = headerRow ? headerRow[i] || `${i + 1}. oszlop` : `${i + 1}. oszlop`;
      opts.push({ value: String(i), label: headerRow ? `${label}` : label });
    }
    return opts;
  }, [headerRow, columnCount]);

  // Előnézeti sorok (max 3 adatsor)
  const previewRows = useMemo(() => {
    return dataRows
      .filter((row) => {
        const nonEmpty = row.filter((cell) => String(cell).trim() !== '');
        if (nonEmpty.length === 0) return false;
        const firstCell = String(row[0]).toLowerCase().trim();
        if (firstCell.startsWith('összesen') || firstCell.startsWith('osszesen') || firstCell === 'sum') return false;
        return true;
      })
      .slice(0, 3);
  }, [dataRows]);

  const handleFieldChange = (fieldKey, value) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: value }));
  };

  // Összetett méret érték kiszámítása egy sorhoz
  const getSizeValue = (row) => {
    const parts = ['size', 'size2', 'size3']
      .map((key) => {
        const colIdx = mapping[key] !== '' ? parseInt(mapping[key], 10) : -1;
        return colIdx >= 0 && colIdx < row.length ? String(row[colIdx]).trim() : '';
      })
      .filter(Boolean);
    return parts.join('x');
  };

  const handleApply = () => {
    const numericMapping = {};
    for (const [key, val] of Object.entries(mapping)) {
      if (val !== '') {
        numericMapping[key] = parseInt(val, 10);
      }
    }
    onApply(numericMapping, detectedType);
  };

  // Legalább méret vagy hossz vagy darabszám legyen hozzárendelve
  const hasMinimumMapping = mapping.size !== '' || mapping.cutLength !== '' || mapping.quantity !== '';

  // Melyik oszlopok vannak már kiválasztva (duplikáció elkerülés)
  const usedColumns = new Set(Object.values(mapping).filter((v) => v !== ''));

  // Méret 2/3 csak akkor jelenjen meg, ha Méret 1 ki van választva
  const showSizeExtras = mapping.size !== '';

  const renderSelect = (fieldKey, label, required) => {
    const fieldDef = APP_FIELDS.find((f) => f.key === fieldKey);
    // Dinamikus hint: type mezőnél a detectedType-ot használjuk, ha van
    let hintText = null;
    if (mapping[fieldKey] === '') {
      if (fieldKey === 'type' && detectedType) {
        hintText = `${detectedType} (felismert)`;
      } else if (fieldKey === 'type' && detectedCategories?.length > 0) {
        hintText = detectedCategories.join(', ') + ' (felismert)';
      } else if (fieldDef?.fallback) {
        hintText = fieldDef.fallback;
      }
    }
    return (
      <div key={fieldKey} className="flex flex-col gap-1">
        <label className="font-body text-xs text-text-secondary">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
        <select
          value={mapping[fieldKey]}
          onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
          className="bg-input-bg border border-border-subtle rounded px-3 py-2 text-text-primary font-body text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">— Nincs hozzárendelve —</option>
          {columnOptions.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={usedColumns.has(opt.value) && mapping[fieldKey] !== opt.value}
            >
              {opt.label}
            </option>
          ))}
        </select>
        {hintText && (
          <span className="font-body text-xs text-blue-400/70 italic">
            → {hintText}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel border border-border-subtle rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Fejléc */}
        <h3 className="font-heading text-lg text-text-primary mb-1">
          Oszlop-hozzárendelés
        </h3>
        <p className="font-body text-sm text-text-secondary mb-4">
          {autoDetected
            ? `Automatikusan felismert oszlopok — ellenőrizd és szükség esetén módosítsd.`
            : `Kérlek rendeld hozzá a fájl oszlopait az app mezőihez.`}
          {sheetName && <span className="text-text-secondary/60"> Munkalap: {sheetName}</span>}
        </p>

        {/* Automatikus felismerés jelzés */}
        {autoDetected && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-900/30 border border-green-700/40 rounded text-sm text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Oszlopok automatikusan felismerve
            {detectedType && <span>— Típus: <strong>{detectedType}</strong></span>}
            {!detectedType && detectedCategories?.length > 0 && <span>— Típusok: <strong>{detectedCategories.join(', ')}</strong></span>}
          </div>
        )}

        {/* Hozzárendelés legördülők */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {APP_FIELDS.map((field) => (
            <div key={field.key}>
              {renderSelect(field.key, field.label, field.required)}
              {/* Méret extra oszlopok */}
              {field.key === 'size' && showSizeExtras && (
                <div className="mt-2 ml-3 border-l-2 border-accent/30 pl-3 flex flex-col gap-2">
                  <p className="font-body text-xs text-text-secondary/70">
                    Több oszlopból álló méret (pl. 40x30x3):
                  </p>
                  {SIZE_EXTRA_FIELDS.map((ef) =>
                    renderSelect(ef.key, ef.label, false)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Előnézet */}
        {previewRows.length > 0 && (
          <div className="mb-5">
            <h4 className="font-body text-xs text-text-secondary mb-2 uppercase tracking-wider">
              Előnézet (első {previewRows.length} adatsor)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {APP_FIELDS.map((field) => (
                      <th
                        key={field.key}
                        className="text-left py-1 px-2 text-text-secondary text-xs font-normal"
                      >
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-border-subtle/50">
                      {APP_FIELDS.map((field) => {
                        let cellValue;
                        if (field.key === 'size') {
                          cellValue = getSizeValue(row);
                        } else {
                          const colIdx = mapping[field.key] !== '' ? parseInt(mapping[field.key], 10) : -1;
                          cellValue = colIdx >= 0 && colIdx < row.length
                            ? String(row[colIdx]).trim()
                            : '';
                        }
                        let fallbackText = null;
                        if (!cellValue && mapping[field.key] === '') {
                          if (field.key === 'type' && detectedType) {
                            fallbackText = detectedType;
                          } else if (field.key === 'type' && row._categoryType) {
                            fallbackText = row._categoryType;
                          } else if (field.fallback) {
                            fallbackText = field.fallback;
                          }
                        }
                        return (
                          <td
                            key={field.key}
                            className={`py-1.5 px-2 ${cellValue ? 'text-text-primary' : fallbackText ? 'text-blue-400/70 italic text-xs' : 'text-text-secondary/40 italic'}`}
                          >
                            {cellValue || (fallbackText || '—')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gombok */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-text-secondary font-body text-sm hover:text-text-primary transition-colors"
          >
            Mégse
          </button>
          <button
            onClick={handleApply}
            disabled={!hasMinimumMapping}
            className="px-5 py-2 bg-accent text-white rounded font-body text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Betöltés
          </button>
        </div>
      </div>
    </div>
  );
}

export default ColumnMappingDialog;
