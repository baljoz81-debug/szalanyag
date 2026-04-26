// PDF import — P10: pdfjs-dist alapú szövegkinyerés és táblázatépítés
import * as pdfjsLib from 'pdfjs-dist';
import { detectTypeFromTitle, mapColumnsByHeader } from './excelImport';

// Worker beállítása (Vite bundler-hez)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

/**
 * PDF fájl megnyitása ArrayBuffer-ből.
 */
export async function openPdf(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  return { doc, numPages: doc.numPages };
}

/**
 * Egy oldal szöveges tartalmának kinyerése.
 */
async function extractPageItems(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const items = content.items
    .filter((item) => item.str.trim() !== '')
    .filter((item) => !/^\d+\s*\/\s*\d+/.test(item.str.trim())) // oldalszám kiszűrése
    .map((item) => ({
      str: item.str,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      width: Math.round(item.width),
    }));

  return { items, pageWidth: viewport.width, pageHeight: viewport.height };
}

// ─── Y csoportosítás ────────────────────────────────────────────────────

function clusterYValues(items, tolerance = 4) {
  const yValues = [...new Set(items.map((it) => it.y))].sort((a, b) => b - a);
  const clusters = [];

  for (const y of yValues) {
    const existing = clusters.find((c) => Math.abs(c.representative - y) <= tolerance);
    if (existing) {
      existing.yMin = Math.min(existing.yMin, y);
      existing.yMax = Math.max(existing.yMax, y);
      existing.representative = Math.round((existing.yMin + existing.yMax) / 2);
    } else {
      clusters.push({ representative: y, yMin: y, yMax: y });
    }
  }

  return clusters.sort((a, b) => b.representative - a.representative);
}

function assignItemsToRows(items, yClusters, tolerance = 4) {
  const rowMap = new Map();
  for (const cluster of yClusters) {
    rowMap.set(cluster.representative, []);
  }
  for (const item of items) {
    const cluster = yClusters.find(
      (c) => item.y >= c.yMin - tolerance && item.y <= c.yMax + tolerance,
    );
    if (cluster) {
      rowMap.get(cluster.representative).push(item);
    }
  }
  return rowMap;
}

// ─── Transzponált tábla felismerés ──────────────────────────────────────

const TRANSPOSED_LABELS = {
  'méret': 'size', 'meret': 'size', 'átmérő': 'size', 'atmero': 'size', 'átm': 'size',
  'x': 'size',
  'y': 'size2',
  's': 'size3', 'lv': 'size3', 'falv': 'size3',
  'hossz': 'cutLength', 'length': 'cutLength', 'l': 'cutLength',
  'db': 'quantity', 'darabszám': 'quantity', 'darabszam': 'quantity',
  'rajzsz': '_rajzszam', 'rajzszám': '_rajzszam', 'rajzszam': '_rajzszam',
  'megnevezés': '_megnevezes', 'megnevezes': '_megnevezes',
  'anyag': '_anyag',
  'poz': '_pozszam',
  'megjegyzés': '_megjegyzes', 'megjegyzes': '_megjegyzes',
};

/**
 * Ellenőrzi, hogy egy cella ismert mező-címke-e.
 * Visszaadja a mező kulcsot, vagy null-t.
 */
const LABEL_BLACKLIST = ['anyaglista', 'oldal', 'összesen', 'osszesen', 'teljes'];

function matchLabel(str) {
  const lower = str.toLowerCase().trim();
  const firstWord = lower.split(/[\s(.]/)[0];
  if (!firstWord) return null;
  if (LABEL_BLACKLIST.some((bl) => firstWord.includes(bl))) return null;

  // Egybetűs címkéknél csak pontos egyezés (x, y, s, l)
  if (firstWord.length === 1) {
    return TRANSPOSED_LABELS[firstWord] || null;
  }

  for (const [label, field] of Object.entries(TRANSPOSED_LABELS)) {
    if (label.length === 1) continue; // egybetűs labelek csak pontos egyezésre (fent kezelve)
    if (firstWord === label || firstWord.startsWith(label) || (label.startsWith(firstWord) && firstWord.length >= 2)) {
      return field;
    }
  }
  return null;
}

/**
 * Felismeri a transzponált (szabásjegyzék) elrendezést a nyers item-ekből.
 * Feltétel: legalább 2 ismert mező-címke a sorok bal szélén.
 */
/**
 * Felismeri a transzponált elrendezést: sorok bal szélén ismert mező-címkék.
 */
function detectTransposedLayout(rowMap) {
  let labelCount = 0;

  for (const [, rowItems] of rowMap) {
    if (rowItems.length === 0) continue;
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    if (matchLabel(first.str)) labelCount++;
  }

  return labelCount >= 2;
}

/**
 * A címkék X pozíciójából számítja a label/data határt.
 */
function computeLabelXThreshold(rowMap) {
  let maxLabelX = 0;
  for (const [, rowItems] of rowMap) {
    if (rowItems.length === 0) continue;
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    if (matchLabel(first.str) && first.x > maxLabelX) {
      maxLabelX = first.x;
    }
  }
  return maxLabelX + 10;
}

// ─── Cím sorok kinyerése (típus detektáláshoz) ─────────────────────────

/**
 * Cím sorok kinyerése a rowMap-ből — a felső sorok, amelyek a tábla címét
 * tartalmazzák (pl. "Laposvas szabásjegyzék"). Megáll az első felismert
 * mező-címke sornál. Ugyanaz a logika, mint az Excel importban a
 * detectTypeFromTitle: a fejléc előtti sorokat vizsgáljuk.
 */
function extractTitleRows(rowMap) {
  const TITLE_KEYWORDS = ['szabásjegyzék', 'szabasjegyzek', 'anyaglista'];

  // 1. Sidebar cím detektálás: függőleges szöveg a bal margón (x < labels)
  //    A PDF-ben a cím szöveg széteshet több sorra (pl. "Cs" + "ő" + "anyaglista")
  let minLabelX = Infinity;
  for (const [, rowItems] of rowMap) {
    if (rowItems.length === 0) continue;
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    if (matchLabel(sorted[0].str) && sorted[0].x < minLabelX) {
      minLabelX = sorted[0].x;
    }
  }

  if (minLabelX < Infinity) {
    const sidebarItems = [];
    for (const [, rowItems] of rowMap) {
      for (const item of rowItems) {
        if (item.x < minLabelX - 5) {
          sidebarItems.push(item);
        }
      }
    }
    if (sidebarItems.length > 0) {
      // Y növekvő sorrend (alulról felfelé = a függőleges szöveg olvasási iránya)
      sidebarItems.sort((a, b) => a.y - b.y);
      const sidebarText = sidebarItems.map((it) => it.str.trim()).join('');
      if (TITLE_KEYWORDS.some((kw) => sidebarText.toLowerCase().includes(kw))) {
        return [[sidebarText]];
      }
    }
  }

  // 2. Hagyományos cím keresés (nem sidebar esetén)
  const titleRows = [];

  for (const [, rowItems] of rowMap) {
    if (rowItems.length === 0) continue;
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    const first = sorted[0];

    // Címke sorok átugrása (nem break — a cím bárhol lehet a PDF-ben)
    if (matchLabel(first.str)) continue;

    // Ellenőrizzük, hogy az első elem tartalmaz-e cím kulcsszót
    const firstLower = first.str.toLowerCase().trim();
    const hasTitleKeyword = TITLE_KEYWORDS.some((kw) => firstLower.includes(kw));

    if (hasTitleKeyword) {
      // Cím kulcsszó → csak az első elemet vesszük (a többi adat lehet)
      titleRows.push([first.str.trim()]);
      continue;
    }

    // Csak 1-2 elemes sorok lehetnek címek (sok elem = adatsor)
    if (sorted.length > 2) continue;

    const text = sorted.map((it) => it.str.trim()).join(' ');

    // Rövid töredékek kihagyása (PDF szétdarabolási artefaktumok)
    if (text.length < 3) continue;

    // Tisztán szám/méret sorok kihagyása
    if (/^[\d.,x×\s/]+$/.test(text)) continue;

    // "Oldal N" oldalszám sorok kihagyása
    if (/^oldal\s+\d+$/i.test(text)) continue;

    titleRows.push(sorted.map((it) => it.str.trim()));
  }

  // Max 5 sor — a findHeaderRowIndex keresési ablaka 5, de a fejléc a
  // transzponált tábla buildTransposedTable-ből jön, nem a titleRows-ból
  return titleRows.slice(0, 5);
}

// ─── Transzponált tábla építés ──────────────────────────────────────────

/**
 * Szabásjegyzék PDF-ek feldolgozása.
 *
 * Stratégia:
 * 1. Megkeressük a mező-címke sorokat (Méret, Hossz, DB stb.)
 * 2. Minden címkéhez hozzárendeljük az adatokat: azonos Y-on lévő elemek
 *    és a Y tartományban (címke Y ... következő címke Y) lévő elemek
 * 3. Az adatelemek X pozíciója azonosítja, melyik termék-oszlopba tartoznak
 * 4. Transzponálva visszaadjuk: sorok = termékek, oszlopok = mezők
 */
function buildTransposedTable(rowMap) {
  const labelXThreshold = computeLabelXThreshold(rowMap);

  // 1. Címke-sorok keresése (Y növekvő sorrendben — alulról felfelé)
  const labelInfos = []; // [{ yKey, field, labelStr }]
  const allYKeys = [...rowMap.keys()].sort((a, b) => a - b); // alulról felfelé

  for (const yKey of allYKeys) {
    const rowItems = rowMap.get(yKey);
    if (rowItems.length === 0) continue;
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    if (first.x >= labelXThreshold) continue;
    const field = matchLabel(first.str);
    if (field) {
      labelInfos.push({ yKey, field, labelStr: first.str });
    }
  }

  if (labelInfos.length === 0) return [];

  // 2. Minden címkéhez adatgyűjtés: a címke Y-tól a következő címke Y-ig
  //    (vagy az oldal tetejéig, ha nincs következő)
  const fieldData = new Map(); // field → [{ x, value }]
  const productXPositions = new Set();

  for (let i = 0; i < labelInfos.length; i++) {
    const current = labelInfos[i];
    const nextY = (i + 1 < labelInfos.length) ? labelInfos[i + 1].yKey : Infinity;
    const dataItems = [];

    // Minden sor a [current.yKey, nextY) tartományban
    for (const yKey of allYKeys) {
      if (yKey < current.yKey) continue;
      if (yKey >= nextY) break;

      const rowItems = rowMap.get(yKey);
      for (const item of rowItems) {
        // Csak a jobb oldali elemek (x >= threshold) az adatok
        if (item.x >= labelXThreshold) {
          dataItems.push({ x: item.x, value: item.str.trim() });
          productXPositions.add(item.x);
        }
      }
    }

    fieldData.set(current.field, dataItems);
  }

  // 3. X pozíciók klaszterezése (termék-oszlopok)
  const xList = [...productXPositions].sort((a, b) => a - b);
  const xClusters = [];
  for (const x of xList) {
    const existing = xClusters.find((c) => Math.abs(c.rep - x) <= 5);
    if (existing) {
      existing.positions.push(x);
      existing.rep = Math.round(existing.positions.reduce((a, b) => a + b, 0) / existing.positions.length);
    } else {
      xClusters.push({ rep: x, positions: [x] });
    }
  }
  xClusters.sort((a, b) => a.rep - b.rep);

  if (xClusters.length === 0) return [];

  // 4. Header sor: mező-nevek
  //    Mezőket a felhasználó számára hasznos sorrendben adjuk meg
  const fieldOrder = ['_pozszam', '_megnevezes', '_anyag', 'size', 'size2', 'size3', 'cutLength', 'quantity', '_rajzszam', '_megjegyzes'];
  const usedFields = fieldOrder.filter((f) => fieldData.has(f));

  // Fejléc készítése a label szövegekből
  const headerLabelMap = {};
  for (const info of labelInfos) {
    headerLabelMap[info.field] = info.labelStr;
  }

  const headerRow = usedFields.map((f) => headerLabelMap[f] || f);

  // 5. Táblázat építés: sorok = termékek (X klaszterek), oszlopok = mezők
  const table = [headerRow];

  for (const xCluster of xClusters) {
    const row = usedFields.map((field) => {
      const items = fieldData.get(field) || [];
      // Megkeressük az ehhez az X klaszterhez tartozó értéket
      const match = items.find((it) => xCluster.positions.some((p) => Math.abs(p - it.x) <= 5));
      return match ? match.value : '';
    });

    // Csak akkor adjuk hozzá, ha van érdemi adat
    const hasData = row.some((cell) => cell && cell.trim());
    if (hasData) table.push(row);
  }

  return table;
}

// ─── Normál tábla építés (anyaglista PDF-ek) ────────────────────────────

function detectColumnBoundaries(items, minGap = 15) {
  const xPositions = items.map((it) => it.x).sort((a, b) => a - b);
  if (xPositions.length === 0) return [];

  const clusters = [];
  let cur = { min: xPositions[0], max: xPositions[0] };

  for (let i = 1; i < xPositions.length; i++) {
    if (xPositions[i] - cur.max <= minGap) {
      cur.max = xPositions[i];
    } else {
      clusters.push(cur);
      cur = { min: xPositions[i], max: xPositions[i] };
    }
  }
  clusters.push(cur);

  return clusters;
}

function buildRowCells(rowItems, columnBoundaries) {
  const cells = columnBoundaries.map(() => '');

  for (const item of rowItems) {
    let bestCol = 0;
    let bestDist = Infinity;

    for (let c = 0; c < columnBoundaries.length; c++) {
      const cb = columnBoundaries[c];
      let dist;
      if (item.x >= cb.min && item.x <= cb.max) {
        dist = 0;
      } else {
        dist = Math.min(Math.abs(item.x - cb.min), Math.abs(item.x - cb.max));
      }
      if (dist < bestDist) {
        bestDist = dist;
        bestCol = c;
      }
    }

    if (cells[bestCol]) {
      cells[bestCol] += item.str;
    } else {
      cells[bestCol] = item.str;
    }
  }

  return cells;
}

function buildNormalTable(rowMap, items) {
  const columnBoundaries = detectColumnBoundaries(items);
  if (columnBoundaries.length === 0) return [];

  const table = [];
  for (const [, rowItems] of rowMap) {
    if (rowItems.length === 0) continue;
    rowItems.sort((a, b) => a.x - b.x);
    const cells = buildRowCells(rowItems, columnBoundaries);
    table.push(cells);
  }

  return table;
}

// ─── Szűrés ─────────────────────────────────────────────────────────────

function filterHeaderFooterRows(table) {
  return table.filter((row) => {
    const fullText = row.join(' ').trim().toLowerCase();
    if (/^\d+\s*\/\s*\d+\.?\s*oldal$/i.test(fullText)) return false;
    if (/^\d+\s*\/\s*\d+$/i.test(fullText)) return false;
    if (!fullText) return false;
    return true;
  });
}

// ─── Fő export: oldalak feldolgozása ────────────────────────────────────

/**
 * Egy PDF oldal szöveges tartalmát 2D tömbbé alakítja.
 */
export async function extractPageAsTable(doc, pageNum) {
  const { items } = await extractPageItems(doc, pageNum);

  if (items.length === 0) {
    return { rows: [], isTransposed: false };
  }

  const yClusters = clusterYValues(items);
  const rowMap = assignItemsToRows(items, yClusters);

  const isTransposed = detectTransposedLayout(rowMap);

  // Cím sorok kinyerése a nyers rowMap-ből (pl. "Laposvas szabásjegyzék")
  // A buildNormalTable az oszlophatárokkal széttörheti a cím szövegét,
  // ezért a nyers item-ekből kell kiolvasni és visszahelyettesíteni.
  const titleRows = extractTitleRows(rowMap);

  let table;
  if (isTransposed) {
    table = [...titleRows, ...buildTransposedTable(rowMap)];
  } else {
    table = buildNormalTable(rowMap, items);
    // A normál tábla első N sora a cím sorok hibásan feldarabolva —
    // cseréljük a nyers, helyes cím sorokra
    if (titleRows.length > 0) {
      table = [...titleRows, ...table.slice(titleRows.length)];
    }
  }

  table = filterHeaderFooterRows(table);

  return { rows: table, isTransposed };
}

/**
 * Több oldalról kinyert táblákat összefűzi.
 * Ha egy oldalon van fejléc, azt felismeri; ha nincs, az előző struktúrát folytatja.
 */
export async function extractPagesAsTable(doc, pageNumbers, knownTypes = []) {
  // Először minden oldalt kinyerünk
  const pageExtracts = [];
  for (const pageNum of pageNumbers) {
    const result = await extractPageAsTable(doc, pageNum);
    pageExtracts.push({ pageNum, ...result });
  }

  // Megszámoljuk hány oldalon van saját fejléc
  const pagesWithHeaders = pageExtracts.filter(
    (p) => p.rows.length > 0 && findHeaderInRows(p.rows) >= 0,
  );

  // Ha legfeljebb 1 oldalnak van fejléce → eredeti viselkedés (egyetlen mapping)
  if (pagesWithHeaders.length <= 1) {
    return combinePagesSingleMapping(pageExtracts, knownTypes);
  }

  // Több különböző fejléc → oldalanként normalizálunk egységes formátumra
  return combinePagesNormalized(pageExtracts, knownTypes);
}

/**
 * Eredeti viselkedés: egyetlen fejléc/mapping, oldalankénti típus detektálással.
 */
function combinePagesSingleMapping(pageExtracts, knownTypes) {
  let combinedRows = [];
  let firstPageTransposed = false;

  for (const { rows, isTransposed } of pageExtracts) {
    if (rows.length === 0) continue;

    const headerIdx = findHeaderInRows(rows);
    const titleRows = headerIdx >= 0 ? rows.slice(0, headerIdx) : [];
    const pageType = detectTypeFromTitle(titleRows, knownTypes);

    if (combinedRows.length === 0) {
      firstPageTransposed = isTransposed;
      const dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;
      for (let j = dataStart; j < rows.length; j++) {
        rows[j]._pageType = pageType;
      }
      combinedRows = [...rows];
    } else {
      if (headerIdx >= 0) {
        const dataRows = rows.slice(headerIdx + 1);
        for (const row of dataRows) row._pageType = pageType;
        combinedRows.push(...dataRows);
      } else {
        for (const row of rows) row._pageType = pageType;
        combinedRows.push(...rows);
      }
    }
  }

  return { allRows: combinedRows, isTransposed: firstPageTransposed };
}

/**
 * Normalizált összefűzés: minden oldalt saját fejlécével értelmez,
 * majd egységes [Típus, Méret, Szabási hossz, Db.] formátumba konvertál.
 */
function combinePagesNormalized(pageExtracts, knownTypes) {
  const STANDARD_HEADER = ['Típus', 'Méret', 'Szabási hossz', 'Db.'];
  const normalizedRows = [];
  let firstPageTransposed = false;
  let lastMapping = null;

  for (const { rows, isTransposed } of pageExtracts) {
    if (rows.length === 0) continue;
    if (normalizedRows.length === 0) firstPageTransposed = isTransposed;

    const headerIdx = findHeaderInRows(rows);
    const titleRows = headerIdx >= 0 ? rows.slice(0, headerIdx) : [];
    const pageType = detectTypeFromTitle(titleRows, knownTypes);

    let mapping, dataRows;
    if (headerIdx >= 0) {
      mapping = mapColumnsByHeader(rows[headerIdx]);
      dataRows = rows.slice(headerIdx + 1);
      lastMapping = mapping;
    } else {
      // Folytatólagos oldal — előző oldal mappingját használjuk
      mapping = lastMapping || {};
      dataRows = rows;
    }

    for (const row of dataRows) {
      const getValue = (field) => {
        if (mapping[field] === undefined) return '';
        const val = row[mapping[field]];
        return val !== undefined && val !== null ? String(val).trim() : '';
      };

      const sizeParts = [getValue('size'), getValue('size2'), getValue('size3')].filter(Boolean);
      normalizedRows.push([
        pageType || '',
        sizeParts.join('x'),
        getValue('cutLength'),
        getValue('quantity'),
      ]);
    }
  }

  if (normalizedRows.length === 0) {
    return { allRows: [], isTransposed: firstPageTransposed };
  }

  return {
    allRows: [STANDARD_HEADER, ...normalizedRows],
    isTransposed: firstPageTransposed,
  };
}

// ─── Fejléc detektálás ──────────────────────────────────────────────────

const COLUMN_PATTERNS = {
  quality:   ['anyagminőség', 'anyagminoseg', 'minőség', 'minoseg', 'quality', 'anyag'],
  type:      ['típus', 'tipus', 'type', 'anyagtípus', 'szelvény', 'szelveny'],
  size:      ['méret', 'meret', 'size', 'átmérő', 'atmero', 'profil', 'dimenzió', 'magasság', 'magassag', 'height', 'x'],
  size2:     ['szélesség', 'szelesseg', 'width', 'b', 'y'],
  size3:     ['falvastagság', 'falvastagsag', 'falv.', 'vastagság', 'vastagsag', 'wall', 'thickness', 's'],
  cutLength: ['hossz', 'szabási hossz', 'szabási', 'szabasi', 'length', 'hossz (mm)', 'hossz(mm)', 'l'],
  quantity:  ['darabszám', 'darabszam', 'mennyiség', 'mennyiseg', 'quantity', 'pcs', 'db', 'db.'],
};

const COLUMN_BLACKLIST = ['rajzszám', 'rajzszam', 'megnevezés', 'megnevezes', 'megjegyzés', 'megjegyzes', 'jel', 'szám', 'szam', 'sorszám', 'sorszam', 'felület', 'felulet', 'átvette', 'atvette', 'dátum', 'datum', 'tömeg', 'tomeg'];

function matchPattern(cellStr, pattern) {
  if (pattern.length <= 2) {
    if (cellStr === pattern) return true;
    return cellStr.startsWith(pattern) && /^[\s(.)]/.test(cellStr.slice(pattern.length));
  }
  if (cellStr.includes(pattern)) return true;
  // Csonkolt szöveg kezelése (pl. PDF: "átmér" → "átmérő")
  if (cellStr.length >= 4 && pattern.startsWith(cellStr)) return true;
  return false;
}

function scoreRow(row) {
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
  return score;
}

function findHeaderInRows(rows) {
  let bestIndex = -1;
  let bestScore = 0;
  const searchLimit = Math.min(rows.length, 5);

  for (let i = 0; i < searchLimit; i++) {
    const s = scoreRow(rows[i]);
    if (s > bestScore) {
      bestScore = s;
      bestIndex = i;
    }
  }

  return bestScore >= 2 ? bestIndex : -1;
}

/**
 * Fájlnév validálás
 */
export function validatePdfFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ext === 'pdf';
}
