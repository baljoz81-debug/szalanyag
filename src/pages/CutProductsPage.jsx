// Szabott termékek oldal — P5–P7: szerkeszthető táblázat + Excel/CSV import
import { useRef, useState, useCallback } from 'react';
import useProductsStore from '../store/productsStore';
import useSettingsStore from '../store/settingsStore';
import SectionCard from '../components/ui/SectionCard';
import ProductsTable from '../components/products/ProductsTable';
import { validateFileType, importExcel } from '../utils/excelImport';

function ImportModeDialog({ rowCount, onReplace, onAppend, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel-bg border border-border-subtle rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="font-heading text-lg text-text-primary mb-2">
          Import mód
        </h3>
        <p className="font-body text-sm text-text-secondary mb-5">
          A táblázat már tartalmaz adatokat. Mit szeretnél tenni a beolvasott {rowCount} sorral?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onReplace}
            className="w-full px-4 py-2 bg-accent text-white rounded font-body text-sm hover:bg-accent-hover transition-colors"
          >
            Felülírás — meglévő adatok törlése
          </button>
          <button
            onClick={onAppend}
            className="w-full px-4 py-2 bg-panel-hover text-text-primary border border-border-subtle rounded font-body text-sm hover:bg-input-bg transition-colors"
          >
            Hozzáadás — sorok hozzáfűzése a végéhez
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-text-secondary font-body text-sm hover:text-text-primary transition-colors"
          >
            Mégsem
          </button>
        </div>
      </div>
    </div>
  );
}

function CutProductsPage() {
  const rows = useProductsStore((state) => state.rows);
  const updateCell = useProductsStore((state) => state.updateCell);
  const addRow = useProductsStore((state) => state.addRow);
  const removeRow = useProductsStore((state) => state.removeRow);
  const setRows = useProductsStore((state) => state.setRows);
  const appendRows = useProductsStore((state) => state.appendRows);

  const barLengths = useSettingsStore((state) => state.barLengths);
  const knownTypes = barLengths.map((b) => b.type).filter(Boolean);

  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [pendingImport, setPendingImport] = useState(null); // { rows, result } — dialog megjelenítéséhez

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Van-e érdemi adat a táblázatban?
  const hasExistingData = () => {
    return rows.some((r) => r.quality || r.type || r.size || r.cutLength || r.quantity);
  };

  const applyImport = useCallback((importedRows, result, mode) => {
    if (mode === 'replace') {
      setRows(importedRows);
    } else {
      appendRows(importedRows);
    }
    const typeInfo = result.detectedType ? ` Típus: ${result.detectedType}.` : '';
    const modeText = mode === 'append' ? ' (hozzáfűzve)' : '';
    setImportMsg({
      type: 'success',
      text: `${result.totalParsed} sor betöltve a „${result.sheetName}" munkalapról${modeText}.${typeInfo}`,
    });
    setPendingImport(null);
  }, [setRows, appendRows]);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    if (!validateFileType(file.name)) {
      setImportMsg({ type: 'error', text: 'Csak .xlsx, .xls és .csv fájlok támogatottak.' });
      return;
    }

    setImporting(true);
    setImportMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = importExcel(arrayBuffer, file.name, knownTypes);

      if (hasExistingData()) {
        // Van adat → dialog megjelenítése
        setPendingImport({ rows: result.rows, result });
      } else {
        // Üres tábla → egyből felülírjuk
        applyImport(result.rows, result, 'replace');
      }
    } catch (err) {
      setImportMsg({ type: 'error', text: err.message || 'Ismeretlen hiba a fájl beolvasásakor.' });
    } finally {
      setImporting(false);
    }
  }, [setRows, knownTypes, applyImport]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="font-heading text-2xl text-text-primary mb-1">
        Szabott termékek
      </h1>
      <p className="font-body text-text-secondary mb-6">
        Vágandó darabok felvitele és importálása
      </p>

      <SectionCard title="Termékek táblázata">
        {/* Import gomb + visszajelzés */}
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded font-body text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {importing ? 'Betöltés...' : 'Excel betöltése'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {importMsg && (
            <span
              className={`font-body text-sm ${
                importMsg.type === 'success' ? 'text-green-400' : 'text-danger'
              }`}
            >
              {importMsg.text}
            </span>
          )}
        </div>

        <ProductsTable
          rows={rows}
          onUpdateCell={updateCell}
          onAddRow={addRow}
          onRemoveRow={removeRow}
        />
      </SectionCard>

      {/* Import mód választó dialog */}
      {pendingImport && (
        <ImportModeDialog
          rowCount={pendingImport.result.totalParsed}
          onReplace={() => applyImport(pendingImport.rows, pendingImport.result, 'replace')}
          onAppend={() => applyImport(pendingImport.rows, pendingImport.result, 'append')}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </main>
  );
}

export default CutProductsPage;
