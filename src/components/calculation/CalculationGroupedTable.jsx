// P16: csoportosított főoldali táblázat — anyagminőség > típus > méret hierarchia
// P17: szálhossz override per-csoport
// P19: összecsukható csoportok (quality + type szinten)
// F3a: szabási előnézet kibontható panellel (CuttingPlanBar)
import { useMemo, useState, useCallback } from 'react';
import BarLengthEditor from './BarLengthEditor';
import CuttingPlanBar from './CuttingPlanBar';
import { groupIdenticalBars, formatBarIndices } from '../../utils/cuttingPlanGroups';

const Caret = ({ open }) => (
  <span
    className={`inline-block transition-transform text-text-secondary text-xs leading-none ${
      open ? 'rotate-90' : ''
    }`}
    aria-hidden="true"
  >
    ▶
  </span>
);

const utilizationColor = (u) => {
  if (u >= 0.8) return 'text-status-green';
  if (u >= 0.6) return 'text-status-yellow';
  return 'text-status-red';
};

const Empty = ({ children }) => (
  <span className="text-text-secondary italic">{children ?? '—'}</span>
);

const formatMeters = (m) =>
  m.toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function groupByQualityType(groups) {
  const result = [];
  const qualityIdx = new Map();
  for (const g of groups) {
    const qKey = g.quality || '';
    let qg = qualityIdx.get(qKey);
    if (!qg) {
      qg = { quality: qKey, types: [], _typeIdx: new Map() };
      qualityIdx.set(qKey, qg);
      result.push(qg);
    }
    const tKey = g.type || '';
    let tg = qg._typeIdx.get(tKey);
    if (!tg) {
      tg = { type: tKey, items: [] };
      qg._typeIdx.set(tKey, tg);
      qg.types.push(tg);
    }
    tg.items.push(g);
  }
  return result.map((qg) => ({ quality: qg.quality, types: qg.types }));
}

// Egy méret-sor + opcionális szabási előnézet a sor alatt
function FragmentRow({
  g, d, isCustom, isOverride, defaultBarLength, requiredMeters,
  planOpen, canShowPlan, cutLoss,
  onSetBarLengthOverride, onResetBarLengthOverride, onTogglePlan,
}) {
  return (
    <>
      <tr className="border-b border-border-subtle/40 hover:bg-panel-hover/40 transition-colors">
        <td className="py-2 px-3 text-text-primary">
          <div className="flex items-center gap-2">
            {canShowPlan ? (
              <button
                type="button"
                onClick={onTogglePlan}
                className="text-text-secondary hover:text-accent transition-colors text-xs leading-none"
                aria-expanded={planOpen}
                aria-label={planOpen ? 'Szabási terv elrejtése' : 'Szabási terv mutatása'}
                title={planOpen ? 'Szabási terv elrejtése' : 'Szabási terv mutatása'}
              >
                <span className={`inline-block transition-transform ${planOpen ? 'rotate-90' : ''}`}>▶</span>
              </button>
            ) : (
              <span className="w-3 inline-block" />
            )}
            <span>{g.size || <Empty />}</span>
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums">
          <BarLengthEditor
            value={g.barLength}
            defaultValue={defaultBarLength}
            isOverride={isOverride}
            disabled={isCustom}
            onChange={(v) => onSetBarLengthOverride?.(g.key, v)}
            onReset={() => onResetBarLengthOverride?.(g.key)}
          />
        </td>
        <td className="py-2 px-3 text-right text-text-primary tabular-nums font-medium">
          {g.totalBars > 0 ? formatMeters(requiredMeters) : <Empty />}
        </td>
        <td className="py-2 px-3 text-right text-text-primary tabular-nums font-medium">
          {d.full}
        </td>
        <td className="py-2 px-3 text-right text-text-primary tabular-nums">
          {d.hasPartial ? formatMeters(d.partialMeters) : <Empty />}
        </td>
        <td className={`py-2 px-3 text-right tabular-nums font-medium ${
          g.totalBars > 0 ? utilizationColor(g.avgUtilization) : 'text-text-secondary'
        }`}>
          {g.totalBars > 0 ? `${Math.round(g.avgUtilization * 100)}%` : <Empty />}
        </td>
      </tr>
      {planOpen && canShowPlan && (
        <tr className="border-b border-border-subtle/40">
          <td colSpan={6} className="py-3 px-3 bg-app-bg/40">
            <CuttingPlanList bars={g.bars} barLength={g.barLength} cutLoss={cutLoss} />
          </td>
        </tr>
      )}
    </>
  );
}

function CuttingPlanList({ bars, barLength, cutLoss }) {
  // Azonos szabási tervű szálakat egy sávba vonjuk össze
  const planGroups = groupIdenticalBars(bars);
  const HARD_LIMIT = 25;
  const visibleGroups = planGroups.slice(0, HARD_LIMIT);
  const hiddenBars = planGroups
    .slice(HARD_LIMIT)
    .reduce((sum, g) => sum + g.indices.length, 0);
  const subtitle =
    planGroups.length === bars.length
      ? `${bars.length} szál`
      : `${bars.length} szál · ${planGroups.length} különböző minta`;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 font-body text-xs text-text-secondary flex-wrap">
        <span>Szabási terv ({subtitle})</span>
        <LegendSwatch color="#1d4ed8" label="Darab" />
        {cutLoss > 0 && <LegendSwatch color="#f97316" label={`Vágási veszteség (${cutLoss} mm)`} />}
        <LegendSwatch color="#3a3a3a" label="Maradék" striped />
      </div>
      <div className="space-y-1.5">
        {visibleGroups.map((group, idx) => {
          const count = group.indices.length;
          const range = formatBarIndices(group.indices);
          const label = count > 1
            ? `Szál ${range} (${count}×)`
            : `Szál ${range}`;
          return (
            <CuttingPlanBar
              key={idx}
              barLength={barLength}
              pieces={group.representative.pieces}
              cutLoss={cutLoss}
              label={label}
            />
          );
        })}
      </div>
      {hiddenBars > 0 && (
        <p className="font-body text-xs text-text-secondary italic mt-2">
          + még {hiddenBars} szál (rejtve a teljesítmény miatt — exportálható PDF-be)
        </p>
      )}
    </div>
  );
}

function LegendSwatch({ color, label, striped }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm border border-border-subtle"
        style={{
          background: striped
            ? `repeating-linear-gradient(45deg, #2a2a2a 0 3px, #3f3f3f 3px 6px)`
            : color,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function CalculationGroupedTable({
  groups,
  cutLoss = 0,
  resolveDefaultBarLength,
  onSetBarLengthOverride,
  onResetBarLengthOverride,
}) {
  const tree = useMemo(() => groupByQualityType(groups), [groups]);

  // P19: collapsed Set — csak akkor zárt, ha benne van. Alapból minden nyitott.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggle = useCallback((key) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // F3a: kibontott szabási-tervek — Set, csak akkor látszik, ha benne van a key
  const [expandedPlans, setExpandedPlans] = useState(() => new Set());
  const togglePlan = useCallback((key) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="space-y-8">
      {tree.map((qualityGroup) => {
        const qKey = `q:${qualityGroup.quality || '__empty__'}`;
        const qOpen = !collapsed.has(qKey);
        const typeCount = qualityGroup.types.length;
        const sizeCount = qualityGroup.types.reduce((s, t) => s + t.items.length, 0);

        return (
          <section key={qualityGroup.quality || '__empty__'}>
            <h2 className="font-heading text-lg text-accent border-b border-border-subtle pb-2 mb-4">
              <button
                type="button"
                onClick={() => toggle(qKey)}
                className="w-full flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                aria-expanded={qOpen}
              >
                <Caret open={qOpen} />
                <span>{qualityGroup.quality || <Empty>(nincs minőség)</Empty>}</span>
                {!qOpen && (
                  <span className="ml-auto text-xs font-normal text-text-secondary">
                    {typeCount} típus · {sizeCount} méret
                  </span>
                )}
              </button>
            </h2>

            {qOpen && (
            <div className="space-y-5">
              {qualityGroup.types.map((typeGroup) => {
                const tKey = `t:${qualityGroup.quality || '__empty__'}|${typeGroup.type || '__empty__'}`;
                const tOpen = !collapsed.has(tKey);
                return (
              <div key={typeGroup.type || '__empty__'}>
                <h3 className="font-body text-sm text-text-primary font-semibold mb-2">
                  <button
                    type="button"
                    onClick={() => toggle(tKey)}
                    className="w-full flex items-center gap-2 flex-wrap text-left hover:opacity-80 transition-opacity"
                    aria-expanded={tOpen}
                  >
                    <Caret open={tOpen} />
                    <span>{typeGroup.type || <Empty>(nincs típus)</Empty>}</span>
                    {typeGroup.items.some((g) => g.barLengthSource === 'default') && (
                      <span className="text-xs font-normal text-text-secondary italic">
                        (alapértelmezett szálhossz)
                      </span>
                    )}
                    {typeGroup.items.some((g) => g.customBar) && (
                      <span className="text-xs font-normal text-accent italic">
                        (egyedi szálhossz)
                      </span>
                    )}
                    {!tOpen && (
                      <span className="ml-auto text-xs font-normal text-text-secondary">
                        {typeGroup.items.length} méret
                      </span>
                    )}
                  </button>
                </h3>

                {tOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full font-body text-sm border-collapse">
                    <thead>
                      <tr className="text-text-secondary border-b border-border-subtle">
                        <th className="text-left  py-2 px-3 font-medium">Méret</th>
                        <th className="text-right py-2 px-3 font-medium">Szálhossz (mm)</th>
                        <th className="text-right py-2 px-3 font-medium">Szükséges anyagmennyiség (m)</th>
                        <th className="text-right py-2 px-3 font-medium">Teljes szálak (db)</th>
                        <th className="text-right py-2 px-3 font-medium">Utolsó szál (m)</th>
                        <th className="text-right py-2 px-3 font-medium">Kihasználtság</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeGroup.items.map((g) => {
                        const d = g.displayBars;
                        const isCustom = !!g.customBar;
                        const isOverride = g.barLengthSource === 'override';
                        const defaultBarLength = isCustom
                          ? g.barLength
                          : (resolveDefaultBarLength?.(g.type) ?? g.barLength);
                        const requiredMeters =
                          (g.barLength * d.full) / 1000 + (d.hasPartial ? d.partialMeters : 0);
                        const planOpen = expandedPlans.has(g.key);
                        const canShowPlan = g.totalBars > 0;
                        return (
                          <FragmentRow
                            key={g.key}
                            g={g}
                            d={d}
                            isCustom={isCustom}
                            isOverride={isOverride}
                            defaultBarLength={defaultBarLength}
                            requiredMeters={requiredMeters}
                            planOpen={planOpen}
                            canShowPlan={canShowPlan}
                            cutLoss={cutLoss}
                            onSetBarLengthOverride={onSetBarLengthOverride}
                            onResetBarLengthOverride={onResetBarLengthOverride}
                            onTogglePlan={() => togglePlan(g.key)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
                );
              })}
            </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default CalculationGroupedTable;
