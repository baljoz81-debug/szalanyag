// P10 — PDF oldalválasztó dialog
import { useState } from 'react';

function PageRangeDialog({ numPages, onConfirm, onCancel }) {
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(numPages);
  const [error, setError] = useState('');

  const handleFromChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setFromPage(isNaN(val) ? '' : val);
    setError('');
  };

  const handleToChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setToPage(isNaN(val) ? '' : val);
    setError('');
  };

  const handleConfirm = () => {
    const from = Number(fromPage);
    const to = Number(toPage);

    if (!from || !to || from < 1 || to < 1) {
      setError('Adj meg érvényes oldalszámokat.');
      return;
    }
    if (from > numPages || to > numPages) {
      setError(`A PDF csak ${numPages} oldalt tartalmaz.`);
      return;
    }
    if (from > to) {
      setError('A kezdő oldal nem lehet nagyobb a záró oldalnál.');
      return;
    }

    // Oldalszámok listája
    const pages = [];
    for (let i = from; i <= to; i++) {
      pages.push(i);
    }
    onConfirm(pages);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel border border-border-subtle rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="font-heading text-lg text-text-primary mb-2">
          PDF oldalak kiválasztása
        </h3>
        <p className="font-body text-sm text-text-secondary mb-4">
          A PDF <strong>{numPages}</strong> oldalt tartalmaz. Add meg, mely oldalakat szeretnéd beolvasni.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex flex-col gap-1 flex-1">
            <label className="font-body text-xs text-text-secondary">Oldaltól</label>
            <input
              type="number"
              min={1}
              max={numPages}
              value={fromPage}
              onChange={handleFromChange}
              className="bg-input-bg border border-border-subtle rounded px-3 py-2 text-text-primary font-body text-sm focus:outline-none focus:ring-1 focus:ring-accent w-full"
            />
          </div>
          <span className="text-text-secondary mt-5">—</span>
          <div className="flex flex-col gap-1 flex-1">
            <label className="font-body text-xs text-text-secondary">Oldalig</label>
            <input
              type="number"
              min={1}
              max={numPages}
              value={toPage}
              onChange={handleToChange}
              className="bg-input-bg border border-border-subtle rounded px-3 py-2 text-text-primary font-body text-sm focus:outline-none focus:ring-1 focus:ring-accent w-full"
            />
          </div>
        </div>

        {error && (
          <p className="font-body text-sm text-danger mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-text-secondary font-body text-sm hover:text-text-primary transition-colors"
          >
            Mégse
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 bg-accent text-white rounded font-body text-sm hover:bg-accent-hover transition-colors"
          >
            Beolvasás
          </button>
        </div>
      </div>
    </div>
  );
}

export default PageRangeDialog;
