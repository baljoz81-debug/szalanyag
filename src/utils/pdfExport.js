// Kalkuláció PDF export — jsPDF + autoTable + Roboto Unicode font
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureRobotoRegistered } from './pdfFonts.js';

export const HEADER = [
  'Anyagminőség',
  'Típus',
  'Méret',
  'Szálhossz (mm)',
  'Szükséges anyagmennyiség (m)',
  'Szükséges teljes szálak (db)',
  'Utolsó szál (m)',
  'Maradék (mm)',
  'Kihasználtság (%)',
];

const dateStamp = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

// Filename slug: ékezet-eltávolítás + nem alfanumerikus → "_", max 40 char
export function slugifyProjectName(name) {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function buildExportFilename({ prefix = 'szalanyag_export', projectName, ext, date } = {}) {
  const slug = slugifyProjectName(projectName);
  const stamp = dateStamp(date);
  return slug ? `${slug}_${prefix}_${stamp}.${ext}` : `${prefix}_${stamp}.${ext}`;
}

const round1 = (n) => Math.round(n * 10) / 10;
const fmt1 = (n) => round1(n).toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function buildPdfRows(groups) {
  return (groups ?? []).map((g) => {
    const d = g.displayBars || { full: 0, hasPartial: false, partialMeters: 0 };
    const requiredMeters = g.totalBars > 0
      ? round1((g.barLength * d.full) / 1000 + (d.hasPartial ? d.partialMeters : 0))
      : 0;
    const utilization = g.totalBars > 0
      ? Math.round(g.avgUtilization * 1000) / 10
      : 0;
    return [
      String(g.quality || ''),
      String(g.type || ''),
      String(g.size || ''),
      String(g.barLength),
      fmt1(requiredMeters),
      String(d.full),
      d.hasPartial ? fmt1(d.partialMeters) : '',
      String(Math.round(g.totalRemainder)),
      utilization.toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ];
  });
}

export function buildPdfSummary(groups) {
  let totalFullBars = 0;
  let totalPartial = 0;
  let weightedUtilSum = 0;
  let totalBars = 0;
  for (const g of groups ?? []) {
    const d = g.displayBars || { full: 0, hasPartial: false };
    totalFullBars += d.full || 0;
    if (d.hasPartial) totalPartial += 1;
    if (g.totalBars > 0) {
      weightedUtilSum += g.avgUtilization * g.totalBars;
      totalBars += g.totalBars;
    }
  }
  const avgUtil = totalBars > 0 ? weightedUtilSum / totalBars : 0;
  return {
    materialTypeCount: (groups ?? []).length,
    totalFullBars,
    totalPartial,
    avgUtilizationPct: Math.round(avgUtil * 1000) / 10,
  };
}

export async function exportCalculationToPdf({
  groups, cutLoss, projectName = '', setCount, filename,
} = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await ensureRobotoRegistered(doc);

  const now = new Date();
  const dateStr = now.toLocaleDateString('hu-HU');
  const timeStr = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  const summary = buildPdfSummary(groups);

  // Címsor: vagy a projekt neve, vagy az alapértelmezett
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(14);
  doc.text(projectName ? projectName : 'Szálanyag kalkuláció', 14, 14);

  // Aldatum + összegzés
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.text(`Generálva: ${dateStr} ${timeStr}`, 14, 20);

  let y = 25;
  if (projectName) {
    doc.text('Szálanyag kalkuláció', 14, y);
    y += 5;
  }

  const summaryParts = [
    `Anyagfajták: ${summary.materialTypeCount}`,
    `Összes szál: ${summary.totalFullBars} db${summary.totalPartial > 0 ? ` (+${summary.totalPartial} részleges)` : ''}`,
  ];
  if (setCount != null) summaryParts.push(`Szettek száma: ${setCount}`);
  summaryParts.push(`Átl. kihasználtság: ${summary.avgUtilizationPct.toLocaleString('hu-HU')}%`);
  summaryParts.push(`Vágási veszteség: ${cutLoss} mm`);
  doc.text(summaryParts.join(' · '), 14, y);
  const tableStartY = y + 5;

  const rows = buildPdfRows(groups);

  autoTable(doc, {
    head: [HEADER],
    body: rows,
    startY: tableStartY,
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
    margin: { left: 10, right: 10 },
  });

  const name = filename || buildExportFilename({ projectName, ext: 'pdf', date: now });
  doc.save(name);
  return name;
}
