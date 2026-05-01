// P21: Problémás darab megoldás-választó modal
// 3 mód: Toldás (split) / Hosszabb szál (customBar) / Kihagyás (skip)
import { useState } from 'react';

// Toldás javasolt felosztás: amíg a maradék > defaultBarLength, addig defaultBarLength,
// majd a végén a maradékot.
function suggestSplit(cutLength, defaultBarLength) {
  if (defaultBarLength <= 0 || cutLength <= 0) return [cutLength];
  const parts = [];
  let remaining = cutLength;
  while (remaining > defaultBarLength) {
    parts.push(defaultBarLength);
    remaining -= defaultBarLength;
  }
  if (remaining > 0) parts.push(remaining);
  return parts;
}

const COMMON_LONGER_BARS = [9000, 12000, 15000];

function ProblemSolutionDialog({ row, currentSolution, defaultBarLength, onSave, onCancel }) {
  const cutLength = Number(row.cutLength) || 0;

  // Aktív mód: ha van currentSolution, azt nyitjuk; különben split
  const initialMode = currentSolution?.kind || 'split';
  const [mode, setMode] = useState(initialMode);

  // Split állapot
  const [splitParts, setSplitParts] = useState(() => {
    if (currentSolution?.kind === 'split') {
      return currentSolution.parts.map((p) => String(p));
    }
    return suggestSplit(cutLength, defaultBarLength).map((p) => String(p));
  });

  // CustomBar állapot
  const [customBarLength, setCustomBarLength] = useState(() => {
    if (currentSolution?.kind === 'customBar') return String(currentSolution.barLength);
    // alapértelmezett: a legközelebbi >= cutLength a COMMON_LONGER_BARS-ból
    const fit = COMMON_LONGER_BARS.find((b) => b >= cutLength);
    return String(fit ?? cutLength + 1000);
  });

  // ──────── Validáció ────────
  const splitNumbers = splitParts.map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0);
  const splitSum = splitNumbers.reduce((s, n) => s + n, 0);
  const splitValid = splitNumbers.length >= 2
    && splitSum >= cutLength
    && splitNumbers.every((n) => n <= defaultBarLength);

  const customBarNum = Number(customBarLength);
  const customBarValid = Number.isFinite(customBarNum) && customBarNum >= cutLength && customBarNum > 0;

  const canSave = mode === 'skip'
    || (mode === 'split'      && splitValid)
    || (mode === 'customBar'  && customBarValid);

  // ──────── Mentés ────────
  const handleSave = () => {
    if (!canSave) return;
    if (mode === 'skip') {
      onSave({ kind: 'skip' });
    } else if (mode === 'split') {
      onSave({ kind: 'split', parts: splitNumbers });
    } else if (mode === 'customBar') {
      onSave({ kind: 'customBar', barLength: customBarNum });
    }
  };

  // ──────── Split rész-mező kezelés ────────
  const updatePart = (idx, value) => {
    setSplitParts((prev) => prev.map((p, i) => (i === idx ? value : p)));
  };
  const addPart = () => setSplitParts((prev) => [...prev, '']);
  const removePart = (idx) => setSplitParts((prev) => prev.filter((_, i) => i !== idx));

  // Toldási hulladék (ha a részek összege > eredeti)
  const splitWaste = splitSum - cutLength;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-border-subtle rounded-lg shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="font-heading text-lg text-text-primary mb-1">
          Probléma megoldása
        </h3>
        <p className="font-body text-sm text-text-secondary mb-5">
          {row.quality || '—'} / {row.type || '—'} / {row.size || '—'} —
          {' '}<span className="text-text-primary font-medium">{cutLength} mm × {row.quantity} db</span>
          {defaultBarLength > 0 && (
            <span className="block text-xs mt-1">
              Beállított szálhossz erre a típusra: {defaultBarLength} mm
            </span>
          )}
        </p>

        {/* ───────── Mód-választó ───────── */}
        <div className="space-y-4 mb-5">
          {/* SPLIT */}
          <label className={`block border rounded p-3 cursor-pointer transition-colors ${
            mode === 'split' ? 'border-accent bg-accent/5' : 'border-border-subtle hover:border-border-subtle/80'
          }`}>
            <div className="flex items-start gap-2 mb-2">
              <input
                type="radio"
                name="solution-mode"
                checked={mode === 'split'}
                onChange={() => setMode('split')}
                className="mt-1 accent-accent"
              />
              <div>
                <span className="font-body text-sm text-text-primary font-medium">Toldás</span>
                <p className="font-body text-xs text-text-secondary mt-0.5">
                  A darabot felosztjuk N részre. Ha az összeg több az eredetinél, a többlet toldási hulladéknak számít.
                </p>
              </div>
            </div>

            {mode === 'split' && (
              <div className="ml-6 space-y-2 mt-3">
                {splitParts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-body text-xs text-text-secondary w-12">{i + 1}. rész:</span>
                    <input
                      type="number"
                      value={p}
                      onChange={(e) => updatePart(i, e.target.value)}
                      min={1}
                      max={defaultBarLength}
                      className="w-24 bg-input-bg text-text-primary px-2 py-1 rounded text-sm font-body
                                 border border-input-border focus:border-input-focus outline-none"
                    />
                    <span className="font-body text-xs text-text-secondary">mm</span>
                    {splitParts.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePart(i)}
                        className="text-text-secondary hover:text-danger text-xs"
                        aria-label="Rész eltávolítása"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPart}
                  className="text-accent text-xs font-body hover:text-accent-hover"
                >
                  + Toldási hulladék hozzáadása
                </button>

                <div className="font-body text-xs pt-2 border-t border-border-subtle/50 mt-2">
                  <div className="text-text-secondary">
                    Részek összege:
                    {' '}<span className={splitSum >= cutLength ? 'text-text-primary' : 'text-danger'}>
                      {splitSum} mm
                    </span>
                    {' '}/ eredeti: {cutLength} mm
                  </div>
                  {splitWaste > 0 && (
                    <div className="text-yellow-400/80 mt-0.5">
                      Toldási hulladék: {splitWaste} mm
                    </div>
                  )}
                  {splitSum < cutLength && (
                    <div className="text-danger mt-0.5">
                      A részek összege nem lehet kevesebb az eredeti hossznál.
                    </div>
                  )}
                  {splitNumbers.some((n) => n > defaultBarLength) && (
                    <div className="text-danger mt-0.5">
                      Egy rész sem lehet hosszabb a szálhossznál ({defaultBarLength} mm).
                    </div>
                  )}
                </div>
              </div>
            )}
          </label>

          {/* CUSTOM BAR */}
          <label className={`block border rounded p-3 cursor-pointer transition-colors ${
            mode === 'customBar' ? 'border-accent bg-accent/5' : 'border-border-subtle hover:border-border-subtle/80'
          }`}>
            <div className="flex items-start gap-2 mb-2">
              <input
                type="radio"
                name="solution-mode"
                checked={mode === 'customBar'}
                onChange={() => setMode('customBar')}
                className="mt-1 accent-accent"
              />
              <div>
                <span className="font-body text-sm text-text-primary font-medium">Hosszabb szálanyag</span>
                <p className="font-body text-xs text-text-secondary mt-0.5">
                  Csak ennek az anyagnak (csoportnak) használunk egyedi, hosszabb szálat.
                </p>
              </div>
            </div>

            {mode === 'customBar' && (
              <div className="ml-6 mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-body text-xs text-text-secondary w-20">Szálhossz:</span>
                  <input
                    type="number"
                    value={customBarLength}
                    onChange={(e) => setCustomBarLength(e.target.value)}
                    min={cutLength}
                    className="w-28 bg-input-bg text-text-primary px-2 py-1 rounded text-sm font-body
                               border border-input-border focus:border-input-focus outline-none"
                  />
                  <span className="font-body text-xs text-text-secondary">mm</span>
                </div>

                <div className="flex flex-wrap gap-1 ml-22">
                  <span className="font-body text-xs text-text-secondary mr-1">Gyakori:</span>
                  {COMMON_LONGER_BARS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setCustomBarLength(String(b))}
                      className="px-2 py-0.5 text-xs font-body rounded border border-border-subtle
                                 text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
                    >
                      {b}
                    </button>
                  ))}
                </div>

                {!customBarValid && (
                  <div className="text-danger font-body text-xs mt-1">
                    A szálhossznak legalább {cutLength} mm-nek kell lennie.
                  </div>
                )}
              </div>
            )}
          </label>

          {/* SKIP */}
          <label className={`block border rounded p-3 cursor-pointer transition-colors ${
            mode === 'skip' ? 'border-accent bg-accent/5' : 'border-border-subtle hover:border-border-subtle/80'
          }`}>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                name="solution-mode"
                checked={mode === 'skip'}
                onChange={() => setMode('skip')}
                className="mt-1 accent-accent"
              />
              <div>
                <span className="font-body text-sm text-text-primary font-medium">Kihagyás</span>
                <p className="font-body text-xs text-text-secondary mt-0.5">
                  A sor kimarad a kalkulációból, de a Problémás darabok listájában látszik.
                </p>
              </div>
            </div>
          </label>
        </div>

        {/* ───────── Gombok ───────── */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-text-secondary font-body text-sm hover:text-text-primary transition-colors"
          >
            Mégsem
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 bg-accent text-white rounded font-body text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProblemSolutionDialog;
