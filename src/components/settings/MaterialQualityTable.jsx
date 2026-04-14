// Anyagminőség konfiguráló tábla — inline szerkesztés, sor hozzáadás/törlés/átrendezés
import { useState } from 'react';
import EditableCell from '../ui/EditableCell';
import IconButton from '../ui/IconButton';
import useDragReorder from '../../hooks/useDragReorder';

const validateName = (val) => {
  const trimmed = String(val).trim();
  return trimmed.length >= 1 && trimmed.length <= 30;
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

function MaterialQualityTable({ qualities, onUpdate, onAdd, onRemove, onReorder }) {
  const [newlyAdded, setNewlyAdded] = useState(false);
  const { getDragProps, overIndex } = useDragReorder(onReorder);

  const handleAdd = () => {
    setNewlyAdded(true);
    onAdd();
  };

  const lastItem = qualities.length > 0 ? qualities[qualities.length - 1] : null;
  const isNewRow = (item) =>
    newlyAdded && item.id === lastItem?.id && lastItem?.name === '';

  return (
    <div className="w-full">
      {/* Fejléc */}
      <div className="grid grid-cols-[28px_1fr_48px] gap-2 px-2 pb-2 border-b border-border-subtle mb-1">
        <span></span>
        <span className="font-heading text-sm text-text-secondary">Anyagminőség neve</span>
        <span></span>
      </div>

      {/* Sorok */}
      {qualities.map((item, index) => (
        <div
          key={item.id}
          {...getDragProps(index)}
          className={`grid grid-cols-[28px_1fr_48px] gap-2 items-center px-2 py-1 rounded hover:bg-panel-hover transition-colors ${
            overIndex === index ? 'border-t-2 border-accent' : 'border-t-2 border-transparent'
          }`}
        >
          {/* Drag handle */}
          <DragHandle />

          <EditableCell
            value={item.name}
            onChange={(newVal) => onUpdate(item.id, newVal.trim())}
            type="text"
            placeholder="pl. S235"
            validate={validateName}
            autoFocus={isNewRow(item)}
          />

          <div className="flex justify-center">
            <IconButton
              onClick={() => onRemove(item.id)}
              icon="delete"
              title="Sor törlése"
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
          Anyagminőség hozzáadása
        </button>
      </div>
    </div>
  );
}

export default MaterialQualityTable;
