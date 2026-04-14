// Szálhossz konfiguráló tábla — anyagtípus + szálhossz inline edit, sor hozzáadás/törlés/átrendezés
import { useState } from 'react';
import EditableCell from '../ui/EditableCell';
import IconButton from '../ui/IconButton';
import useDragReorder from '../../hooks/useDragReorder';

// Validációs szabályok
const validateLength = (val) => {
  const num = parseFloat(val);
  return !isNaN(num) && Number.isInteger(num) && num >= 1 && num <= 99999;
};

const validateType = (val) => {
  const trimmed = String(val).trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
};

function DragHandle() {
  return (
    <span className="cursor-grab active:cursor-grabbing text-text-secondary hover:text-text-primary transition-colors select-none" title="Húzd az átrendezéshez">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
      </svg>
    </span>
  );
}

function BarLengthTable({ barLengths, onUpdateLength, onUpdateType, onAdd, onRemove, onReorder }) {
  const [newlyAddedId, setNewlyAddedId] = useState(null);
  const { getDragProps, overIndex } = useDragReorder(onReorder);

  const handleAdd = () => {
    setNewlyAddedId('__pending__');
    onAdd();
  };

  const lastBarId = barLengths.length > 0 ? barLengths[barLengths.length - 1].id : null;
  const lastBar = barLengths.length > 0 ? barLengths[barLengths.length - 1] : null;
  const isNewRow = (item) =>
    newlyAddedId === '__pending__' &&
    item.id === lastBarId &&
    lastBar?.deletable === true &&
    lastBar?.type === '';

  return (
    <div className="w-full">
      {/* Fejléc */}
      <div className="grid grid-cols-[28px_1fr_160px_48px] gap-2 px-2 pb-2 border-b border-border-subtle mb-1">
        <span></span>
        <span className="font-heading text-sm text-text-secondary">Anyagtípus neve</span>
        <span className="font-heading text-sm text-text-secondary">Szálhossz (mm)</span>
        <span></span>
      </div>

      {/* Sorok */}
      {barLengths.map((item, index) => (
        <div
          key={item.id}
          {...getDragProps(index)}
          className={`grid grid-cols-[28px_1fr_160px_48px] gap-2 items-center px-2 py-1 rounded hover:bg-panel-hover transition-colors ${
            overIndex === index ? 'border-t-2 border-accent' : 'border-t-2 border-transparent'
          }`}
        >
          {/* Drag handle */}
          <DragHandle />

          {/* Anyagtípus neve */}
          <EditableCell
            value={item.type}
            onChange={(newVal) => onUpdateType(item.id, newVal.trim())}
            type="text"
            placeholder="Típusnév..."
            validate={validateType}
            autoFocus={isNewRow(item)}
          />

          {/* Szálhossz */}
          <EditableCell
            value={item.length}
            onChange={(newVal) => {
              const num = parseInt(newVal, 10);
              if (!isNaN(num)) onUpdateLength(item.id, num);
            }}
            type="number"
            placeholder="mm"
            validate={validateLength}
          />

          {/* Törlés gomb */}
          <div className="flex justify-center">
            <IconButton
              onClick={() => onRemove(item.id)}
              icon="delete"
              disabled={!item.deletable}
              title={item.deletable ? 'Sor törlése' : 'Ez a sor nem törölhető'}
              variant="danger"
            />
          </div>
        </div>
      ))}

      {/* Sor hozzáadása gomb */}
      <div className="mt-3 px-2">
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 text-accent hover:text-accent-hover font-body text-sm transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Típus hozzáadása
        </button>
      </div>
    </div>
  );
}

export default BarLengthTable;
