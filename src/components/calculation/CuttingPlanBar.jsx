// F3a — Egy szál arányos vizualizációja SVG-ben.
// Bemenet: barLength (mm), pieces ([{length}]), cutLoss (mm).
// Megjelenít: darab-blokkok arányos szélességgel, közöttük a vágási veszteség
// keskeny narancs csíkként, a végén a maradék átcsíkozott szürkével.
// SVG alá tömörített szöveges darab-lista (hossz × darabszám).
import { summarizePieces } from '../../utils/cuttingPlanGroups';

const PIECE_FILL = '#1d4ed8';   // kék — vágott darab
const PIECE_STROKE = '#1e40af';
const KERF_FILL = '#f97316';    // narancs — vágási veszteség
const REMAINDER_FILL = 'url(#remainderHatch)';
const REMAINDER_STROKE = '#525252';
const TICK_COLOR = '#888888';

const VIEW_W = 1000;
const VIEW_H = 64;
const TRACK_TOP = 14;
const TRACK_HEIGHT = 36;
const LABEL_Y = TRACK_TOP + TRACK_HEIGHT / 2 + 4; // baseline-középre
const TICK_Y_TOP = TRACK_TOP - 4;
const TICK_Y_BOTTOM = TRACK_TOP + TRACK_HEIGHT + 4;

// Csak akkor írjuk ki a mm-feliratot, ha a blokk legalább ennyi viewbox-egység
const MIN_LABEL_WIDTH = 36;

const formatMm = (mm) => Math.round(mm).toLocaleString('hu-HU');

function CuttingPlanBar({ barLength, pieces = [], cutLoss = 0, label, className = '' }) {
  if (!Number.isFinite(barLength) || barLength <= 0) return null;

  const scale = VIEW_W / barLength;

  // Szegmensek: a piecek között kerf (cutLoss), végén remainder
  const segments = [];
  let cursorMm = 0;
  pieces.forEach((p, idx) => {
    const len = Number(p.length) || 0;
    if (len <= 0) return;
    segments.push({ kind: 'piece', startMm: cursorMm, lengthMm: len, index: idx });
    cursorMm += len;
    if (idx < pieces.length - 1 && cutLoss > 0) {
      segments.push({ kind: 'kerf', startMm: cursorMm, lengthMm: cutLoss });
      cursorMm += cutLoss;
    }
  });
  const usedMm = cursorMm;
  const remainderMm = Math.max(0, barLength - usedMm);
  if (remainderMm > 0) {
    segments.push({ kind: 'remainder', startMm: usedMm, lengthMm: remainderMm });
  }

  const pieceSummary = summarizePieces(pieces);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="font-body text-xs text-text-secondary mb-1 flex items-baseline gap-3">
          <span className="text-text-primary font-medium">{label}</span>
          <span>· szál: {formatMm(barLength)} mm</span>
          <span>· kihasználva: {formatMm(usedMm)} mm</span>
          {remainderMm > 0 && <span>· maradék: {formatMm(remainderMm)} mm</span>}
        </div>
      )}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="w-full h-16 block"
        role="img"
        aria-label={label ? `Szabási sáv: ${label}` : 'Szabási sáv'}
      >
        <defs>
          <pattern
            id="remainderHatch"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#2a2a2a" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#3f3f3f" strokeWidth="3" />
          </pattern>
        </defs>

        {/* Háttér keret (üres szál körvonal) */}
        <rect
          x="0.5"
          y={TRACK_TOP}
          width={VIEW_W - 1}
          height={TRACK_HEIGHT}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bal oldali tick — 0 */}
        <line
          x1="0.5" y1={TICK_Y_TOP} x2="0.5" y2={TICK_Y_BOTTOM}
          stroke={TICK_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke"
        />
        {/* Jobb oldali tick — barLength */}
        <line
          x1={VIEW_W - 0.5} y1={TICK_Y_TOP} x2={VIEW_W - 0.5} y2={TICK_Y_BOTTOM}
          stroke={TICK_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke"
        />

        {segments.map((seg, idx) => {
          const x = seg.startMm * scale;
          const w = seg.lengthMm * scale;

          if (seg.kind === 'piece') {
            const showLabel = w >= MIN_LABEL_WIDTH;
            return (
              <g key={`p-${idx}`}>
                <rect
                  x={x}
                  y={TRACK_TOP}
                  width={w}
                  height={TRACK_HEIGHT}
                  fill={PIECE_FILL}
                  stroke={PIECE_STROKE}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{`Darab ${seg.index + 1}: ${formatMm(seg.lengthMm)} mm`}</title>
                </rect>
                {showLabel && (
                  <text
                    x={x + w / 2}
                    y={LABEL_Y}
                    textAnchor="middle"
                    className="fill-white"
                    style={{
                      fontSize: 14,
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontWeight: 600,
                      pointerEvents: 'none',
                    }}
                  >
                    {formatMm(seg.lengthMm)}
                  </text>
                )}
              </g>
            );
          }

          if (seg.kind === 'kerf') {
            return (
              <rect
                key={`k-${idx}`}
                x={x}
                y={TRACK_TOP}
                width={Math.max(w, 0.5)}
                height={TRACK_HEIGHT}
                fill={KERF_FILL}
              >
                <title>{`Vágási veszteség: ${formatMm(seg.lengthMm)} mm`}</title>
              </rect>
            );
          }

          // remainder
          const showLabel = w >= MIN_LABEL_WIDTH;
          return (
            <g key={`r-${idx}`}>
              <rect
                x={x}
                y={TRACK_TOP}
                width={w}
                height={TRACK_HEIGHT}
                fill={REMAINDER_FILL}
                stroke={REMAINDER_STROKE}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`Maradék: ${formatMm(seg.lengthMm)} mm`}</title>
              </rect>
              {showLabel && (
                <text
                  x={x + w / 2}
                  y={LABEL_Y}
                  textAnchor="middle"
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontStyle: 'italic',
                    fill: '#cccccc',
                    pointerEvents: 'none',
                  }}
                >
                  {formatMm(seg.lengthMm)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {pieceSummary.length > 0 && (
        <div className="font-body text-xs text-text-secondary mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {pieceSummary.map(({ length, count }) => (
            <span key={length} className="tabular-nums">
              <span className="text-text-primary">{formatMm(length)}</span>
              <span className="text-text-secondary">×</span>
              <span className="text-accent font-medium">{count} db</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default CuttingPlanBar;
