// P17: kompakt szerkesztő szálhossz cellához.
// span alapállapot, kattintásra input. Override esetén reset gomb (↺).
import { useState, useRef, useEffect } from 'react';

function BarLengthEditor({ value, defaultValue, isOverride, onChange, onReset, disabled = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) setLocalValue(String(value));
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const validate = (raw) => {
    const num = parseFloat(String(raw).trim());
    return Number.isFinite(num) && num > 0 && Number.isInteger(num);
  };

  const startEdit = () => {
    if (disabled) return;
    setLocalValue(String(value));
    setIsValid(true);
    setIsEditing(true);
  };

  const save = () => {
    if (!validate(localValue)) {
      setIsValid(false);
      return;
    }
    setIsEditing(false);
    const num = parseInt(localValue, 10);
    if (num !== value) {
      // Ha a defaultra vissza van állítva, töröljük az override-ot
      if (num === defaultValue) onReset();
      else onChange(num);
    }
  };

  const discard = () => {
    setLocalValue(String(value));
    setIsValid(true);
    setIsEditing(false);
  };

  const handleBlur = () => {
    if (!validate(localValue)) discard();
    else save();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      discard();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          setIsValid(validate(e.target.value));
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={1}
        step={1}
        className={`w-24 bg-input-bg text-text-primary px-2 py-1 rounded text-sm font-body tabular-nums text-right outline-none
          ${isValid
            ? 'border border-input-border focus:border-input-focus'
            : 'border border-danger text-danger'}`}
      />
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      <span
        onClick={startEdit}
        className={`tabular-nums px-2 py-1 rounded transition-colors ${
          disabled
            ? 'cursor-default text-text-secondary'
            : 'cursor-pointer hover:bg-panel-hover'
        } ${isOverride ? 'text-accent font-medium' : 'text-text-primary'}`}
        title={
          disabled
            ? 'Egyedi szálhossz (probléma-megoldás)'
            : isOverride
              ? `Egyéni érték (alap: ${defaultValue} mm) — kattints a módosításhoz`
              : 'Kattints a módosításhoz'
        }
      >
        {value}
      </span>
      {isOverride && !disabled && (
        <button
          type="button"
          onClick={onReset}
          className="text-text-secondary hover:text-accent text-base leading-none px-1 transition-colors"
          title={`Visszaállítás alapértelmezettre (${defaultValue} mm)`}
        >
          ↺
        </button>
      )}
    </div>
  );
}

export default BarLengthEditor;
