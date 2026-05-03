// F3b/c — Szabási terv PDF export.
// Anyagonként szakasz: cím + sávok + tömör darab-lista. Azonos szabási minták
// egy sávban "Szál 1-2 (2×)" formában. Roboto Unicode fonttal (magyar ékezet OK).
import { jsPDF } from 'jspdf';
import { ensureRobotoRegistered } from './pdfFonts.js';
import { buildExportFilename } from './pdfExport.js';
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

const COLOR_PIECE = [37, 99, 235];     // #2563eb
const COLOR_KERF = [249, 115, 22];     // #f97316
const COLOR_REMAINDER_FILL = [229, 231, 235]; // #e5e7eb
const COLOR_REMAINDER_HATCH = [180, 180, 180];
const COLOR_FRAME = [120, 120, 120];
const COLOR_TEXT_PRIMARY = [20, 20, 20];
const COLOR_TEXT_SECONDARY = [100, 100, 100];
const COLOR_ACCENT = [234, 88, 12];    // #ea580c

const round = (n) => Math.round(n);
const fmtMm = (mm) => round(mm).toLocaleString('hu-HU');

// ────────────────────────────────────────────────────────────────────────
// Header (első oldal)
// ────────────────────────────────────────────────────────────────────────

function drawHeader(doc, { projectName, setCount, cutLoss, groups }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('hu-HU');
  const timeStr = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_TEXT_PRIMARY);
  doc.text(projectName || 'Szabási terv', MARGIN_X, MARGIN_TOP + 2);

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT_SECONDARY);
  let subY = MARGIN_TOP + 7;
  doc.text(`Generálva: ${dateStr} ${timeStr}`, MARGIN_X, subY);

  if (projectName) {
    subY += 4;
    doc.text('Szabási terv', MARGIN_X, subY);
  }

  // Összefoglaló sor
  let totalBars = 0;
  let materialCount = 0;
  for (const g of groups ?? []) {
    if (g.totalBars > 0) {
      totalBars += g.totalBars;
      materialCount += 1;
    }
  }
  const parts = [
    `${materialCount} anyagcsoport`,
    `${totalBars} szál`,
  ];
  if (setCount != null) parts.push(`Szettek: ${setCount}`);
  if (cutLoss != null)  parts.push(`Vágási veszteség: ${cutLoss} mm`);
  subY += 4;
  doc.text(parts.join(' · '), MARGIN_X, subY);

  return subY + 5; // következő blokk Y pozíciója
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
      const kw = Math.max(cutLoss * scale, 0.25);
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

  let y = drawHeader(doc, { projectName, setCount, cutLoss, groups });

  const renderableGroups = (groups || []).filter((g) => g.totalBars > 0);
  if (renderableGroups.length === 0) {
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_TEXT_SECONDARY);
    doc.text('Nincs megjeleníthető szabás.', MARGIN_X, y + 6);
    return doc;
  }

  const pageBottom = PAGE_H - MARGIN_BOTTOM;

  for (const g of renderableGroups) {
    const planGroups = groupIdenticalBars(g.bars);

    // Szakasz cím — ha nincs hely az első sávhoz, oldaltörés
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
