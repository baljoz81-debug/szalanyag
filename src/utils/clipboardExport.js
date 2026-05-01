// P21: kalkuláció másolás vágólapra tab-tagolt formátumban (Excel-be illeszthető).

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

const round1 = (n) => Math.round(n * 10) / 10;

// Magyar locale szerinti szám-formázás (vesszős tizedes), hogy az Excel-be illesztett
// érték magyar gépeken is számként ismerődjön fel.
const formatNumberHu = (n, decimals = 1) =>
  Number(n).toLocaleString('hu-HU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  });

export function buildCalculationTsv(groups, cutLoss) {
  const rows = (groups ?? []).map((g) => {
    const d = g.displayBars || { full: 0, hasPartial: false, partialMeters: 0 };
    const requiredMeters = g.totalBars > 0
      ? round1((g.barLength * d.full) / 1000 + (d.hasPartial ? d.partialMeters : 0))
      : 0;
    return [
      g.quality || '',
      g.type || '',
      g.size || '',
      g.barLength,
      formatNumberHu(requiredMeters, 1),
      cutLoss,
      d.full,
      d.hasPartial ? formatNumberHu(round1(d.partialMeters), 1) : '',
      Math.round(g.totalRemainder),
      g.totalBars > 0 ? formatNumberHu(g.avgUtilization * 100, 1) : 0,
    ];
  });
  return [HEADER, ...rows].map((r) => r.join('\t')).join('\n');
}

// Aszinkron másolás. Modern Clipboard API → execCommand fallback.
export async function copyTextToClipboard(text) {
  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback: rejtett textarea + execCommand('copy')
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand copy returned false');
  } finally {
    document.body.removeChild(ta);
  }
}
