// Kalkulációs főoldal — P14 sticky fejléc + P16 csoportosított táblázat
import { useMemo, useState } from 'react';
import useCalculationStore from '../store/calculationStore';
import useSettingsStore from '../store/settingsStore';
import { calculatePackingWithSolutions, summarizeForDisplay } from '../utils/binPacking';
import { exportCalculationToExcel } from '../utils/excelExport';
import { exportCalculationToPdf } from '../utils/pdfExport';
import { buildCalculationTsv, copyTextToClipboard } from '../utils/clipboardExport';
import NumericInput from '../components/ui/NumericInput';
import CalculationGroupedTable from '../components/calculation/CalculationGroupedTable';
import ProblemsPanel from '../components/calculation/ProblemsPanel';

function Stat({ label, unit, value, subtext, valueClass = 'text-text-primary' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-sm text-text-primary font-medium">
        {label}
        {unit && <span className="text-text-secondary ml-1">({unit})</span>}
      </span>
      <span className={`font-heading text-2xl ${valueClass} leading-none pt-1`}>
        {value}
      </span>
      {subtext && (
        <span className="font-body text-xs text-text-secondary">{subtext}</span>
      )}
    </div>
  );
}

const utilizationColor = (u) => {
  if (u >= 0.8) return 'text-status-green';
  if (u >= 0.6) return 'text-status-yellow';
  return 'text-status-red';
};

function CalculationPage() {
  const rows                 = useCalculationStore((s) => s.rows);
  const cutLossOverride      = useCalculationStore((s) => s.cutLossOverride);
  const setCountOverride     = useCalculationStore((s) => s.setCountOverride);
  const setCutLossOverride   = useCalculationStore((s) => s.setCutLossOverride);
  const setSetCountOverride  = useCalculationStore((s) => s.setSetCountOverride);
  const setRowSolution       = useCalculationStore((s) => s.setRowSolution);
  const clearRowSolution     = useCalculationStore((s) => s.clearRowSolution);
  const barLengthOverrides   = useCalculationStore((s) => s.barLengthOverrides);
  const setBarLengthOverride = useCalculationStore((s) => s.setBarLengthOverride);
  const projectName          = useCalculationStore((s) => s.projectName);
  const setProjectName       = useCalculationStore((s) => s.setProjectName);

  const barLengths       = useSettingsStore((s) => s.barLengths);
  const defaultCutLoss   = useSettingsStore((s) => s.defaultCutLoss);
  const defaultSetCount  = useSettingsStore((s) => s.defaultSetCount);

  const effectiveCutLoss  = cutLossOverride  ?? defaultCutLoss;
  const effectiveSetCount = setCountOverride ?? defaultSetCount;

  const result = useMemo(
    () => summarizeForDisplay(calculatePackingWithSolutions({
      rows,
      barLengths,
      cutLoss:  effectiveCutLoss,
      setCount: effectiveSetCount,
      barLengthOverrides,
    })),
    [rows, barLengths, effectiveCutLoss, effectiveSetCount, barLengthOverrides],
  );

  // Adott típushoz tartozó beállított szálhossz feloldása (a megoldás dialog-hoz)
  const resolveBarLengthForType = (type) => {
    const norm = String(type ?? '').trim().toLowerCase();
    const hit = barLengths.find((b) => b.type.trim().toLowerCase() === norm);
    if (hit) return hit.length;
    const fallback = barLengths.find((b) => !b.deletable);
    return fallback?.length ?? 6000;
  };

  const hasData = rows.length > 0;
  const { summary } = result;

  // P21: vágólap-másolás visszajelzés
  const [copyStatus, setCopyStatus] = useState('idle'); // 'idle' | 'copied' | 'error'
  const handleCopy = async () => {
    try {
      const tsv = buildCalculationTsv(result.groups, effectiveCutLoss, {
        projectName,
        setCount: effectiveSetCount,
      });
      await copyTextToClipboard(tsv);
      setCopyStatus('copied');
    } catch (err) {
      console.error('Vágólap másolás hiba:', err);
      setCopyStatus('error');
    }
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const handlePdfExport = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await exportCalculationToPdf({
        groups: result.groups,
        cutLoss: effectiveCutLoss,
        projectName,
        setCount: effectiveSetCount,
      });
    } catch (err) {
      console.error('PDF export hiba:', err);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      {/* Sticky összesítő fejléc */}
      <div className="sticky top-14 z-30 bg-panel border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label
              htmlFor="project-name"
              className="font-body text-sm text-text-primary font-medium sm:w-32 shrink-0"
            >
              Projekt neve
            </label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="pl. Csarnok-2026 (opcionális)"
              maxLength={120}
              className="flex-1 bg-input-bg text-text-primary px-3 py-2 rounded text-sm font-body
                outline-none border border-input-border focus:border-input-focus"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Stat
              label="Anyagfajták"
              unit="db"
              value={hasData ? summary.materialTypeCount : '—'}
            />
            <Stat
              label="Összes szál"
              unit="db"
              value={hasData ? summary.totalFullBars : '—'}
              subtext={hasData && summary.totalPartialGroups > 0
                ? `+ ${summary.totalPartialGroups} db részleges`
                : null}
            />
            <Stat
              label="Átl. kihasználtság"
              unit="%"
              value={hasData && summary.totalBars > 0
                ? Math.round(summary.avgUtilization * 100)
                : '—'}
              valueClass={hasData && summary.totalBars > 0
                ? utilizationColor(summary.avgUtilization)
                : 'text-text-secondary'}
            />
            <NumericInput
              label="Szettek száma"
              value={effectiveSetCount}
              onChange={(v) => setSetCountOverride(v === defaultSetCount ? null : v)}
              min={1}
              step={1}
            />
            <NumericInput
              label="Vágási veszteség"
              unit="mm"
              value={effectiveCutLoss}
              onChange={(v) => setCutLossOverride(v === defaultCutLoss ? null : v)}
              min={0}
              max={100}
              step={0.5}
              allowDecimal
            />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="font-heading text-2xl text-text-primary mb-1">
          Kalkuláció
        </h1>
        <p className="font-body text-text-secondary mb-6">
          Szálanyag-szükséglet számítása
        </p>

        {!hasData && (
          <div className="bg-panel border border-border-subtle rounded-panel p-8 text-center">
            <p className="font-body text-text-secondary">
              Vigyél át adatokat a <span className="text-accent">Szabott termékek</span> oldalról az
              „Átvitel a kalkulációhoz" gombbal.
            </p>
          </div>
        )}

        {hasData && (
          <>
            <ProblemsPanel
              rows={rows}
              errors={result.errors}
              skippedRowIds={result.skippedRowIds || []}
              resolveBarLengthForType={resolveBarLengthForType}
              onSetSolution={setRowSolution}
              onClearSolution={clearRowSolution}
            />

            <div className="bg-panel border border-border-subtle rounded-panel p-6">
              {result.errors.some((e) => e.reason === 'invalid_row') && (
                <div className="mb-5 p-3 bg-danger/10 border border-danger/40 rounded">
                  <p className="font-body text-danger text-sm font-medium">
                    {result.errors.filter((e) => e.reason === 'invalid_row').length} sor érvénytelen
                    értékekkel — ellenőrizd a Szabott termékek táblázatban.
                  </p>
                </div>
              )}
              {result.groups.length > 0 ? (
                <>
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded font-body text-sm font-medium transition-colors border ${
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
                      disabled={pdfBusy}
                      className="inline-flex items-center gap-2 bg-panel border border-border-subtle text-text-primary hover:bg-panel-hover disabled:opacity-50 disabled:cursor-wait px-4 py-2 rounded font-body text-sm font-medium transition-colors"
                    >
                      {pdfBusy ? 'PDF készül…' : 'Exportálás PDF-be'}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportCalculationToExcel({
                        groups: result.groups,
                        cutLoss: effectiveCutLoss,
                        projectName,
                        setCount: effectiveSetCount,
                      })}
                      className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded font-body text-sm font-medium transition-colors"
                    >
                      Exportálás Excel-be
                    </button>
                  </div>
                  <CalculationGroupedTable
                    groups={result.groups}
                    resolveDefaultBarLength={resolveBarLengthForType}
                    onSetBarLengthOverride={setBarLengthOverride}
                    onResetBarLengthOverride={(key) => setBarLengthOverride(key, null)}
                  />
                </>
              ) : (
                <p className="font-body text-text-secondary text-sm text-center py-8">
                  Nincs packolható sor — minden adatot kihagytál vagy hibásak.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default CalculationPage;
