// Kalkulációs főoldal Zustand store — P13
// A productsStore-ból átvett sorok másolatát tárolja, override-okkal együtt.
// Nem persistál localStorage-ba — az F4 fázis fogja JSON exportként/importként kezelni.
import { create } from 'zustand';

const isMeaningfulRow = (r) =>
  !!(r && (r.quality || r.type || r.size || r.cutLength || r.quantity));

const cloneRow = (r, idx) => ({
  id: `${Date.now().toString(36)}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
  quality:   r.quality ?? '',
  type:      r.type ?? '',
  size:      r.size ?? '',
  cutLength: r.cutLength ?? '',
  quantity:  r.quantity ?? '',
  solution:  null, // P21: { kind: 'split', parts: [n] } | { kind: 'customBar', barLength: n } | { kind: 'skip' }
});

const useCalculationStore = create((set, get) => ({
  // Átvett sorok (csak érdemi sorokat tartunk meg, üres placeholdert nem)
  rows: [],

  // Override-ok: null = a settingsStore default-ját használja
  cutLossOverride:  null,
  setCountOverride: null,

  // Anyag-csoportonkénti szálhossz override (P17): { [groupKey]: number }
  barLengthOverrides: {},

  // ────────────── rows ──────────────

  setRows: (newRows) => {
    const meaningful = (newRows ?? []).filter(isMeaningfulRow).map(cloneRow);
    set({ rows: meaningful });
  },

  appendRows: (newRows) => {
    const meaningful = (newRows ?? []).filter(isMeaningfulRow).map(cloneRow);
    if (meaningful.length === 0) return;
    set((state) => ({ rows: [...state.rows, ...meaningful] }));
  },

  clearRows: () => set({ rows: [], barLengthOverrides: {} }),

  // ────────────── override-ok ──────────────

  // null érték → reset a settings defaultra
  setCutLossOverride:  (value) => set({ cutLossOverride:  value }),
  setSetCountOverride: (value) => set({ setCountOverride: value }),

  setBarLengthOverride: (groupKey, value) =>
    set((state) => {
      const next = { ...state.barLengthOverrides };
      if (value == null) delete next[groupKey];
      else next[groupKey] = value;
      return { barLengthOverrides: next };
    }),

  resetBarLengthOverrides: () => set({ barLengthOverrides: {} }),

  // ────────────── P21: probléma-megoldások ──────────────

  setRowSolution: (rowId, solution) =>
    set((state) => ({
      rows: state.rows.map((r) =>
        r.id === rowId ? { ...r, solution } : r,
      ),
    })),

  clearRowSolution: (rowId) =>
    set((state) => ({
      rows: state.rows.map((r) =>
        r.id === rowId ? { ...r, solution: null } : r,
      ),
    })),

  // ────────────── selectorok ──────────────

  hasData: () => get().rows.length > 0,
}));

export default useCalculationStore;
