// P20: kalkuláció eredményének xlsx exportja (SheetJS).
import * as XLSX from 'xlsx';
import { buildExportFilename } from './pdfExport.js';

const HEADER = [
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

const round1 = (n) => Math.round(n * 10) / 10;

export function buildCalculationRows(groups) {
  return (groups ?? []).map((g) => {
    const d = g.displayBars || { full: 0, hasPartial: false, partialMeters: 0 };
    const requiredMeters = g.totalBars > 0
      ? round1((g.barLength * d.full) / 1000 + (d.hasPartial ? d.partialMeters : 0))
      : 0;
    return [
      g.quality || '',
      g.type || '',
      g.size || '',
      g.barLength,
      requiredMeters,
      d.full,
      d.hasPartial ? round1(d.partialMeters) : '',
      Math.round(g.totalRemainder),
      g.totalBars > 0 ? Math.round(g.avgUtilization * 1000) / 10 : 0,
    ];
  });
}

export function buildMetadataRows({ projectName, setCount, cutLoss } = {}) {
  const rows = [];
  if (projectName) rows.push(['Projekt', projectName]);
  if (setCount != null) rows.push(['Szettek száma', setCount]);
  if (cutLoss != null) rows.push(['Vágási veszteség (mm)', cutLoss]);
  if (rows.length > 0) rows.push([]); // üres sor a táblázat előtt
  return rows;
}

export function exportCalculationToExcel({
  groups, cutLoss, projectName = '', setCount, filename,
} = {}) {
  const dataRows = buildCalculationRows(groups);
  const meta = buildMetadataRows({ projectName, setCount, cutLoss });
  const aoa = [...meta, HEADER, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Oszlopszélességek a fejléc hosszához igazítva
  ws['!cols'] = HEADER.map((h) => ({ wch: Math.max(h.length, 12) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kalkuláció');

  const name = filename || buildExportFilename({ projectName, ext: 'xlsx' });
  XLSX.writeFile(wb, name);
  return name;
}
