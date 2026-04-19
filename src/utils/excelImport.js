// Excel/CSV import — P7+P8: fájl beolvasás + automatikus oszlopazonosítás
import * as XLSX from 'xlsx';

// Tiltólista: ezek az oszlopnevek soha ne kerüljenek automatikusan hozzárendelésre
const COLUMN_BLACKLIST = ['rajzszám', 'rajzszam', 'megnevezés', 'megnevezes', 'megjegyzés', 'megjegyzes', 'jel', 'szám', 'szam', 'sorszám', 'sorszam'];

// Oszlop-kulcsszavak az automatikus felismeréshez (kis-nagybetű érzéketlen)
const COLUMN_PATTERNS = {
  quality:   ['anyagminőség', 'anyagminoseg', 'minőség', 'minoseg', 'quality', 'anyag'],
  type:      ['típus', 'tipus', 'type', 'anyagtípus', 'szelvény', 'szelveny'],
  size:      ['méret', 'meret', 'size', 'átmérő', 'atmero', 'profil', 'dimenzió', 'magasság', 'magassag', 'height', 'x'],
  size2:     ['szélesség', 'szelesseg', 'width', 'b', 'y'],
  size3:     ['falvastagság', 'falvastagsag', 'falv.', 'vastagság', 'vastagsag', 'wall', 'thickness', 's'],
  cutLength: ['hossz', 'szabási hossz', 'szabási', 'szabasi', 'length', 'hossz (mm)', 'hossz(mm)', 'l'],
  quantity:  ['darabszám', 'darabszam', 'mennyiség', 'mennyiseg', 'quantity', 'pcs', 'db', 'db.'],
};

/**
 * Minta illesztése fejléc szövegre.
 * Rövid minták (max 2 karakter): pontos egyezés VAGY a fejléc ezzel kezdődik
 * és utána szóköz, zárójel vagy sor vége jön (pl. "x (mm)" illeszkedik "x"-re).
 * Hosszú minták: includes.
 */
function matchPattern(cellStr, pattern) {
  if (pattern.length <= 2) {
    if (cellStr === pattern) return true;
    // "x (mm)", "db.", "db " stb.
    return cellStr.startsWith(pattern) && /^[\s(.)]/.test(cellStr.slice(pattern.length));
  }
  return cellStr.includes(pattern);
}

/**
 * Elfogadott fájl kiterjesztés ellenőrzése
 */
export function validateFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ['xlsx', 'xls', 'csv'].includes(ext);
}

/**
 * Excel/CSV fájl beolvasása ArrayBuffer-ből.
 * Visszaadja a workbook-ot és a munkalapnevek listáját.
 */
export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  if (!wb.SheetNames.length) {
    throw new Error('A fájl nem tartalmaz munkalapot.');
  }

  return { wb, sheetNames: wb.SheetNames };
}

/**
 * Egy adott munkalap kiolvasása a workbook-ból.
 */
export function parseSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (allRows.length === 0) {
    throw new Error(`A „${sheetName}" munkalap üres.`);
  }

  return allRows;
}

/**
 * Fejléc-sor keresése: megkeresi azt a sort, amelyik a legtöbb oszlopnevet tartalmazza.
 * Visszaadja a fejléc sor indexét, vagy -1 ha nem találtunk fejlécet.
 */
export function findHeaderRowIndex(allRows) {
  let bestIndex = -1;
  let bestScore = 0;

  // Az első 5 sorban keresünk fejlécet
  const searchLimit = Math.min(allRows.length, 5);

  for (let i = 0; i < searchLimit; i++) {
    const row = allRows[i];
    let score = 0;

    for (const cell of row) {
      const cellStr = String(cell).toLowerCase().trim();
      if (!cellStr) continue;
      if (COLUMN_BLACKLIST.some((bl) => cellStr.includes(bl))) continue;

      for (const patterns of Object.values(COLUMN_PATTERNS)) {
        if (patterns.some((p) => matchPattern(cellStr, p))) {
          score++;
          break;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  // Legalább 2 oszlopnevet kell felismernünk
  return bestScore >= 2 ? bestIndex : -1;
}

/**
 * Oszlop-leképezés fejléc alapján.
 * Visszaad egy mapping-et: { quality: colIdx, type: colIdx, ... }
 */
export function mapColumnsByHeader(headerRow) {
  const mapping = {};

  headerRow.forEach((cell, colIdx) => {
    const cellStr = String(cell).toLowerCase().trim();
    if (!cellStr) return;

    // Tiltólistán lévő oszlopnevek kihagyása
    if (COLUMN_BLACKLIST.some((bl) => cellStr.includes(bl))) return;

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (mapping[field] !== undefined) continue; // már megvan
      if (patterns.some((p) => matchPattern(cellStr, p))) {
        mapping[field] = colIdx;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Adatsor szűrése: kihagyjuk az üres sorokat és az "Összesen" típusú összegző sorokat
 */
function isDataRow(row) {
  const nonEmpty = row.filter((cell) => String(cell).trim() !== '');
  if (nonEmpty.length === 0) return false;

  const firstCell = String(row[0]).toLowerCase().trim();
  if (firstCell.startsWith('összesen') || firstCell.startsWith('osszesen') || firstCell === 'sum') {
    return false;
  }

  return true;
}

/**
 * Anyaglista formátum felismerése: a fejléc tartalmazza a "rajzszám" oszlopot,
 * ÉS vannak kategória sorok az adatban.
 */
export function isAnyaglistaFormat(headerRow, dataRows, mapping) {
  const hasRajzszam = headerRow.some((cell) => {
    const cellStr = String(cell).toLowerCase().trim();
    return cellStr.includes('rajzszám') || cellStr.includes('rajzszam');
  });
  if (!hasRajzszam) return false;

  // Csak akkor anyaglista, ha ténylegesen vannak kategória sorok
  return dataRows.some((row) => isCategoryRow(row, mapping));
}

/**
 * Kategória sor felismerése az anyaglista formátumban.
 * Kategória sor: A oszlopban van érték (anyagtípus neve), B üres,
 * és a Hossz/Db. oszlopok (cutLength, quantity) üresek.
 */
function isCategoryRow(row, mapping) {
  const colA = String(row[0] ?? '').trim();
  const colB = String(row[1] ?? '').trim();
  if (!colA || colB) return false;

  // Hossz és Db. oszlopok üresek
  const cutLengthVal = mapping.cutLength !== undefined ? String(row[mapping.cutLength] ?? '').trim() : '';
  const quantityVal = mapping.quantity !== undefined ? String(row[mapping.quantity] ?? '').trim() : '';
  if (cutLengthVal || quantityVal) return false;

  return true;
}

/**
 * Anyaglista formátum feldolgozása: kategória sorokból típust rendel az adatsorokhoz.
 * Visszaadja a feldolgozott adatsorokat, ahol minden sor kap egy _categoryType mezőt.
 */
export function preprocessAnyaglista(dataRows, mapping, knownTypes) {
  let currentCategory = '';
  const result = [];
  const categories = [];

  for (const row of dataRows) {
    if (isCategoryRow(row, mapping)) {
      const rawCategory = String(row[0]).trim();
      // Megpróbáljuk a knownTypes-ból a legközelebbi egyezést találni
      const matched = matchCategoryToKnownType(rawCategory, knownTypes);
      currentCategory = matched || rawCategory;
      if (!categories.includes(currentCategory)) {
        categories.push(currentCategory);
      }
      continue; // kategória sort nem adjuk tovább
    }
    // Hozzácsatoljuk a kategória típust a sorhoz
    row._categoryType = currentCategory;
    result.push(row);
  }

  return { rows: result, categories };
}

/**
 * Kategória név egyeztetése a beállításokban lévő típusnevekkel.
 * Prefix-alapú egyeztetés, min 3 karakter.
 */
function matchCategoryToKnownType(categoryName, knownTypes) {
  if (!knownTypes || knownTypes.length === 0) return '';

  const catLower = categoryName.toLowerCase();
  let bestMatch = '';
  let bestLen = 0;

  for (const typeName of knownTypes) {
    const typeNameLower = typeName.toLowerCase();
    const minLen = Math.min(catLower.length, typeNameLower.length);
    if (minLen < 3) continue;

    let matchLen = 0;
    for (let i = 0; i < minLen; i++) {
      if (catLower[i] === typeNameLower[i]) matchLen++;
      else break;
    }

    if (matchLen >= 3 && matchLen > bestLen) {
      bestLen = matchLen;
      bestMatch = typeName;
    }
  }

  return bestMatch;
}

/**
 * Szám mező validálása és konvertálása.
 * Visszaad: { value: number|'', warning: string|null }
 */
function parseNumericField(rawValue, fieldLabel) {
  if (!rawValue) return { value: '', warning: null };

  // Tizedes vesszős formátum kezelése (pl. "1500,5" → "1500.5")
  const normalized = String(rawValue).replace(',', '.');
  const num = parseFloat(normalized);

  if (isNaN(num)) {
    return { value: '', warning: `„${rawValue}" nem szám (${fieldLabel})` };
  }
  if (num <= 0) {
    return { value: '', warning: `${num} nem pozitív érték (${fieldLabel})` };
  }
  if (num > 100000) {
    return { value: '', warning: `${num} irreálisan nagy érték (${fieldLabel})` };
  }

  const intVal = Math.round(num);

  return { value: intVal, warning: null };
}

/**
 * Sorok konvertálása a ProductsStore formátumra a mapping alapján.
 * Visszaad: { rows: array, warnings: string[], warningCells: Map<string, Set<string>> }
 * warningCells: rowId → Set of hibás mező kulcsok (pl. 'cutLength', 'quantity', 'size')
 */
function convertRows(dataRows, mapping) {
  const warnings = [];
  const warningCells = new Map();
  let skippedEmpty = 0;

  const rows = dataRows.filter(isDataRow).map((row, rowIdx) => {
    const getValue = (field) => {
      if (mapping[field] === undefined) return '';
      const val = row[mapping[field]];
      return val !== undefined && val !== null ? String(val).trim() : '';
    };

    const cutLengthRaw = getValue('cutLength');
    const quantityRaw = getValue('quantity');
    const cutLengthResult = parseNumericField(cutLengthRaw, 'szabási hossz');
    const quantityResult = parseNumericField(quantityRaw, 'darabszám');

    const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);

    // Figyelmeztetések gyűjtése (soronként + cellánként)
    const rowWarnings = [];
    const cellKeys = new Set();

    if (cutLengthResult.warning) {
      rowWarnings.push(cutLengthResult.warning);
      cellKeys.add('cutLength');
    }
    if (quantityResult.warning) {
      rowWarnings.push(quantityResult.warning);
      cellKeys.add('quantity');
    }

    // Összetett méret: size + size2 + size3 összefűzése "x" elválasztóval
    const sizeParts = [getValue('size'), getValue('size2'), getValue('size3')].filter(Boolean);
    const size = sizeParts.join('x');

    // Hiányzó kötelező mezők ellenőrzése
    const hasAnyData = size || cutLengthResult.value || quantityResult.value;
    if (hasAnyData) {
      if (!size && mapping.size !== undefined) {
        rowWarnings.push('hiányzó méret');
        cellKeys.add('size');
      }
      if (!cutLengthResult.value && !cutLengthResult.warning) {
        rowWarnings.push('hiányzó szabási hossz');
        cellKeys.add('cutLength');
      }
      if (!quantityResult.value && !quantityResult.warning) {
        rowWarnings.push('hiányzó darabszám');
        cellKeys.add('quantity');
      }
    }

    if (rowWarnings.length > 0) {
      warnings.push(`${rowIdx + 1}. sor: ${rowWarnings.join('; ')}`);
      warningCells.set(id, cellKeys);
    }

    return {
      id,
      quality: getValue('quality') || 'S235',
      type: getValue('type') || row._categoryType || '',
      size,
      cutLength: cutLengthResult.value,
      quantity: quantityResult.value,
    };
  }).filter((row) => {
    const hasData = row.size || row.cutLength || row.quantity;
    if (!hasData) skippedEmpty++;
    return hasData;
  });

  if (skippedEmpty > 0) {
    warnings.unshift(`${skippedEmpty} sor kihagyva (nincs érdemi adat)`);
  }

  return { rows, warnings, warningCells };
}

/**
 * Típusnév kinyerése a cím sorból (fejléc előtti sorok).
 * A beállításokban lévő típusnevekkel próbálja egyeztetni prefix alapján.
 * Pl. "Köracél szabásjegyzék" → "Köranyag" (ha "Kör" prefix egyezik)
 *     "Laposvas szabásjegyzék" → "Laposacél" (ha "Lapos" prefix egyezik)
 */
export function detectTypeFromTitle(titleRows, knownTypes) {
  if (!knownTypes || knownTypes.length === 0) return '';

  // Cím sorok szövegét összefűzzük
  const titleText = titleRows
    .map((row) => row.map((cell) => String(cell).trim()).join(' '))
    .join(' ')
    .toLowerCase();

  // Szavakra bontjuk a címet
  const titleWords = titleText.split(/[\s–—\-,;:./()]+/).filter(Boolean);

  let bestMatch = '';
  let bestLen = 0;

  for (const typeName of knownTypes) {
    const typeNameLower = typeName.toLowerCase();

    for (const word of titleWords) {
      // Kölcsönös prefix egyezés: a rövidebb az elejére illeszkedik a hosszabbnak
      const minLen = Math.min(word.length, typeNameLower.length);
      // Legalább 3 karakter egyezzen
      if (minLen < 3) continue;

      let matchLen = 0;
      for (let i = 0; i < minLen; i++) {
        if (word[i] === typeNameLower[i]) matchLen++;
        else break;
      }

      if (matchLen >= 3 && matchLen > bestLen) {
        bestLen = matchLen;
        bestMatch = typeName; // az eredeti (nem lowercase) nevet adjuk vissza
      }
    }
  }

  return bestMatch;
}

/**
 * Oszlop-leképezés alkalmazása: nyers adatsorokból ProductsStore formátumú sorokat készít.
 * Exportálva, hogy a ColumnMappingDialog is használhassa.
 * @param {any[][]} dataRows - Nyers adatsorok
 * @param {Object} mapping - Oszlop-leképezés { quality: colIdx, type: colIdx, ... }
 * @param {string} detectedType - Felismert típusnév (opcionális)
 */
export function applyMapping(dataRows, mapping, detectedType = '') {
  const { rows, warnings, warningCells } = convertRows(dataRows, mapping);

  if (detectedType) {
    for (const row of rows) {
      if (!row.type) row.type = detectedType;
    }
  }

  return { rows, warnings, warningCells };
}

/**
 * Nyers 2D tömb feldolgozása: fejléc keresés, mapping, anyaglista detektálás.
 * Közös logika az Excel és PDF importhoz.
 * @param {any[][]} allRows - Nyers adatsorok (2D tömb)
 * @param {string} sourceName - Forrás neve (munkalap vagy fájlnév)
 * @param {string[]} knownTypes - Beállításokban lévő típusnevek
 */
export function importRows(allRows, sourceName, knownTypes = []) {
  const headerIdx = findHeaderRowIndex(allRows);

  if (headerIdx >= 0) {
    const headerRow = allRows[headerIdx];
    const mapping = mapColumnsByHeader(headerRow);
    let dataRows = allRows.slice(headerIdx + 1);
    const detectedType = detectTypeFromTitle(allRows.slice(0, headerIdx), knownTypes);

    const anyaglista = isAnyaglistaFormat(headerRow, dataRows, mapping);
    let detectedCategories = null;
    if (anyaglista) {
      const result = preprocessAnyaglista(dataRows, mapping, knownTypes);
      dataRows = result.rows;
      detectedCategories = result.categories;
    }

    return {
      mapping,
      headerRow: headerRow.map(String),
      dataRows,
      sheetName: sourceName,
      autoDetected: true,
      detectedType: anyaglista ? null : (detectedType || null),
      detectedCategories,
      columnCount: headerRow.length,
    };
  }

  const maxCols = Math.max(...allRows.map((r) => r.length));
  const mapping = maxCols === 5
    ? { quality: 0, type: 1, size: 2, cutLength: 3, quantity: 4 }
    : {};

  return {
    mapping,
    headerRow: null,
    dataRows: allRows,
    sheetName: sourceName,
    autoDetected: maxCols === 5,
    detectedType: null,
    columnCount: maxCols,
  };
}

/**
 * Egy munkalap feldolgozása: automatikus oszlopfelismerés + mapping.
 * @param {Object} wb - XLSX workbook objektum
 * @param {string} sheetName - Munkalap neve
 * @param {string[]} knownTypes - Beállításokban lévő típusnevek (opcionális)
 */
export function importSheet(wb, sheetName, knownTypes = []) {
  const allRows = parseSheet(wb, sheetName);

  const headerIdx = findHeaderRowIndex(allRows);

  if (headerIdx >= 0) {
    const headerRow = allRows[headerIdx];
    const mapping = mapColumnsByHeader(headerRow);
    let dataRows = allRows.slice(headerIdx + 1);
    const detectedType = detectTypeFromTitle(allRows.slice(0, headerIdx), knownTypes);

    // Anyaglista formátum: kategória sorokból típust olvasunk
    const anyaglista = isAnyaglistaFormat(headerRow, dataRows, mapping);
    let detectedCategories = null;
    if (anyaglista) {
      const result = preprocessAnyaglista(dataRows, mapping, knownTypes);
      dataRows = result.rows;
      detectedCategories = result.categories;
    }

    return {
      mapping,
      headerRow: headerRow.map(String),
      dataRows,
      sheetName,
      autoDetected: true,
      detectedType: anyaglista ? null : (detectedType || null),
      detectedCategories,
      columnCount: headerRow.length,
    };
  }

  const maxCols = Math.max(...allRows.map((r) => r.length));
  const mapping = maxCols === 5
    ? { quality: 0, type: 1, size: 2, cutLength: 3, quantity: 4 }
    : {};

  return {
    mapping,
    headerRow: null,
    dataRows: allRows,
    sheetName,
    autoDetected: maxCols === 5,
    detectedType: null,
    columnCount: maxCols,
  };
}
