// P9 — Manuális oszlop-hozzárendelés UI (mindig megjelenik import után)
import { useState, useMemo } from 'react';

const APP_FIELDS = [
  { key: 'quality',   label: 'Anyagminőség', required: false },
  { key: 'type',      label: 'Típus',        required: false },
  { key: 'size',      label: 'Méret',        required: true },
  { key: 'cutLength', label: 'Szabási hossz (mm)', required: true },
  { key: 'quantity',  label: 'Darabszám (db)',     required: true },
];

function ColumnMappingDialog({
  headerRow,        // string[] | null — fejléc sor (ha volt)
  dataRows,         // any[][] — nyers adatsorok
  columnCount,      // number — oszlopok száma
  initialMapping,   // { quality: colIdx, ... } — előtöltés (auto-detected)
  autoDetected,     // boolean — sikerült-e automatikusan felismerni
  detectedType,     // string | null — felismert típus a címből
  sheetName,        // string — munkalap neve
  onApply,          // (mapping, detectedType) => void
  onCancel,         // () => void
}) {
  const [mapping, setMapping] = useState(() => {
    const m = {};
    for (const f of APP_FIELDS) {
      m[f.key] = initialMapping[f.key] !== undefined ? String(initialMapping[f.key]) : '';
    }
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

  const handleApply = () => {
    // Mapping-et számokká konvertáljuk
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel-bg border border-border-subtle rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
          </div>
        )}

        {/* Hozzárendelés legördülők */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {APP_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="font-body text-xs text-text-secondary">
                {field.label}
                {field.required && <span className="text-danger ml-1">*</span>}
              </label>
              <select
                value={mapping[field.key]}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="bg-input-bg border border-border-subtle rounded px-3 py-2 text-text-primary font-body text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">— Nincs hozzárendelve —</option>
                {columnOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={usedColumns.has(opt.value) && mapping[field.key] !== opt.value}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
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
                        const colIdx = mapping[field.key] !== '' ? parseInt(mapping[field.key], 10) : -1;
                        const cellValue = colIdx >= 0 && colIdx < row.length
                          ? String(row[colIdx]).trim()
                          : '';
                        return (
                          <td
                            key={field.key}
                            className={`py-1.5 px-2 ${cellValue ? 'text-text-primary' : 'text-text-secondary/40 italic'}`}
                          >
                            {cellValue || '—'}
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
