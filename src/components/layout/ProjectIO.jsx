// F4 — Projekt mentés/betöltés vezérlő. A Navbar használja.
// Egy <input type="file"> rejtve, két gomb, és egy felülírás-megerősítő modal.
import { useRef, useState } from 'react';
import useSettingsStore from '../../store/settingsStore';
import useProductsStore from '../../store/productsStore';
import useCalculationStore from '../../store/calculationStore';
import {
  buildProjectJson,
  downloadProjectJson,
  parseProjectJson,
  readFileAsText,
} from '../../utils/projectExport';

function hasMeaningfulProductRow(rows) {
  return (rows || []).some(
    (r) => r && (r.quality || r.type || r.size || r.cutLength || r.quantity),
  );
}

function ConfirmOverwriteDialog({ projectName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-panel border border-border-subtle rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="font-heading text-lg text-text-primary mb-2">
          Projekt betöltése
        </h3>
        <p className="font-body text-sm text-text-secondary mb-4">
          Az aktuális adatok (szabott termékek és kalkuláció) elvesznek
          {projectName ? <> a <strong>„{projectName}"</strong> projekt betöltésekor</> : null}.
          Biztosan folytatod?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-text-secondary font-body text-sm hover:text-text-primary transition-colors"
          >
            Mégse
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-accent text-white rounded font-body text-sm hover:bg-accent-hover transition-colors"
          >
            Betöltés
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ kind, message }) {
  if (!message) return null;
  const cls =
    kind === 'error'
      ? 'border-danger text-danger'
      : 'border-accent text-accent';
  return (
    <div
      className={`fixed top-16 right-4 z-[70] bg-panel border ${cls} rounded px-3 py-2 font-body text-sm shadow-lg max-w-sm`}
      role="status"
    >
      {message}
    </div>
  );
}

function ProjectIO() {
  const fileInputRef = useRef(null);
  const [pending, setPending] = useState(null); // { data, warnings }
  const [toast, setToast] = useState(null);     // { kind, message }

  const showToast = (kind, message, ms = 3000) => {
    setToast({ kind, message });
    if (ms > 0) {
      setTimeout(() => {
        setToast((t) => (t && t.message === message ? null : t));
      }, ms);
    }
  };

  const handleSave = () => {
    const settings = useSettingsStore.getState();
    const products = useProductsStore.getState();
    const calculation = useCalculationStore.getState();
    const payload = buildProjectJson({ settings, products, calculation });
    const filename = downloadProjectJson(payload, { projectName: payload.projectName });
    showToast('success', `Mentve: ${filename}`);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // ugyanaz a fájl újra kiválasztható legyen
    if (!file) return;

    let text;
    try {
      text = await readFileAsText(file);
    } catch (err) {
      showToast('error', err.message || 'A fájl beolvasása sikertelen.');
      return;
    }

    const result = parseProjectJson(text);
    if (!result.ok) {
      showToast('error', result.error, 5000);
      return;
    }

    const products = useProductsStore.getState();
    const calculation = useCalculationStore.getState();
    const hasExisting =
      hasMeaningfulProductRow(products.rows) || calculation.rows.length > 0;

    if (hasExisting) {
      setPending(result);
    } else {
      applyLoad(result);
    }
  };

  const applyLoad = ({ data, warnings }) => {
    useSettingsStore.getState().replaceSettings(data.settings);
    useProductsStore.getState().replaceRows(data.products.rows);
    useCalculationStore.getState().hydrate({
      rows: data.calculation.rows,
      projectName: data.projectName,
      cutLossOverride: data.calculation.cutLossOverride,
      setCountOverride: data.calculation.setCountOverride,
      barLengthOverrides: data.calculation.barLengthOverrides,
    });
    setPending(null);
    const name = data.projectName ? `„${data.projectName}"` : 'projekt';
    const warn = warnings && warnings.length > 0 ? ` (${warnings[0]})` : '';
    showToast('success', `Betöltve: ${name}${warn}`, 4000);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-text-secondary hover:text-text-primary font-body text-sm border border-border-subtle rounded hover:border-text-secondary transition-colors"
          title="Az aktuális projekt mentése JSON fájlba"
        >
          Mentés
        </button>
        <button
          onClick={handleLoadClick}
          className="px-3 py-1.5 text-text-secondary hover:text-text-primary font-body text-sm border border-border-subtle rounded hover:border-text-secondary transition-colors"
          title="Korábban mentett projekt betöltése JSON fájlból"
        >
          Betöltés
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {pending && (
        <ConfirmOverwriteDialog
          projectName={pending.data.projectName}
          onConfirm={() => applyLoad(pending)}
          onCancel={() => setPending(null)}
        />
      )}

      <Toast kind={toast?.kind} message={toast?.message} />
    </>
  );
}

export default ProjectIO;
