// P16: csoportosított főoldali táblázat — anyagminőség > típus > méret hierarchia
import { useMemo } from 'react';

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

function CalculationGroupedTable({ groups }) {
  const tree = useMemo(() => groupByQualityType(groups), [groups]);

  return (
    <div className="space-y-8">
      {tree.map((qualityGroup) => (
        <section key={qualityGroup.quality || '__empty__'}>
          <h2 className="font-heading text-lg text-accent border-b border-border-subtle pb-2 mb-4">
            {qualityGroup.quality || <Empty>(nincs minőség)</Empty>}
          </h2>

          <div className="space-y-5">
            {qualityGroup.types.map((typeGroup) => (
              <div key={typeGroup.type || '__empty__'}>
                <h3 className="font-body text-sm text-text-primary font-semibold mb-2 flex items-center gap-2 flex-wrap">
                  {typeGroup.type || <Empty>(nincs típus)</Empty>}
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
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full font-body text-sm border-collapse">
                    <thead>
                      <tr className="text-text-secondary border-b border-border-subtle">
                        <th className="text-left  py-2 px-3 font-medium">Méret</th>
                        <th className="text-right py-2 px-3 font-medium">Szálhossz (mm)</th>
                        <th className="text-right py-2 px-3 font-medium">Teljes szálak (db)</th>
                        <th className="text-right py-2 px-3 font-medium">Utolsó szál (m)</th>
                        <th className="text-right py-2 px-3 font-medium">Kihasználtság</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeGroup.items.map((g) => {
                        const d = g.displayBars;
                        return (
                          <tr
                            key={g.key}
                            className="border-b border-border-subtle/40 hover:bg-panel-hover/40 transition-colors"
                          >
                            <td className="py-2 px-3 text-text-primary">
                              {g.size || <Empty />}
                            </td>
                            <td className="py-2 px-3 text-right text-text-primary tabular-nums">
                              {g.barLength}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default CalculationGroupedTable;
