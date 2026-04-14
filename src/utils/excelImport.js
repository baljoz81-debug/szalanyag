// Excel/CSV import — P7+P8: fájl beolvasás + automatikus oszlopazonosítás
import * as XLSX from 'xlsx';

// Oszlop-kulcsszavak az automatikus felismeréshez (kis-nagybetű érzéketlen)
const COLUMN_PATTERNS = {
  quality:   ['anyagminőség', 'anyagminoseg', 'minőség', 'minoseg', 'quality'],
  type:      ['típus', 'tipus', 'type', 'anyagtípus'],
  size:      ['méret', 'meret', 'size', 'átmérő', 'atmero', 'profil', 'dimenzió'],
  cutLength: ['hossz', 'szabási hossz', 'szabási', 'szabasi', 'length', 'hossz (mm)', 'hossz(mm)'],
  quantity:  ['darabszám', 'darabszam', 'db', 'mennyiség', 'mennyiseg', 'quantity', 'pcs'],
};

/**
 * Elfogadott fájl kiterjesztés ellenőrzése
 */
export function validateFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ['xlsx', 'xls', 'csv'].includes(ext);
}

/**
 * Excel/CSV fájl beolvasása ArrayBuffer-ből
 * Visszaadja: { headers: string[], dataRows: any[][], sheetName: string }
 */
export function parseWorkbook(arrayBuffer, fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  if (!wb.SheetNames.length) {
    throw new Error('A fájl nem tartalmaz munkalapot.');
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (allRows.length === 0) {
    throw new Error('A munkalap üres.');
  }

  return { allRows, sheetName };
}

/**
 * Fejléc-sor keresése: megkeresi azt a sort, amelyik a legtöbb oszlopnevet tartalmazza.
 * Visszaadja a fejléc sor indexét, vagy -1 ha nem találtunk fejlécet.
 */
function findHeaderRowIndex(allRows) {
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

      for (const patterns of Object.values(COLUMN_PATTERNS)) {
        if (patterns.some((p) => cellStr.includes(p))) {
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
function mapColumnsByHeader(headerRow) {
  const mapping = {};

  headerRow.forEach((cell, colIdx) => {
    const cellStr = String(cell).toLowerCase().trim();
    if (!cellStr) return;

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (mapping[field] !== undefined) continue; // már megvan
      if (patterns.some((p) => cellStr.includes(p))) {
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
 * Sorok konvertálása a ProductsStore formátumra a mapping alapján.
 */
function convertRows(dataRows, mapping) {
  return dataRows.filter(isDataRow).map((row) => {
    const getValue = (field) => {
      if (mapping[field] === undefined) return '';
      const val = row[mapping[field]];
      return val !== undefined && val !== null ? String(val).trim() : '';
    };

    const cutLengthRaw = getValue('cutLength');
    const quantityRaw = getValue('quantity');

    return {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      quality: getValue('quality') || 'S235',
      type: getValue('type'),
      size: getValue('size'),
      cutLength: cutLengthRaw ? (parseInt(cutLengthRaw, 10) || '') : '',
      quantity: quantityRaw ? (parseInt(quantityRaw, 10) || '') : '',
    };
  }).filter((row) => row.size || row.cutLength || row.quantity);
}

/**
 * Típusnév kinyerése a cím sorból (fejléc előtti sorok).
 * A beállításokban lévő típusnevekkel próbálja egyeztetni prefix alapján.
 * Pl. "Köracél szabásjegyzék" → "Köranyag" (ha "Kör" prefix egyezik)
 *     "Laposvas szabásjegyzék" → "Laposacél" (ha "Lapos" prefix egyezik)
 */
function detectTypeFromTitle(titleRows, knownTypes) {
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
 * Fő import funkció: beolvas és automatikusan leképezi az oszlopokat.
 * @param {ArrayBuffer} arrayBuffer - A fájl tartalma
 * @param {string} fileName - A fájl neve
 * @param {string[]} knownTypes - Beállításokban lévő típusnevek (opcionális)
 */
export function importExcel(arrayBuffer, fileName, knownTypes = []) {
  const { allRows, sheetName } = parseWorkbook(arrayBuffer, fileName);

  const headerIdx = findHeaderRowIndex(allRows);

  if (headerIdx >= 0) {
    // Fejléc alapú automatikus leképezés
    const headerRow = allRows[headerIdx];
    const mapping = mapColumnsByHeader(headerRow);
    const dataRows = allRows.slice(headerIdx + 1);

    // Típus kinyerése a fejléc előtti cím sorokból
    const detectedType = detectTypeFromTitle(allRows.slice(0, headerIdx), knownTypes);

    const rows = convertRows(dataRows, mapping);

    // Ha találtunk típust a címből és az oszlopokból nem jött típus, beállítjuk
    if (detectedType) {
      for (const row of rows) {
        if (!row.type) row.type = detectedType;
      }
    }

    if (rows.length === 0) {
      throw new Error('A fájl nem tartalmaz feldolgozható adatsorokat.');
    }

    return {
      rows,
      mapping,
      headerRow: headerRow.map(String),
      sheetName,
      autoDetected: true,
      totalParsed: rows.length,
      detectedType: detectedType || null,
    };
  }

  // Nincs fejléc felismerve — ha pontosan 5 oszlop, pozíció alapján próbáljuk
  const maxCols = Math.max(...allRows.map((r) => r.length));
  if (maxCols === 5) {
    const mapping = { quality: 0, type: 1, size: 2, cutLength: 3, quantity: 4 };
    const rows = convertRows(allRows, mapping);

    if (rows.length === 0) {
      throw new Error('A fájl nem tartalmaz feldolgozható adatsorokat.');
    }

    return {
      rows,
      mapping,
      headerRow: null,
      sheetName,
      autoDetected: true,
      totalParsed: rows.length,
    };
  }

  // Nem sikerült automatikusan felismerni
  throw new Error(
    'Nem sikerült automatikusan felismerni az oszlopokat. ' +
    'Kérlek ellenőrizd, hogy a fájl tartalmaz-e fejlécsort (pl. Méret, Hossz, DB).'
  );
}
