// Szabott termékek export (PDF / Excel / vágólap TSV).
// Csak az érdemi (nem teljesen üres) sorokat exportálja.
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureRobotoRegistered } from './pdfFonts.js';
import { buildExportFilename } from './pdfExport.js';

export const PRODUCTS_HEADER = [
  'Anyagminőség',
  'Típus',
  'Méret',
  'Szabási hossz (mm)',
  'Darabszám (db)',
];

const isMeaningful = (r) =>
  !!(r && (r.quality || r.type || r.size || r.cutLength || r.quantity));

export function buildProductsRows(rows) {
  return (rows ?? []).filter(isMeaningful).map((r) => [
    r.quality || '',
    r.type || '',
    r.size || '',
    r.cutLength === '' || r.cutLength == null ? '' : Number(r.cutLength),
    r.quantity  === '' || r.quantity  == null ? '' : Number(r.quantity),
  ]);
}

function buildMetadataRows({ projectName } = {}) {
  const meta = [];
  if (projectName) meta.push(['Projekt', projectName]);
  if (meta.length > 0) meta.push([]);
  return meta;
}

// ────────── Vágólap TSV ──────────

export function buildProductsTsv(rows, options = {}) {
  const { projectName } = options;
  const dataRows = buildProductsRows(rows);
  const lines = [];
  if (projectName) {
    lines.push(`Projekt\t${projectName}`);
    lines.push('');
  }
  lines.push(PRODUCTS_HEADER.join('\t'));
  for (const r of dataRows) lines.push(r.join('\t'));
  return lines.join('\n');
}

// ────────── Excel (xlsx) ──────────

export function exportProductsToExcel({ rows, projectName = '', filename } = {}) {
  const dataRows = buildProductsRows(rows);
  const meta = buildMetadataRows({ projectName });
  const aoa = [...meta, PRODUCTS_HEADER, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = PRODUCTS_HEADER.map((h) => ({ wch: Math.max(h.length, 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Szabott termékek');

  const name = filename || buildExportFilename({
    prefix: 'szabott_termekek',
    projectName,
    ext: 'xlsx',
  });
  XLSX.writeFile(wb, name);
  return name;
}

// ────────── PDF ──────────

export async function exportProductsToPdf({ rows, projectName = '', filename } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await ensureRobotoRegistered(doc);

  const now = new Date();
  const dateStr = now.toLocaleDateString('hu-HU');
  const timeStr = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(14);
  doc.text(projectName ? projectName : 'Szabott termékek', 14, 14);

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.text(`Generálva: ${dateStr} ${timeStr}`, 14, 20);

  let y = 25;
  if (projectName) {
    doc.text('Szabott termékek', 14, y);
    y += 5;
  }

  const dataRows = buildProductsRows(rows);
  doc.text(`Sorok száma: ${dataRows.length}`, 14, y);
  const tableStartY = y + 5;

  const stringRows = dataRows.map((r) => r.map((c) => (c === '' || c == null ? '' : String(c))));

  autoTable(doc, {
    head: [PRODUCTS_HEADER],
    body: stringRows,
    startY: tableStartY,
    styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 9, cellPadding: 2 },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [55, 65, 81], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  });

  const name = filename || buildExportFilename({
    prefix: 'szabott_termekek',
    projectName,
    ext: 'pdf',
    date: now,
  });
  doc.save(name);
  return name;
}
