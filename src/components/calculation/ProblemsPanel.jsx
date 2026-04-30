// P21: Problémás darabok panel — listázza a túl hosszú / kezelt sorokat,
// minden sorhoz Megoldás / Módosítás / Visszavonás gombokkal.
import { useMemo, useState } from 'react';
import ProblemSolutionDialog from './ProblemSolutionDialog';

// A wrapper által generált virtuális rowId (pl. "abc__sp0", "abc__cbar") visszaalakítása az eredeti row.id-re
const stripVirtualSuffix = (id) => String(id).replace(/__sp\d+$|__cbar$/, '');

const formatSolution = (sol) => {
  if (!sol) return null;
  if (sol.kind === 'skip') return 'Kihagyva a kalkulációból';
  if (sol.kind === 'split') return `Toldás: ${sol.parts.join(' + ')} mm`;
  if (sol.kind === 'customBar') return `Egyedi szálhossz: ${sol.barLength} mm`;
  return null;
};

function ProblemsPanel({
  rows,
  errors,
  skippedRowIds,
  resolveBarLengthForType,
  onSetSolution,
  onClearSolution,
}) {
  const [editingRow, setEditingRow] = useState(null);

  // Problémásnak vagy kezeltnek számító sorok összegyűjtése
  const items = useMemo(() => {
    const tooLongRowIds = new Set(
      errors
        .filter((e) => e.reason === 'piece_too_long')
        .map((e) => stripVirtualSuffix(e.rowId)),
    );
    const skippedSet = new Set(skippedRowIds);

    const list = [];
    for (const row of rows) {
      const hasSolution = !!row.solution;
      const isTooLong = tooLongRowIds.has(row.id);
      const isSkipped = skippedSet.has(row.id);

      if (!hasSolution && !isTooLong) continue;

      list.push({
        row,
        status: hasSolution
          ? (isTooLong || isSkipped ? 'resolved' : 'resolved')
          : 'unresolved',
        // unresolved: van probléma, nincs solution
        // resolved: van solution
      });
    }
    return list;
  }, [rows, errors, skippedRowIds]);

  if (items.length === 0) return null;

  const unresolvedCount = items.filter((i) => i.status === 'unresolved').length;
  const resolvedCount = items.length - unresolvedCount;

  return (
    <>
      <div className="bg-panel border border-border-subtle rounded-panel p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg text-text-primary flex items-center gap-2">
            <span className={unresolvedCount > 0 ? 'text-danger' : 'text-status-yellow'}>⚠</span>
            Problémás darabok
          </h2>
          <span className="font-body text-sm text-text-secondary">
            {unresolvedCount > 0 && (
              <span className="text-danger font-medium">{unresolvedCount} kezeletlen</span>
            )}
            {unresolvedCount > 0 && resolvedCount > 0 && <span> · </span>}
            {resolvedCount > 0 && <span>{resolvedCount} megoldva</span>}
          </span>
        </div>

        <div className="space-y-2">
          {items.map(({ row, status }) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 p-3 rounded border ${
                status === 'unresolved'
                  ? 'border-danger/40 bg-danger/5'
                  : 'border-border-subtle bg-panel-hover/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm text-text-primary">
                  {row.quality || '—'} / {row.type || '—'} / {row.size || '—'}
                  {' '}<span className="text-text-secondary">·</span>
                  {' '}<span className="tabular-nums">{row.cutLength} mm × {row.quantity} db</span>
                </div>
                {row.solution && (
                  <div className="font-body text-xs text-text-secondary mt-0.5">
                    {formatSolution(row.solution)}
                  </div>
                )}
                {status === 'unresolved' && (
                  <div className="font-body text-xs text-danger mt-0.5">
                    Hosszabb a szálanyagnál — még nincs megoldás.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditingRow(row)}
                  className={`px-3 py-1.5 text-xs font-body rounded transition-colors ${
                    status === 'unresolved'
                      ? 'bg-accent text-white hover:bg-accent-hover'
                      : 'bg-panel-hover text-text-primary border border-border-subtle hover:border-accent'
                  }`}
                >
                  {status === 'unresolved' ? 'Megoldás' : 'Módosítás'}
                </button>
                {row.solution && (
                  <button
                    onClick={() => onClearSolution(row.id)}
                    className="px-2 py-1.5 text-xs font-body text-text-secondary hover:text-danger transition-colors"
                    title="Megoldás visszavonása"
                  >
                    Visszavonás
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingRow && (
        <ProblemSolutionDialog
          row={editingRow}
          currentSolution={editingRow.solution}
          defaultBarLength={resolveBarLengthForType(editingRow.type)}
          onSave={(solution) => {
            onSetSolution(editingRow.id, solution);
            setEditingRow(null);
          }}
          onCancel={() => setEditingRow(null)}
        />
      )}
    </>
  );
}

export default ProblemsPanel;
