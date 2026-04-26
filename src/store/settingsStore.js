// Beállítások Zustand store — teljes P0–P4 implementáció
// barLengths + defaultCutLoss + defaultSetCount, manuális localStorage perzisztencia
import { create } from 'zustand';
import { loadFromStorage, saveToStorage } from '../utils/localStorage';

const STORAGE_KEY = 'szalanyag_settings';

// Alapértelmezett anyagminőségek
const DEFAULT_MATERIAL_QUALITIES = [
  { id: '1', name: 'S235' },
  { id: '2', name: 'S355' },
  { id: '3', name: 'DC01' },
  { id: '4', name: 'St37' },
];

// Alapértelmezett anyagtípusok és szálhosszak
const DEFAULT_BAR_LENGTHS = [
  { id: '1', type: 'Laposacél',             length: 6000, deletable: true  },
  { id: '2', type: 'Szögacél',              length: 6000, deletable: true  },
  { id: '3', type: 'Köranyag',              length: 3000, deletable: true  },
  { id: '4', type: 'Négyszögrúd',           length: 6000, deletable: true  },
  { id: '5', type: 'Zártszelvény',          length: 6000, deletable: true  },
  { id: '6', type: 'Csövek',               length: 6000, deletable: true  },
  { id: '7', type: 'Egyéb / alapértelmezett', length: 6000, deletable: false },
];

const DEFAULT_SETTINGS = {
  barLengths:        DEFAULT_BAR_LENGTHS,
  materialQualities: DEFAULT_MATERIAL_QUALITIES,
  defaultCutLoss:    3,   // mm — alapértelmezett vágási veszteség
  defaultSetCount:   1,   // db — alapértelmezett szetek száma
};

const useSettingsStore = create((set, get) => {
  // App indulásakor localStorage-ból töltünk, vagy az alapértelmezetteket használjuk
  const saved = loadFromStorage(STORAGE_KEY);
  let initial = saved
    ? { ...DEFAULT_SETTINGS, ...saved }
    : { ...DEFAULT_SETTINGS };

  // Hiányzó default típusok pótlása meglévő beállításokhoz
  if (saved?.barLengths) {
    const existingTypes = saved.barLengths.map((b) => b.type.toLowerCase());
    for (const def of DEFAULT_BAR_LENGTHS) {
      if (def.type === 'Egyéb / alapértelmezett') continue;
      if (!existingTypes.includes(def.type.toLowerCase())) {
        // Az "Egyéb" sor elé beszúrjuk
        const egyebIdx = initial.barLengths.findIndex((b) => !b.deletable);
        const newItem = { ...def, id: String(Date.now()) + def.id };
        if (egyebIdx >= 0) {
          initial.barLengths.splice(egyebIdx, 0, newItem);
        } else {
          initial.barLengths.push(newItem);
        }
      }
    }
  }

  return {
    // --- Állapot ---
    barLengths:        initial.barLengths,
    materialQualities: initial.materialQualities,
    defaultCutLoss:    initial.defaultCutLoss,
    defaultSetCount:   initial.defaultSetCount,

    // --- Akciók: szálhossz tábla ---

    // Szálhossz érték frissítése (mm, pozitív egész)
    updateBarLength: (id, newLength) => {
      set((state) => ({
        barLengths: state.barLengths.map((item) =>
          item.id === id ? { ...item, length: newLength } : item
        ),
      }));
      get()._persist();
    },

    // Típusnév frissítése
    updateBarType: (id, newType) => {
      set((state) => ({
        barLengths: state.barLengths.map((item) =>
          item.id === id ? { ...item, type: newType } : item
        ),
      }));
      get()._persist();
    },

    // Új sor hozzáadása — üres, szerkeszthető
    addBarLength: () => {
      set((state) => ({
        barLengths: [
          ...state.barLengths,
          { id: String(Date.now()), type: '', length: 6000, deletable: true },
        ],
      }));
      get()._persist();
    },

    // Sor törlése — csak deletable: true esetén
    removeBarLength: (id) => {
      set((state) => ({
        barLengths: state.barLengths.filter(
          (item) => item.id !== id || !item.deletable
        ),
      }));
      get()._persist();
    },

    // Sorrend változtatása — fromIndex → toIndex
    reorderBarLengths: (fromIndex, toIndex) => {
      set((state) => {
        const items = [...state.barLengths];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        return { barLengths: items };
      });
      get()._persist();
    },

    // --- Akciók: anyagminőség tábla ---

    updateMaterialQuality: (id, newName) => {
      set((state) => ({
        materialQualities: state.materialQualities.map((item) =>
          item.id === id ? { ...item, name: newName } : item
        ),
      }));
      get()._persist();
    },

    addMaterialQuality: () => {
      set((state) => ({
        materialQualities: [
          ...state.materialQualities,
          { id: String(Date.now()), name: '' },
        ],
      }));
      get()._persist();
    },

    removeMaterialQuality: (id) => {
      set((state) => ({
        materialQualities: state.materialQualities.filter((item) => item.id !== id),
      }));
      get()._persist();
    },

    reorderMaterialQualities: (fromIndex, toIndex) => {
      set((state) => {
        const items = [...state.materialQualities];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        return { materialQualities: items };
      });
      get()._persist();
    },

    // --- Akciók: egyéb beállítások ---

    // Vágási veszteség frissítése (mm, 0–100, tizedes megengedett)
    setDefaultCutLoss: (value) => {
      set({ defaultCutLoss: value });
      get()._persist();
    },

    // Szetek száma frissítése (pozitív egész, min 1)
    setDefaultSetCount: (value) => {
      set({ defaultSetCount: value });
      get()._persist();
    },

    // --- Belső: localStorage mentés ---
    // Minden akcio után automatikusan meghívódik
    _persist: () => {
      const { barLengths, materialQualities, defaultCutLoss, defaultSetCount } = get();
      saveToStorage(STORAGE_KEY, { barLengths, materialQualities, defaultCutLoss, defaultSetCount });
    },
  };
});

export default useSettingsStore;
