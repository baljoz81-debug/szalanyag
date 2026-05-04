// F3b/c/d — Szabási terv PDF export.
// Felépítés: fedőlap + anyagonkénti sáv-oldalak + záró anyaglista + minden
// oldalon page-header (oldalszám + projektnév). Azonos szabási minták egy
// sávban "Szál 1-2 (2×)" formában. Roboto Unicode fonttal (magyar ékezet OK).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureRobotoRegistered } from './pdfFonts.js';
import {
  buildExportFilename,
  HEADER as ANYAGLISTA_HEADER,
  buildPdfRows,
  buildPdfSummary,
} from './pdfExport.js';
import {
  groupIdenticalBars,
  formatBarIndices,
  summarizePieces,
} from './cuttingPlanGroups.js';

// Layout konstansok (mm)
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN_X = 12;
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 12;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

const BAR_LABEL_H = 4.5;
const BAR_HEIGHT = 7;
const BAR_PIECES_H = 4.5;
const BAR_GAP = 3;
const BAR_TOTAL_H = BAR_LABEL_H + BAR_HEIGHT + BAR_PIECES_H + BAR_GAP;

const SECTION_TITLE_H = 6;
const SECTION_GAP = 4;

// B&W nyomtató-barát paletta — csak szürkeárnyalatok + mintázatok.
// Megkülönböztetés: darab = közép-szürke tömör; kerf = fehér rés
// (a darabok közé "kihagyott" csík); maradék = halvány háttér + 45°-os csíkozás.
const COLOR_PIECE = [110, 110, 110];       // #6e6e6e közép-szürke, tömör
const COLOR_KERF = [255, 255, 255];        // fehér rés a darabok között
const COLOR_REMAINDER_FILL = [240, 240, 240]; // világos szürke háttér
const COLOR_REMAINDER_HATCH = [110, 110, 110]; // sötétebb csíkozás
const COLOR_FRAME = [40, 40, 40];          // sötét keret (jó kontraszt)
const COLOR_TEXT_PRIMARY = [20, 20, 20];
const COLOR_TEXT_SECONDARY = [90, 90, 90];
const COLOR_ACCENT = [0, 0, 0];            // db-szám → fekete bold (kiemelés)

const round = (n) => Math.round(n);
const fmtMm = (mm) => round(mm).toLocaleString('hu-HU');

// ────────────────────────────────────────────────────────────────────────
// F3d — Fedőlap (1. oldal)
// ────────────────────────────────────────────────────────────────────────

function drawCoverPage(doc, { projectName, setCount, cutLoss, summary, hasContent }) {
  const titleY = PAGE_H * 0.30;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...COLOR_TEXT_PRIMARY);
  doc.text(projectName || 'Szabási terv', PAGE_W / 2, titleY, { align: 'center' });

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_TEXT_SECONDARY);
  doc.text('Szabási terv', PAGE_W / 2, titleY + 10, { align: 'center' });

  const now = new Date();
  const dateStr = now.toLocaleDateString('hu-HU');
  const timeStr = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(11);
  doc.text(`Generálva: ${dateStr} ${timeStr}`, PAGE_W / 2, titleY + 18, { align: 'center' });

  // Összesítő blokk: 110 mm széles középre rendezett blokk, label balra, érték jobbra
  const blockW = 110;
  const blockX = PAGE_W / 2 - blockW / 2;
  const labelX = blockX;
  const valueX = blockX + blockW;
  const startY = titleY + 32;
  const lineH = 7;

  const totalText = summary.totalFullBars > 0
    ? `${summary.totalFullBars} db${summary.totalPartial ? ` + ${summary.totalPartial} részleges` : ''}`
    : '—';
  const utilText = summary.avgUtilizationPct
    ? `${summary.avgUtilizationPct.toLocaleString('hu-HU')}%`
    : '—';

  const stats = [
    ['Anyagcsoportok száma', `${summary.materialTypeCount} db`],
    ['Összes szál', totalText],
    ['Szettek száma', setCount != null ? `${setCount}` : '—'],
    ['Vágási veszteség', `${cutLoss} mm`],
    ['Átl. kihasználtság', utilText],
  ];

  doc.setFontSize(10);
  stats.forEach(([label, value], i) => {
    const yy = startY + i * lineH;
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(...COLOR_TEXT_SECONDARY);
    doc.text(label, labelX, yy);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(...COLOR_TEXT_PRIMARY);
    doc.text(value, valueX, yy, { align: 'right' });
  });

  if (!hasContent) {
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_TEXT_SECONDARY);
    doc.text('Nincs megjeleníthető szabás.', PAGE_W / 2, PAGE_H - 25, { align: 'center' });
  }
}

// ────────────────────────────────────────────────────────────────────────
// F3d — Page-header (minden oldal tetején, utólag rajzolva)
// ────────────────────────────────────────────────────────────────────────

function drawPageHeader(doc, { projectName, pageNum, totalPages }) {
  const y = 6;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_SECONDARY);
  const left = projectName ? `Szálanyag · ${projectName}` : 'Szálanyag — Szabási terv';
  doc.text(left, MARGIN_X, y);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN_X, y, { align: 'right' });
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.15);
  doc.line(MARGIN_X, y + 1.5, PAGE_W - MARGIN_X, y + 1.5);
}

function addPageHeaders(doc, projectName) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawPageHeader(doc, { projectName, pageNum: i, totalPages: total });
  }
}

// ────────────────────────────────────────────────────────────────────────
// F3d — Záró anyaglista (utolsó oldal)
// ────────────────────────────────────────────────────────────────────────

function drawSummarySection(doc, { groups }) {
  doc.addPage();
  const y = MARGIN_TOP;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_TEXT_PRIMARY);
  doc.text('Anyaglista — összesítő', MARGIN_X, y + 4);

  autoTable(doc, {
    head: [ANYAGLISTA_HEADER],
    body: buildPdfRows(groups),
    startY: y + 8,
    margin: { left: MARGIN_X, right: MARGIN_X, top: MARGIN_TOP, bottom: MARGIN_BOTTOM },
    styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 8, cellPadding: 1.5 },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [55, 65, 81], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Egy szakasz címe (anyag-csoport)
// ────────────────────────────────────────────────────────────────────────

function drawSectionTitle(doc, x, y, group) {
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT_PRIMARY);
  const titleParts = [
    group.quality || '(nincs minőség)',
    group.type || '(nincs típus)',
    group.size || '(nincs méret)',
  ];
  doc.text(titleParts.join(' · '), x, y + 4);

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_SECONDARY);
  const utilPct = Math.round(group.avgUtilization * 100);
  const meta = `Szál: ${fmtMm(group.barLength)} mm · ${group.totalBars} szál · ${utilPct}% kihasználtság`;
  doc.text(meta, x + CONTENT_W, y + 4, { align: 'right' });
}

// ────────────────────────────────────────────────────────────────────────
// Egy szabási sáv rajzolása
// ────────────────────────────────────────────────────────────────────────

function drawBar(doc, x, y, w, h, barLength, pieces, cutLoss) {
  if (!Number.isFinite(barLength) || barLength <= 0) return;
  const scale = w / barLength;

  let cursor = 0;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(7);

  pieces.forEach((p, idx) => {
    const len = Number(p?.length) || 0;
    if (len <= 0) return;
    const px = cursor * scale;
    const pw = len * scale;

    doc.setFillColor(...COLOR_PIECE);
    doc.rect(x + px, y, pw, h, 'F');

    if (pw >= 9) {
      doc.setTextColor(255, 255, 255);
      doc.text(fmtMm(len), x + px + pw / 2, y + h / 2 + 0.6, {
        align: 'center', baseline: 'middle',
      });
    }
    cursor += len;

    if (idx < pieces.length - 1 && cutLoss > 0) {
      const kx = cursor * scale;
      // Vizuális minimum 0.9 mm — kis kerf-nél is jól látható fehér rés
      const kw = Math.max(cutLoss * scale, 0.9);
      doc.setFillColor(...COLOR_KERF);
      doc.rect(x + kx, y, kw, h, 'F');
      cursor += cutLoss;
    }
  });

  // Maradék
  const used = cursor;
  const remainder = Math.max(0, barLength - used);
  if (remainder > 0) {
    const rx = used * scale;
    const rw = remainder * scale;
    doc.setFillColor(...COLOR_REMAINDER_FILL);
    doc.rect(x + rx, y, rw, h, 'F');

    // 45°-os csíkozás (klippelve a maradék téglalapra)
    doc.setDrawColor(...COLOR_REMAINDER_HATCH);
    doc.setLineWidth(0.18);
    const step = 1.4;
    const x0 = x + rx;
    const x1 = x + rx + rw;
    for (let off = -h; off < rw; off += step) {
      // ferde vonal: (x0+off, y) → (x0+off+h, y+h)
      const lineX0 = x0 + off;
      const lineX1 = x0 + off + h;
      const lineY0 = y;
      const lineY1 = y + h;
      // Klippelés a [x0, x1] intervallumra
      const a = Math.max(x0, lineX0);
      const b = Math.min(x1, lineX1);
      if (a < b) {
        const ya = lineY0 + (a - lineX0);
        const yb = lineY0 + (b - lineX0);
        doc.line(a, ya, b, yb);
      }
    }

    if (rw >= 12) {
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT_SECONDARY);
      doc.text(fmtMm(remainder), x + rx + rw / 2, y + h / 2 + 0.6, {
        align: 'center', baseline: 'middle',
      });
    }
  }

  // Külső keret
  doc.setDrawColor(...COLOR_FRAME);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'S');
}

// ────────────────────────────────────────────────────────────────────────
// Sáv felett-alatt feliratok
// ────────────────────────────────────────────────────────────────────────

function drawBarLabel(doc, x, y, planGroup, barLength) {
  const count = planGroup.indices.length;
  const range = formatBarIndices(planGroup.indices);
  const label = count > 1 ? `Szál ${range} (${count}×)` : `Szál ${range}`;
  const bar = planGroup.representative;

  // usedLength rekonstrukció: cutLoss-szal együtt
  // — a binPacking adta meg, vegyük át (vagy számoljuk a darab-listából)
  const usedMm = Number(bar?.usedLength) || 0;
  const remainderMm = Math.max(0, barLength - usedMm);

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_PRIMARY);
  doc.text(label, x, y + 3);

  doc.setFont('Roboto', 'normal');
  doc.setTextColor(...COLOR_TEXT_SECONDARY);
  const right = `kihasználva: ${fmtMm(usedMm)} mm${remainderMm > 0 ? ` · maradék: ${fmtMm(remainderMm)} mm` : ''}`;
  doc.text(right, x + CONTENT_W, y + 3, { align: 'right' });
}

function drawPiecesSummary(doc, x, y, pieces) {
  const summary = summarizePieces(pieces);
  if (summary.length === 0) return;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);

  let cursorX = x;
  const SPACING = 3;
  for (const { length, count } of summary) {
    // hossz fekete
    doc.setTextColor(...COLOR_TEXT_PRIMARY);
    const lenStr = fmtMm(length);
    doc.text(lenStr, cursorX, y + 3);
    const lenW = doc.getTextWidth(lenStr);

    // ×N db
    doc.setTextColor(...COLOR_TEXT_SECONDARY);
    const xStr = '×';
    doc.text(xStr, cursorX + lenW, y + 3);
    const xW = doc.getTextWidth(xStr);

    doc.setTextColor(...COLOR_ACCENT);
    doc.setFont('Roboto', 'bold');
    const cntStr = `${count} db`;
    doc.text(cntStr, cursorX + lenW + xW, y + 3);
    const cntW = doc.getTextWidth(cntStr);
    doc.setFont('Roboto', 'normal');

    cursorX += lenW + xW + cntW + SPACING;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Fő export
// ────────────────────────────────────────────────────────────────────────

export async function buildCuttingPlanPdf({ groups = [], cutLoss = 0, projectName = '', setCount } = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await ensureRobotoRegistered(doc);

  const renderableGroups = (groups || []).filter((g) => g.totalBars > 0);
  const summary = buildPdfSummary(groups);

  // 1. Fedőlap
  drawCoverPage(doc, {
    projectName,
    setCount,
    cutLoss,
    summary,
    hasContent: renderableGroups.length > 0,
  });

  if (renderableGroups.length === 0) {
    addPageHeaders(doc, projectName);
    return doc;
  }

  // 2. Tartalom oldalak — anyagonkénti sávok
  doc.addPage();
  let y = MARGIN_TOP;
  const pageBottom = PAGE_H - MARGIN_BOTTOM;

  for (const g of renderableGroups) {
    const planGroups = groupIdenticalBars(g.bars);

    if (y + SECTION_TITLE_H + BAR_TOTAL_H > pageBottom) {
      doc.addPage();
      y = MARGIN_TOP;
    }
    drawSectionTitle(doc, MARGIN_X, y, g);
    y += SECTION_TITLE_H;

    for (const pg of planGroups) {
      if (y + BAR_TOTAL_H > pageBottom) {
        doc.addPage();
        y = MARGIN_TOP;
      }
      drawBarLabel(doc, MARGIN_X, y, pg, g.barLength);
      y += BAR_LABEL_H;
      drawBar(doc, MARGIN_X, y, CONTENT_W, BAR_HEIGHT, g.barLength, pg.representative.pieces, cutLoss);
      y += BAR_HEIGHT;
      drawPiecesSummary(doc, MARGIN_X, y, pg.representative.pieces);
      y += BAR_PIECES_H + BAR_GAP;
    }

    y += SECTION_GAP;
  }

  // 3. Záró anyaglista (új oldal)
  drawSummarySection(doc, { groups });

  // 4. Page-header minden oldalra (most már tudjuk a totalPages-t)
  addPageHeaders(doc, projectName);

  return doc;
}

export async function exportCuttingPlanToPdf({ groups, cutLoss, projectName = '', setCount, filename, date } = {}) {
  const doc = await buildCuttingPlanPdf({ groups, cutLoss, projectName, setCount });
  const name = filename || buildExportFilename({
    prefix: 'szabasi_terv',
    projectName,
    ext: 'pdf',
    date: date || new Date(),
  });
  doc.save(name);
  return name;
}
