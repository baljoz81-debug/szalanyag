// Szabott termékek Zustand store — P5
import { create } from 'zustand';

const createEmptyRow = () => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  quality: '',      // Anyagminőség (pl. S235)
  type: '',         // Típus (pl. laposacél)
  size: '',         // Méret (pl. 40x5)
  cutLength: '',    // Szabási hossz (mm)
  quantity: '',     // Darabszám (db)
});

const useProductsStore = create((set, get) => ({
  rows: [createEmptyRow()],

  updateCell: (id, field, value) => {
    set((state) => ({
      rows: state.rows.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    }));
  },

  addRow: () => {
    set((state) => {
      const lastRow = state.rows[state.rows.length - 1];
      const newRow = createEmptyRow();
      if (lastRow) {
        newRow.quality = lastRow.quality;
        newRow.type = lastRow.type;
        newRow.size = lastRow.size;
      }
      return { rows: [...state.rows, newRow] };
    });
  },

  removeRow: (id) => {
    set((state) => {
      const filtered = state.rows.filter((row) => row.id !== id);
      return { rows: filtered.length > 0 ? filtered : [createEmptyRow()] };
    });
  },

  // Import: sorok felülírása (Excel/CSV betöltés)
  setRows: (newRows) => {
    set({ rows: newRows.length > 0 ? newRows : [createEmptyRow()] });
  },

  // Import: sorok hozzáfűzése a meglévőkhöz
  appendRows: (newRows) => {
    if (newRows.length === 0) return;
    set((state) => {
      // Ha csak egyetlen üres sor van, azt cseréljük le
      const existing = state.rows;
      const isSingleEmpty = existing.length === 1 &&
        !existing[0].quality && !existing[0].type && !existing[0].size &&
        !existing[0].cutLength && !existing[0].quantity;
      return { rows: isSingleEmpty ? newRows : [...existing, ...newRows] };
    });
  },

  getRows: () => get().rows,
}));

export { createEmptyRow };
export default useProductsStore;
