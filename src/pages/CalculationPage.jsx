// Kalkulációs főoldal — P14 sticky fejléc + P16 csoportosított táblázat
import { useMemo } from 'react';
import useCalculationStore from '../store/calculationStore';
import useSettingsStore from '../store/settingsStore';
import { calculatePackingWithSolutions, summarizeForDisplay } from '../utils/binPacking';
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
    })),
    [rows, barLengths, effectiveCutLoss, effectiveSetCount],
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

  return (
    <>
      {/* Sticky összesítő fejléc */}
      <div className="sticky top-14 z-30 bg-panel border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 py-3">
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
                <CalculationGroupedTable groups={result.groups} />
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
