// Validált numerikus beviteli mező — azonnali hibajelzés, onBlur mentés
import { useState, useEffect } from 'react';

function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  allowDecimal = false,
  label,
  unit,
  placeholder,
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Szinkronizálás külső értékkel (pl. store reset)
  useEffect(() => {
    setLocalValue(String(value));
    setIsValid(true);
    setErrorMessage('');
  }, [value]);

  const validate = (val) => {
    const trimmed = val.trim();
    if (trimmed === '') {
      setErrorMessage('Ez a mező nem lehet üres');
      return false;
    }

    const num = parseFloat(trimmed);

    if (isNaN(num)) {
      setErrorMessage('Számot adj meg');
      return false;
    }

    // Egész szám ellenőrzés (ha allowDecimal = false)
    // parseFloat használata szándékos: parseInt('1.5') = 1 csendesen elfogadná a tizedesvesszőt
    if (!allowDecimal && !Number.isInteger(num)) {
      setErrorMessage('Egész szám szükséges');
      return false;
    }

    if (min !== undefined && num < min) {
      setErrorMessage(`Minimum értéke: ${min}`);
      return false;
    }

    if (max !== undefined && num > max) {
      setErrorMessage(`Maximum értéke: ${max}`);
      return false;
    }

    setErrorMessage('');
    return true;
  };

  const handleChange = (e) => {
    setLocalValue(e.target.value);
    // Valós idejű vizuális validáció
    const valid = validate(e.target.value);
    setIsValid(valid);
  };

  const handleBlur = () => {
    const valid = validate(localValue);
    setIsValid(valid);
    if (valid) {
      const num = allowDecimal ? parseFloat(localValue) : parseInt(localValue, 10);
      if (num !== value) {
        onChange(num);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="font-body text-sm text-text-primary font-medium">
          {label}
          {unit && <span className="text-text-secondary ml-1">({unit})</span>}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={`w-32 bg-input-bg text-text-primary px-3 py-2 rounded text-sm font-body outline-none
            ${isValid
              ? 'border border-input-border focus:border-input-focus'
              : 'border border-danger'
            }`}
        />
        {unit && !label && (
          <span className="text-text-secondary text-sm font-body">{unit}</span>
        )}
      </div>
      {!isValid && errorMessage && (
        <p className="text-danger text-xs font-body mt-0.5">{errorMessage}</p>
      )}
    </div>
  );
}

export default NumericInput;
