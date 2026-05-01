// P20: kalkuláció eredményének xlsx exportja (SheetJS).
import * as XLSX from 'xlsx';

const HEADER = [
  'Anyagminőség',
  'Típus',
  'Méret',
  'Szálhossz (mm)',
  'Szükséges anyagmennyiség (m)',
  'Vágási veszteség (mm)',
  'Szükséges szálak (db)',
  'Utolsó szál (m)',
  'Maradék (mm)',
  'Kihasználtság (%)',
];

const dateStamp = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

const round1 = (n) => Math.round(n * 10) / 10;

export function buildCalculationRows(groups, cutLoss) {
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
      cutLoss,
      d.full,
      d.hasPartial ? round1(d.partialMeters) : '',
      Math.round(g.totalRemainder),
      g.totalBars > 0 ? Math.round(g.avgUtilization * 1000) / 10 : 0,
    ];
  });
}

export function exportCalculationToExcel({ groups, cutLoss, filename } = {}) {
  const rows = buildCalculationRows(groups, cutLoss);
  const aoa = [HEADER, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Oszlopszélességek a fejléc hosszához igazítva
  ws['!cols'] = HEADER.map((h) => ({ wch: Math.max(h.length, 12) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kalkuláció');

  const name = filename || `szalanyag_export_${dateStamp()}.xlsx`;
  XLSX.writeFile(wb, name);
  return name;
}
