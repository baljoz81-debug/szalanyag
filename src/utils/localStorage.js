// localStorage helper — manuális mentés/betöltés
// Tudatos döntés: Zustand persist middleware helyett, rugalmasabb (JSON fájl exporthoz is)

/**
 * Betölt egy értéket a localStorage-ból.
 * @param {string} key - localStorage kulcs
 * @returns {any|null} - Parsed JSON értéke, vagy null ha nem létezik / hiba esetén
 */
export function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`localStorage olvasási hiba [${key}]:`, e);
    return null;
  }
}

/**
 * Elment egy értéket a localStorage-ba JSON.stringify-olva.
 * @param {string} key - localStorage kulcs
 * @param {any} data - Mentendő adat (JSON-serializable)
 */
export function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`localStorage írási hiba [${key}]:`, e);
  }
}

/**
 * Töröl egy kulcsot a localStorage-ból.
 * @param {string} key - localStorage kulcs
 */
export function removeFromStorage(key) {
  localStorage.removeItem(key);
}
