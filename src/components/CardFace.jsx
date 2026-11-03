/* A standard playing-card face, drawn as SVG so it looks identical on every phone
 * (no emoji suit glyphs): corner indices, classic pip layouts for 2–10, a framed court for J/Q/K. */

const W = 250, H = 350;
const RED_SUIT = [false, true, true, false]; // ♠ ♥ ♦ ♣  (same order as lib/poker SUIT_CH)
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Suit shapes in a 100×100 box.
const SUIT_PATH = [
  // spade
  'M50 3C50 3 5 37 5 60c0 15 12 25 26 25 8 0 14-4 17-9-1 10-5 17-13 22h30c-8-5-12-12-13-22 3 5 9 9 17 9 14 0 26-10 26-25C95 37 50 3 50 3z',
  // heart
  'M50 93S4 62 4 32C4 15 17 5 31 5c9 0 16 5 19 13 3-8 10-13 19-13 14 0 27 10 27 27 0 30-46 61-46 61z',
  // diamond
  'M50 2 91 50 50 98 9 50z',
  // club
  'M50 6a21 21 0 0 0-17 33 21 21 0 1 0 13 30c-1 11-5 19-13 25h34c-8-6-12-14-13-25a21 21 0 1 0 13-30A21 21 0 0 0 50 6z',
];

const L = 88, C = 125, R = 162;
const Y = [92, 132, 175, 218, 258]; // pip rows: top … bottom (kept clear of the corner indices)
const PIPS = {
  '2': [[C, Y[0]], [C, Y[4]]],
  '3': [[C, Y[0]], [C, Y[2]], [C, Y[4]]],
  '4': [[L, Y[0]], [R, Y[0]], [L, Y[4]], [R, Y[4]]],
  '5': [[L, Y[0]], [R, Y[0]], [C, Y[2]], [L, Y[4]], [R, Y[4]]],
  '6': [[L, Y[0]], [R, Y[0]], [L, Y[2]], [R, Y[2]], [L, Y[4]], [R, Y[4]]],
  '7': [[L, Y[0]], [R, Y[0]], [C, 133], [L, Y[2]], [R, Y[2]], [L, Y[4]], [R, Y[4]]],
  '8': [[L, Y[0]], [R, Y[0]], [C, 133], [L, Y[2]], [R, Y[2]], [C, 217], [L, Y[4]], [R, Y[4]]],
  '9': [[L, Y[0]], [R, Y[0]], [L, 147], [R, 147], [C, Y[2]], [L, 203], [R, 203], [L, Y[4]], [R, Y[4]]],
  '10': [[L, Y[0]], [R, Y[0]], [C, 119], [L, 147], [R, 147], [L, 203], [R, 203], [C, 231], [L, Y[4]], [R, Y[4]]],
};
const PIP_SIZE = { '9': 38, '10': 36 };

function Pip({ x, y, s, suit, color }) {
  const flip = y > H / 2 + 1;
  return (
    <g transform={`translate(${x - s / 2} ${y - s / 2}) ${flip ? `rotate(180 ${s / 2} ${s / 2})` : ''}`}>
      <path d={SUIT_PATH[suit]} fill={color} transform={`scale(${s / 100})`} />
    </g>
  );
}

function Index({ rank, suit, color }) {
  const ten = rank === '10';
  return (
    <g>
      <text x="32" y="58" textAnchor="middle" fill={color} fontSize={ten ? 44 : 54} fontWeight="800"
        fontFamily="Georgia, 'Times New Roman', serif" letterSpacing={ten ? -5 : 0}>{rank}</text>
      <Pip x={32} y={82} s={28} suit={suit} color={color} />
    </g>
  );
}

/**
 * @param rank  0..12 (2..A) or null for a "value only" card (no suit chosen yet)
 * @param suit  0..3 or null
 */
export function CardFace({ rank, suit, className = '', style }) {
  const r = RANKS[rank];
  const hasSuit = suit !== null && suit !== undefined;
  const color = hasSuit ? (RED_SUIT[suit] ? '#d61f37' : '#111827') : '#1f2937';
  const court = r === 'J' || r === 'Q' || r === 'K';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} style={style} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="cf-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f1f1ec" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="20" fill="url(#cf-paper)" stroke="#d4d4d0" strokeWidth="2" />

      {hasSuit ? (<>
        <Index rank={r} suit={suit} color={color} />
        <g transform={`rotate(180 ${W / 2} ${H / 2})`}><Index rank={r} suit={suit} color={color} /></g>

        {r === 'A' && <Pip x={C} y={H / 2} s={suit === 2 ? 96 : 110} suit={suit} color={color} />}
        {PIPS[r]?.map(([x, y], i) => <Pip key={i} x={x} y={y} s={PIP_SIZE[r] || 42} suit={suit} color={color} />)}
        {court && (
          <g>
            <rect x="58" y="52" width="134" height="246" rx="6" fill="#fbf7ea" stroke={color} strokeWidth="3" />
            <rect x="65" y="59" width="120" height="232" rx="4" fill="none" stroke="#c9a227" strokeWidth="2" />
            <Crown x={C} y={104} color={color} rank={r} />
            <text x={C} y="214" textAnchor="middle" fill={color} fontSize="104" fontWeight="800" fontFamily="Georgia, 'Times New Roman', serif">{r}</text>
            <Pip x={C} y={256} s={34} suit={suit} color={color} />
          </g>
        )}
      </>) : (<>
        {/* value-only card: big value in the middle, small values in the corners */}
        <text x="30" y="62" textAnchor="middle" fill={color} fontSize={r === '10' ? 46 : 54} fontWeight="800" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing={r === '10' ? -5 : 0}>{r}</text>
        <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
          <text x="30" y="62" textAnchor="middle" fill={color} fontSize={r === '10' ? 46 : 54} fontWeight="800" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing={r === '10' ? -5 : 0}>{r}</text>
        </g>
        <rect x="58" y="70" width="134" height="210" rx="10" fill="none" stroke="#e2e2dc" strokeWidth="3" />
        <text x={C} y="215" textAnchor="middle" fill={color} fontSize={r === '10' ? 110 : 140} fontWeight="800" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing={r === '10' ? -10 : 0}>{r}</text>
      </>)}
    </svg>
  );
}

/** Small crown / cap above the court letter (K crown, Q tiara, J cap). */
function Crown({ x, y, color, rank }) {
  if (rank === 'K') {
    return <path transform={`translate(${x - 34} ${y - 26})`} fill="#c9a227" stroke={color} strokeWidth="2.5"
      d="M2 46 L2 14 L18 30 L34 2 L50 30 L66 14 L66 46 Z" />;
  }
  if (rank === 'Q') {
    return (
      <g transform={`translate(${x - 30} ${y - 22})`} fill="#c9a227" stroke={color} strokeWidth="2.5">
        <path d="M2 40 Q30 0 58 40 Z" /><circle cx="30" cy="10" r="6" /><circle cx="12" cy="24" r="4" /><circle cx="48" cy="24" r="4" />
      </g>
    );
  }
  return <path transform={`translate(${x - 30} ${y - 18})`} fill="#c9a227" stroke={color} strokeWidth="2.5" d="M4 36 Q4 4 30 4 Q56 4 56 36 Z M30 4 L40 -6" />;
}
