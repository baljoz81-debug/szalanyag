// Inline szerkeszthető cella — span alapállapot, kattintásra input
// Enter/onBlur → mentés (ha valid), Escape → elvetés
import { useState, useRef, useEffect } from 'react';

function EditableCell({ value, onChange, type = 'text', placeholder = '', validate, autoFocus = false, onNavigate }) {
  // autoFocus prop: ha true, az első rendereléskor azonnal szerkesztési módba lép
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [localValue, setLocalValue] = useState(String(value));
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef(null);

  // Frissítjük a localValue-t ha a külső érték változik (pl. store reset)
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(value));
    }
  }, [value, isEditing]);

  // Automatikus fókusz szerkesztési módban
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSpanClick = () => {
    setLocalValue(String(value));
    setIsValid(true);
    setIsEditing(true);
  };

  const handleChange = (e) => {
    setLocalValue(e.target.value);
    // Valós idejű vizuális visszajelzés
    if (validate) {
      setIsValid(validate(e.target.value));
    }
  };

  const handleSave = () => {
    // Validáció mentéskor
    if (validate && !validate(localValue)) {
      setIsValid(false);
      return; // Maradunk szerkesztési módban érvénytelen értéknél
    }
    setIsValid(true);
    setIsEditing(false);
    if (localValue !== String(value)) {
      onChange(localValue);
    }
  };

  const handleDiscard = () => {
    setLocalValue(String(value));
    setIsValid(true);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSave();
      if (onNavigate) onNavigate(e.key);
    } else if (e.key === 'Escape') {
      handleDiscard();
    }
  };

  const handleBlur = () => {
    // onBlur esetén: ha érvénytelen, az eredeti értéket állítjuk vissza (elvetés)
    // Ez megakadályozza, hogy a felhasználó csapdába kerüljön érvénytelen értékkel
    if (validate && !validate(localValue)) {
      handleDiscard();
    } else {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full bg-input-bg text-text-primary px-2 py-1 rounded text-sm font-body outline-none
          ${isValid
            ? 'border border-input-border focus:border-input-focus'
            : 'border border-danger text-danger'
          }`}
      />
    );
  }

  return (
    <span
      onClick={handleSpanClick}
      className="block w-full px-2 py-1 text-sm font-body text-text-primary cursor-pointer hover:bg-panel-hover rounded transition-colors min-h-[28px]"
      title="Kattints a szerkesztéshez"
    >
      {value || <span className="text-text-secondary italic">{placeholder || 'Kattints...'}</span>}
    </span>
  );
}

export default EditableCell;
