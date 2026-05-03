// Szabott termékek oldal — P5–P10 + P12: import + átvitel a kalkulációhoz
import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useProductsStore from '../store/productsStore';
import useSettingsStore from '../store/settingsStore';
import useCalculationStore from '../store/calculationStore';
import SectionCard from '../components/ui/SectionCard';
import ProductsTable from '../components/products/ProductsTable';
import ColumnMappingDialog from '../components/products/ColumnMappingDialog';
import PageRangeDialog from '../components/products/PageRangeDialog';
import { validateFileType, parseWorkbook, importSheet, importRows, applyMapping } from '../utils/excelImport';
import { openPdf, extractPagesAsTable, validatePdfFileType } from '../utils/pdfImport';
import { exportProductsToExcel, exportProductsToPdf, buildProductsTsv } from '../utils/productsExport';
import { copyTextToClipboard } from '../utils/clipboardExport';

function SheetSelectorDialog({ sheetNames, onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel border border-border-subtle rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="font-heading text-lg text-text-primary mb-2">
          Munkalap kiválasztása
        </h3>
        <p className="font-body text-sm text-text-secondary mb-4">
          A fájl {sheetNames.length} munkalapot tartalmaz. Melyiket szeretnéd betölteni?
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className="w-full px-4 py-2 bg-panel-hover text-text-primary border border-border-subtle rounded font-body text-sm hover:bg-input-bg hover:border-accent transition-colors text-left"
            >
              {name}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 text-text-secondary font-body text-sm hover:text-text-primary transition-colors"
        >
          Mégsem
        </button>
      </div>
    </div>
  );
}

function TransferModeDialog({ existingCount, newCount, onReplace, onAppend, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel border border-border-subtle rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="font-heading text-lg text-text-primary mb-2">
          Átvitel a kalkulációhoz
        </h3>
        <p className="font-body text-sm text-text-secondary mb-5">
          A főoldal kalkulációja már tartalmaz {existingCount} sort. Mit szeretnél tenni a {newCount} új sorral?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onReplace}
            className="w-full px-4 py-2 bg-accent text-white rounded font-body text-sm hover:bg-accent-hover transition-colors"
          >
            Felülírás — kalkuláció új adatokkal
          </button>
          <button
            onClick={onAppend}
            className="w-full px-4 py-2 bg-panel-hover text-text-primary border border-border-subtle rounded font-body text-sm hover:bg-input-bg transition-colors"
          >
            Hozzáadás — sorok hozzáfűzése a meglévőhöz
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

function ImportModeDialog({ rowCount, onReplace, onAppend, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel border border-border-subtle rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
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

  // P12: kalkulációs store
  const calcRows         = useCalculationStore((state) => state.rows);
  const calcSetRows      = useCalculationStore((state) => state.setRows);
  const calcAppendRows   = useCalculationStore((state) => state.appendRows);
  const projectName      = useCalculationStore((state) => state.projectName);
  const setProjectName   = useCalculationStore((state) => state.setProjectName);
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);   // { type, text, warnings? }
  const [pendingSheets, setPendingSheets] = useState(null);    // { wb, sheetNames } — munkalapválasztó
  const [pendingMapping, setPendingMapping] = useState(null);  // P9: mapping dialog adatai
  const [pendingImport, setPendingImport] = useState(null);    // { rows, sheetName, detectedType, warnings } — import mód dialog
  const [warningCells, setWarningCells] = useState(new Map()); // hibás cellák: rowId → Set<fieldKey>
  const [pendingPdf, setPendingPdf] = useState(null);          // { doc, numPages, fileName } — PDF oldalválasztó
  const [pendingTransfer, setPendingTransfer] = useState(null); // P12: { meaningfulRows } — átvitel mód dialog
  const [copyStatus, setCopyStatus] = useState('idle');         // 'idle' | 'copied' | 'error'
  const [pdfBusy, setPdfBusy] = useState(false);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handlePdfImportClick = () => {
    pdfInputRef.current?.click();
  };

  // Van-e érdemi adat a táblázatban?
  const hasExistingData = () => {
    return rows.some((r) => r.quality || r.type || r.size || r.cutLength || r.quantity);
  };

  // P12: átvitel a kalkulációhoz
  const getMeaningfulRows = () =>
    rows.filter((r) => r.quality || r.type || r.size || r.cutLength || r.quantity);

  const handleTransferClick = () => {
    const meaningfulRows = getMeaningfulRows();
    if (meaningfulRows.length === 0) return;
    if (calcRows.length > 0) {
      setPendingTransfer({ meaningfulRows });
    } else {
      calcSetRows(meaningfulRows);
      navigate('/');
    }
  };

  const handleTransferReplace = () => {
    calcSetRows(pendingTransfer.meaningfulRows);
    setPendingTransfer(null);
    navigate('/');
  };

  const handleTransferAppend = () => {
    calcAppendRows(pendingTransfer.meaningfulRows);
    setPendingTransfer(null);
    navigate('/');
  };

  const finalizeImport = useCallback((importedRows, sheetName, detectedType, mode, warnings = [], newWarningCells = new Map()) => {
    if (mode === 'replace') {
      setRows(importedRows);
      setWarningCells(newWarningCells);
    } else {
      appendRows(importedRows);
      setWarningCells((prev) => new Map([...prev, ...newWarningCells]));
    }
    const typeInfo = detectedType ? ` Típus: ${detectedType}.` : '';
    const modeText = mode === 'append' ? ' (hozzáfűzve)' : '';
    setImportMsg({
      type: warnings.length > 0 ? 'warning' : 'success',
      text: `${importedRows.length} sor betöltve a „${sheetName}" munkalapról${modeText}.${typeInfo}`,
      warnings,
    });
    setPendingImport(null);
  }, [setRows, appendRows]);

  // P9: Mapping dialog jóváhagyása → sorok konvertálása → import mód (ha kell)
  const handleMappingApply = useCallback((mapping, detectedType) => {
    const { dataRows, sheetName } = pendingMapping;
    const { rows: importedRows, warnings, warningCells: newWarningCells } = applyMapping(dataRows, mapping, detectedType);

    if (importedRows.length === 0) {
      setImportMsg({ type: 'error', text: 'A kiválasztott oszlopokból nem nyerhető ki feldolgozható adat.' });
      setPendingMapping(null);
      return;
    }

    setPendingMapping(null);

    if (hasExistingData()) {
      setPendingImport({ rows: importedRows, sheetName, detectedType, warnings, warningCells: newWarningCells });
    } else {
      finalizeImport(importedRows, sheetName, detectedType, 'replace', warnings, newWarningCells);
    }
  }, [pendingMapping, finalizeImport]);

  // Munkalap kiválasztása után → oszlopmapping dialog
  const handleSheetSelect = useCallback((sheetName) => {
    const { wb } = pendingSheets;
    try {
      const result = importSheet(wb, sheetName, knownTypes);
      setPendingSheets(null);
      setPendingMapping(result);
    } catch (err) {
      setPendingSheets(null);
      setImportMsg({ type: 'error', text: err.message });
    }
  }, [pendingSheets, knownTypes]);

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
      const { wb, sheetNames } = parseWorkbook(arrayBuffer);

      if (sheetNames.length > 1) {
        // Több munkalap → választó dialog
        setPendingSheets({ wb, sheetNames });
      } else {
        // Egyetlen munkalap → egyből mapping dialog
        const result = importSheet(wb, sheetNames[0], knownTypes);
        setPendingMapping(result);
      }
    } catch (err) {
      setImportMsg({ type: 'error', text: err.message || 'Ismeretlen hiba a fájl beolvasásakor.' });
    } finally {
      setImporting(false);
    }
  }, [knownTypes]);

  // ─── PDF import ───────────────────────────────────────────────────────

  const processPdfPages = useCallback(async (doc, fileName, pages) => {
    try {
      const { allRows } = await extractPagesAsTable(doc, pages, knownTypes);

      if (allRows.length === 0) {
        setImportMsg({ type: 'error', text: 'A kiválasztott oldalakból nem nyerhető ki szöveges tartalom. Szkennelt/képes PDF nem támogatott.' });
        return;
      }

      const sourceName = `${fileName} (${pages.length === 1 ? `${pages[0]}. oldal` : `${pages[0]}–${pages[pages.length - 1]}. oldal`})`;
      const result = importRows(allRows, sourceName, knownTypes);
      setPendingMapping(result);
    } catch (err) {
      setImportMsg({ type: 'error', text: err.message || 'Hiba a PDF feldolgozásakor.' });
    } finally {
      setImporting(false);
    }
  }, [knownTypes]);

  const handlePdfFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    if (!validatePdfFileType(file.name)) {
      setImportMsg({ type: 'error', text: 'Csak .pdf fájlok támogatottak.' });
      return;
    }

    setImporting(true);
    setImportMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { doc, numPages } = await openPdf(arrayBuffer);

      if (numPages === 0) {
        setImportMsg({ type: 'error', text: 'A PDF nem tartalmaz oldalakat.' });
        setImporting(false);
        return;
      }

      // Egyoldalas PDF: közvetlen feldolgozás, oldalválasztó nélkül
      if (numPages === 1) {
        await processPdfPages(doc, file.name, [1]);
        return;
      }

      // Többoldalas: oldalválasztó dialog
      setPendingPdf({ doc, numPages, fileName: file.name });
    } catch (err) {
      setImportMsg({ type: 'error', text: err.message || 'Hiba a PDF megnyitásakor.' });
      setImporting(false);
    }
  }, [processPdfPages]);

  const handlePdfPageConfirm = useCallback(async (pages) => {
    const { doc, fileName } = pendingPdf;
    setPendingPdf(null);
    await processPdfPages(doc, fileName, pages);
  }, [pendingPdf, processPdfPages]);

  // ─── Export handlerek ─────────────────────────────────────────────────

  const handleCopy = async () => {
    try {
      const tsv = buildProductsTsv(rows, { projectName });
      await copyTextToClipboard(tsv);
      setCopyStatus('copied');
    } catch (err) {
      console.error('Vágólap másolás hiba:', err);
      setCopyStatus('error');
    }
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handlePdfExport = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await exportProductsToPdf({ rows, projectName });
    } catch (err) {
      console.error('PDF export hiba:', err);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="font-heading text-2xl text-text-primary mb-1">
        Szabott termékek
      </h1>
      <p className="font-body text-text-secondary mb-4">
        Vágandó darabok felvitele és importálása
      </p>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2">
        <label
          htmlFor="cut-project-name"
          className="font-body text-sm text-text-primary font-medium sm:w-32 shrink-0"
        >
          Projekt neve
        </label>
        <input
          id="cut-project-name"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="pl. Csarnok-2026 (opcionális)"
          maxLength={120}
          className="flex-1 max-w-md bg-input-bg text-text-primary px-3 py-2 rounded text-sm font-body
            outline-none border border-input-border focus:border-input-focus"
        />
      </div>

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

          <button
            type="button"
            onClick={handlePdfImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-panel-hover text-text-primary border border-border-subtle rounded font-body text-sm hover:bg-input-bg hover:border-accent transition-colors disabled:opacity-50"
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {importing ? 'Betöltés...' : 'PDF betöltése'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfFileChange}
            className="hidden"
          />

          {importMsg && (
            <div className="flex flex-col gap-1">
              <span
                className={`font-body text-sm ${
                  importMsg.type === 'success'
                    ? 'text-green-400'
                    : importMsg.type === 'warning'
                      ? 'text-yellow-400'
                      : 'text-danger'
                }`}
              >
                {importMsg.text}
              </span>
              {importMsg.warnings?.length > 0 && (
                <details className="font-body text-xs text-yellow-400/80">
                  <summary className="cursor-pointer hover:text-yellow-300">
                    {importMsg.warnings.length} figyelmeztetés
                  </summary>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    {importMsg.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <ProductsTable
          rows={rows}
          onUpdateCell={(id, key, val) => {
            updateCell(id, key, val);
            // Ha a cella ki volt emelve és most javították, eltávolítjuk a kiemelést
            if (warningCells.has(id)) {
              const cellKeys = warningCells.get(id);
              if (cellKeys.has(key)) {
                setWarningCells((prev) => {
                  const next = new Map(prev);
                  const updatedKeys = new Set(cellKeys);
                  updatedKeys.delete(key);
                  if (updatedKeys.size === 0) {
                    next.delete(id);
                  } else {
                    next.set(id, updatedKeys);
                  }
                  return next;
                });
              }
            }
          }}
          onAddRow={addRow}
          onRemoveRow={(id) => {
            removeRow(id);
            if (warningCells.has(id)) {
              setWarningCells((prev) => {
                const next = new Map(prev);
                next.delete(id);
                return next;
              });
            }
          }}
          warningCells={warningCells}
        />

        {/* Export gombok + Átvitel a kalkulációhoz */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-border-subtle">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasExistingData()}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded font-body text-sm font-medium transition-colors border disabled:opacity-40 disabled:cursor-not-allowed ${
                copyStatus === 'copied'
                  ? 'bg-status-green/15 border-status-green text-status-green'
                  : copyStatus === 'error'
                    ? 'bg-danger/15 border-danger text-danger'
                    : 'bg-panel border-border-subtle text-text-primary hover:bg-panel-hover'
              }`}
            >
              {copyStatus === 'copied'
                ? 'Másolva!'
                : copyStatus === 'error'
                  ? 'Hiba — próbáld újra'
                  : 'Másolás vágólapra'}
            </button>
            <button
              type="button"
              onClick={handlePdfExport}
              disabled={!hasExistingData() || pdfBusy}
              className="inline-flex items-center gap-2 bg-panel border border-border-subtle text-text-primary hover:bg-panel-hover disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded font-body text-sm font-medium transition-colors"
            >
              {pdfBusy ? 'PDF készül…' : 'Exportálás PDF-be'}
            </button>
            <button
              type="button"
              onClick={() => exportProductsToExcel({ rows, projectName })}
              disabled={!hasExistingData()}
              className="inline-flex items-center gap-2 bg-panel border border-border-subtle text-text-primary hover:bg-panel-hover disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded font-body text-sm font-medium transition-colors"
            >
              Exportálás Excel-be
            </button>
          </div>

          <div className="flex items-center">
            {!hasExistingData() && (
              <span className="font-body text-sm text-text-secondary mr-3">
                Tölts fel adatot a táblázatba az átvitelhez.
              </span>
            )}
            <button
              type="button"
              onClick={handleTransferClick}
              disabled={!hasExistingData()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded font-body text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Átvitel a kalkulációhoz
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
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </SectionCard>

      {/* PDF oldalválasztó dialog */}
      {pendingPdf && (
        <PageRangeDialog
          numPages={pendingPdf.numPages}
          onConfirm={handlePdfPageConfirm}
          onCancel={() => setPendingPdf(null)}
        />
      )}

      {/* Munkalapválasztó dialog */}
      {pendingSheets && (
        <SheetSelectorDialog
          sheetNames={pendingSheets.sheetNames}
          onSelect={handleSheetSelect}
          onCancel={() => setPendingSheets(null)}
        />
      )}

      {/* P9: Oszlop-hozzárendelés dialog */}
      {pendingMapping && (
        <ColumnMappingDialog
          headerRow={pendingMapping.headerRow}
          dataRows={pendingMapping.dataRows}
          columnCount={pendingMapping.columnCount}
          initialMapping={pendingMapping.mapping}
          autoDetected={pendingMapping.autoDetected}
          detectedType={pendingMapping.detectedType}
          detectedCategories={pendingMapping.detectedCategories}
          sheetName={pendingMapping.sheetName}
          onApply={handleMappingApply}
          onCancel={() => setPendingMapping(null)}
        />
      )}

      {/* Import mód választó dialog */}
      {pendingImport && (
        <ImportModeDialog
          rowCount={pendingImport.rows.length}
          onReplace={() => finalizeImport(pendingImport.rows, pendingImport.sheetName, pendingImport.detectedType, 'replace', pendingImport.warnings, pendingImport.warningCells)}
          onAppend={() => finalizeImport(pendingImport.rows, pendingImport.sheetName, pendingImport.detectedType, 'append', pendingImport.warnings, pendingImport.warningCells)}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {/* P12: Átvitel mód választó dialog */}
      {pendingTransfer && (
        <TransferModeDialog
          existingCount={calcRows.length}
          newCount={pendingTransfer.meaningfulRows.length}
          onReplace={handleTransferReplace}
          onAppend={handleTransferAppend}
          onCancel={() => setPendingTransfer(null)}
        />
      )}
    </main>
  );
}

export default CutProductsPage;
