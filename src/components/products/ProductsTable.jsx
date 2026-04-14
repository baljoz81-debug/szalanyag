// Szabott termékek szerkeszthető táblázat — P5
import { useRef, useCallback } from 'react';
import EditableCell from '../ui/EditableCell';
import IconButton from '../ui/IconButton';
import useSettingsStore from '../../store/settingsStore';

const COLUMNS = [
  { key: 'quality',   label: 'Anyagminőség',      type: 'select', placeholder: 'Válassz...' },
  { key: 'type',      label: 'Típus',             type: 'select', placeholder: 'Válassz...' },
  { key: 'size',      label: 'Méret',             type: 'text',   placeholder: 'pl. 40x5' },
  { key: 'cutLength', label: 'Szabási hossz (mm)', type: 'number', placeholder: 'mm' },
  { key: 'quantity',  label: 'Darabszám (db)',     type: 'number', placeholder: 'db' },
];

function validatePositiveInt(val) {
  const num = parseFloat(val);
  return !isNaN(num) && num > 0 && Number.isInteger(num);
}

function SelectCell({ value, options, placeholder, onChange }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-input-bg text-text-primary px-2 py-1 rounded text-sm font-body border border-input-border focus:border-input-focus outline-none cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function ProductsTable({ rows, onUpdateCell, onAddRow, onRemoveRow }) {
  const tableRef = useRef(null);

  // Beállításokból olvassuk a legördülő opciókat
  const materialQualities = useSettingsStore((state) => state.materialQualities);
  const barLengths = useSettingsStore((state) => state.barLengths);

  const qualityOptions = materialQualities.map((q) => q.name).filter(Boolean);
  const typeOptions = barLengths.map((b) => b.type).filter(Boolean);

  // Tab/Enter navigáció: következő cella/sor
  const handleNavigate = useCallback((rowIndex, colIndex, key) => {
    if (!tableRef.current) return;

    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (key === 'Tab' || key === 'Enter') {
      nextCol++;
      if (nextCol >= COLUMNS.length) {
        nextCol = 0;
        nextRow++;
        // Ha az utolsó soron voltunk, adjunk hozzá újat
        if (nextRow >= rows.length) {
          onAddRow();
          // Kis késleltetés, hogy a DOM frissüljön az új sorral
          setTimeout(() => {
            focusCell(nextRow, nextCol);
          }, 50);
          return;
        }
      }
    }

    focusCell(nextRow, nextCol);
  }, [rows.length, onAddRow]);

  const focusCell = (rowIndex, colIndex) => {
    if (!tableRef.current) return;
    const cellSpan = tableRef.current.querySelector(
      `[data-row="${rowIndex}"][data-col="${colIndex}"] span`
    );
    if (cellSpan) cellSpan.click();
  };

  return (
    <div ref={tableRef}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border-subtle">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="text-left font-heading text-sm text-text-secondary px-2 py-2"
              >
                {col.label}
              </th>
            ))}
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id} className="border-b border-border-subtle/50 hover:bg-panel-hover/30">
              {COLUMNS.map((col, colIndex) => (
                <td
                  key={col.key}
                  className="px-1 py-0.5"
                  data-row={rowIndex}
                  data-col={colIndex}
                >
                  {col.type === 'select' ? (
                    <SelectCell
                      value={row[col.key]}
                      options={col.key === 'quality' ? qualityOptions : typeOptions}
                      placeholder={col.placeholder}
                      onChange={(val) => onUpdateCell(row.id, col.key, val)}
                    />
                  ) : (
                    <EditableCell
                      value={row[col.key]}
                      onChange={(val) => {
                        if (col.type === 'number') {
                          const num = parseInt(val, 10);
                          onUpdateCell(row.id, col.key, isNaN(num) ? '' : num);
                        } else {
                          onUpdateCell(row.id, col.key, val);
                        }
                      }}
                      type={col.type}
                      placeholder={col.placeholder}
                      validate={col.type === 'number' ? (v) => v === '' || validatePositiveInt(v) : undefined}
                      onNavigate={(key) => handleNavigate(rowIndex, colIndex, key)}
                    />
                  )}
                </td>
              ))}
              <td className="px-1 py-0.5 text-center">
                <IconButton
                  onClick={() => onRemoveRow(row.id)}
                  icon="delete"
                  title="Sor törlése"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={onAddRow}
        className="mt-3 text-accent hover:text-accent-hover font-body text-sm flex items-center gap-1 transition-colors"
      >
        <span className="text-lg leading-none">+</span> Sor hozzáadása
      </button>
    </div>
  );
}

export default ProductsTable;
