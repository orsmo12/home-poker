/* 24 hand-designed, original character avatars drawn in SVG (viewBox 100×100).
 * Each preset picks its own face, hair, headwear, facial hair and accessory, so no two look alike. */

const P = (bg, o) => ({ bg, skin: '#f1c7a3', hair: '#2a1d14', shirt: '#111827', mouth: 'smile', brows: 'none', eyes: 'dot', ...o });
const PRESETS = [
  P(['#34d399', '#065f46'], { name: 'דילר', hair: '#1c1917', style: 'slick', hat: 'visor', shirt: '#f8fafc', vest: '#7f1d1d', mouth: 'smirk' }),
  P(['#a78bfa', '#4c1d95'], { name: 'החכם', skin: '#f3d2b5', hair: '#e5e7eb', style: 'sideHair', beard: 'longBeard', beardColor: '#f1f5f9', acc: 'roundGlasses', brows: 'flat', browColor: '#e5e7eb', shirt: '#312e81' }),
  P(['#fbbf24', '#b45309'], { name: 'זקן ארוך', skin: '#d9a47c', hair: '#18120c', style: 'short', beard: 'longBeard', beardColor: '#1f140c', brows: 'flat', shirt: '#1e293b' }),
  P(['#fb923c', '#9a3412'], { name: 'קאובוי', skin: '#c98b5e', hair: '#5b3a1e', style: 'short', hat: 'cowboy', beard: 'handlebar', beardColor: '#5b3a1e', mouth: 'grin', shirt: '#7c2d12' }),
  P(['#f472b6', '#9d174d'], { name: 'בלונדינית', skin: '#f8d6bd', hair: '#facc15', style: 'long', acc: 'earring', mouth: 'smile', lips: '#e11d48', shirt: '#831843' }),
  P(['#22d3ee', '#1e3a8a'], { name: 'אפרו', skin: '#7a4a2b', hair: '#140c07', style: 'afro', acc: 'headphones', mouth: 'grin', shirt: '#0f172a' }),
  P(['#a3e635', '#3f6212'], { name: 'פאנקיסט', skin: '#f1c7a3', hair: '#ec4899', style: 'mohawk', brows: 'angry', acc: 'earring', mouth: 'neutral', shirt: '#111111' }),
  P(['#60a5fa', '#1e293b'], { name: 'פרו', skin: '#e0ac85', hair: '#0b0b0b', style: 'slick', beard: 'stubble', acc: 'sunglasses', mouth: 'smirk', shirt: '#0b1120' }),
  P(['#2dd4bf', '#115e59'], { name: 'ג׳ינג׳ית', skin: '#fbe0cd', hair: '#ea580c', style: 'curly', acc: 'glasses', mouth: 'smile', freckles: true, shirt: '#134e4a' }),
  P(['#c084fc', '#581c87'], { name: 'המלך', skin: '#e9b48d', hair: '#6b3e1f', style: 'short', hat: 'crown', beard: 'beard', beardColor: '#6b3e1f', mouth: 'grin', shirt: '#7e22ce' }),
  P(['#f87171', '#7f1d1d'], { name: 'פיראט', skin: '#d39b6f', hair: '#1c1917', style: 'none', hat: 'bandana', beard: 'goatee', beardColor: '#1c1917', acc: 'eyepatch', mouth: 'smirk', shirt: '#1f2937' }),
  P(['#38bdf8', '#0c4a6e'], { name: 'ויקינג', skin: '#f5cba7', hair: '#f59e0b', style: 'long', hat: 'viking', beard: 'beard', beardColor: '#f59e0b', brows: 'angry', browColor: '#b45309', shirt: '#422006' }),
  P(['#e879f9', '#701a75'], { name: 'קוקו', skin: '#e8b791', hair: '#5b2e12', style: 'ponytail', eyes: 'wink', mouth: 'grin', shirt: '#4a044e' }),
  P(['#94a3b8', '#7f1d1d'], { name: 'הקשוח', skin: '#5e3a22', hair: '#0b0b0b', style: 'bald', beard: 'mustache', beardColor: '#0b0b0b', brows: 'angry', mouth: 'neutral', shirt: '#111827' }),
  P(['#fde047', '#a16207'], { name: 'צעיר', skin: '#f6cfae', hair: '#3f2a1d', style: 'spiky', hat: 'capBack', capColor: '#2563eb', mouth: 'grin', shirt: '#1d4ed8' }),
  P(['#818cf8', '#312e81'], { name: 'רעולה', skin: '#d8a27a', style: 'none', hat: 'hijab', hijab: '#0f766e', mouth: 'smile', shirt: '#0f766e' }),
  P(['#d6b25e', '#3b2f12'], { name: 'ג׳נטלמן', skin: '#f1c7a3', hair: '#9ca3af', style: 'slick', hat: 'tophat', beard: 'handlebar', beardColor: '#6b7280', acc: 'monocle', mouth: 'neutral', shirt: '#0b0b0b' }),
  P(['#3b82f6', '#172554'], { name: 'היפסטר', skin: '#efc19c', hair: '#3b2414', style: 'short', hat: 'beanie', capColor: '#dc2626', beard: 'beard', beardColor: '#3b2414', acc: 'glasses', shirt: '#14532d' }),
  P(['#fb7185', '#881337'], { name: 'גלמור', skin: '#c68a5e', hair: '#0b0b0b', style: 'bun', acc: 'sunglasses', mouth: 'smirk', lips: '#be123c', shirt: '#4c0519' }),
  P(['#4ade80', '#3b0764'], { name: 'חייזר', skin: '#86efac', style: 'none', hat: 'antenna', eyes: 'alien', mouth: 'o', shirt: '#1e1b4b' }),
  P(['#fdba74', '#9a3412'], { name: 'סבתא', skin: '#f3d2b5', hair: '#d1d5db', style: 'bun', acc: 'roundGlasses', mouth: 'smile', shirt: '#9f1239' }),
  P(['#f97316', '#7c2d12'], { name: 'ספורטאי', skin: '#a8673f', hair: '#140c07', style: 'spiky', hat: 'headband', capColor: '#f43f5e', mouth: 'grin', shirt: '#be123c' }),
  P(['#5eead4', '#0f766e'], { name: 'מתולתל', skin: '#9b6440', hair: '#24160d', style: 'curly', hat: 'cap', capColor: '#f59e0b', mouth: 'smile', shirt: '#065f46' }),
  P(['#6366f1', '#0f172a'], { name: 'קרחת', skin: '#e2a77f', hair: '#1c1917', style: 'buzz', beard: 'goatee', beardColor: '#1c1917', acc: 'earring', brows: 'flat', mouth: 'smirk', shirt: '#1e1b4b' }),
];
export const AVATAR_COUNT = PRESETS.length;
export const avatarName = (a) => PRESETS[Math.abs(Math.round(a)) % AVATAR_COUNT].name;

/* ---------- parts ---------- */
const HAIR_BACK = {
  long: (c) => <path fill={c} d="M27 76 Q22 32 50 24 Q78 32 73 76 Q68 66 69 50 L31 50 Q32 66 27 76Z" />,
  afro: (c) => <circle cx="50" cy="38" r="27" fill={c} />,
  ponytail: (c) => <path fill={c} d="M64 34 Q86 40 80 70 Q76 56 62 46Z" />,
  bun: (c) => <circle cx="50" cy="21" r="8.5" fill={c} />,
};
const HAIR_FRONT = {
  short: (c) => <path fill={c} d="M31 46 Q30 26 50 26 Q70 26 69 46 Q66 34 50 34 Q34 34 31 46Z" />,
  buzz: (c) => <path fill={c} opacity=".75" d="M32 42 Q33 27 50 27 Q67 27 68 42 Q62 32 50 32 Q38 32 32 42Z" />,
  slick: (c) => (<g><path fill={c} d="M31 46 Q29 24 53 25 Q72 27 69 45 Q66 33 57 32 Q47 31 40 36 Q35 39 31 46Z" /><path d="M42 30 Q54 27 64 33" stroke="#fff" strokeOpacity=".25" strokeWidth="1.5" fill="none" /></g>),
  spiky: (c) => <polygon fill={c} points="30,44 32,28 37,33 40,20 46,30 50,17 55,29 61,19 63,32 68,27 70,44 64,35 50,32 36,35" />,
  curly: (c) => (<g fill={c}>{[[34, 37, 7], [40, 29, 7.5], [48, 25.5, 7.5], [56, 26, 7.5], [63, 30, 7], [67, 38, 6], [31, 45, 5], [69, 46, 5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>),
  long: (c) => <path fill={c} d="M31 47 Q30 26 50 26 Q70 26 69 47 Q64 33 52 33 Q44 37 31 47Z" />,
  ponytail: (c) => <path fill={c} d="M31 46 Q30 26 50 26 Q70 26 69 46 Q64 33 50 33 Q36 33 31 46Z" />,
  bun: (c) => <path fill={c} d="M31 46 Q30 27 50 27 Q70 27 69 46 Q64 34 50 34 Q36 34 31 46Z" />,
  mohawk: (c) => <path fill={c} d="M45 40 L43 11 Q50 5 57 11 L55 40Z" />,
  sideHair: (c) => (<g fill={c}><path d="M30 52 Q28 38 34 32 L36 48Z" /><path d="M70 52 Q72 38 66 32 L64 48Z" /></g>),
  afro: () => null,
  bald: () => <ellipse cx="44" cy="33" rx="6" ry="3" fill="#fff" opacity=".22" />,
  none: () => null,
};

function Hat({ p }) {
  const c = p.capColor || p.bg[1];
  switch (p.hat) {
    case 'visor': return (<g><path d="M30 37 Q50 31 70 37 L70 41 Q50 35 30 41Z" fill="#14532d" /><path d="M29 40 Q50 33 71 40 L79 49 Q50 39 21 49Z" fill="#22c55e" opacity=".8" /></g>);
    case 'cap': return (<g><path d="M30 41 Q31 21 50 21 Q69 21 70 41Z" fill={c} /><path d="M48 38 L85 41 Q85 46 72 45 L48 42Z" fill={c} /><circle cx="50" cy="21" r="2" fill="#fff" opacity=".7" /></g>);
    case 'capBack': return (<g><path d="M30 41 Q31 21 50 21 Q69 21 70 41Z" fill={c} /><path d="M31 38 L16 35 Q14 40 21 41 L31 41Z" fill={c} /><rect x="46" y="36" width="8" height="4" rx="2" fill="#fff" opacity=".6" /></g>);
    case 'beanie': return (<g><path d="M29 43 Q29 16 50 16 Q71 16 71 43Z" fill={c} /><rect x="27.5" y="37" width="45" height="8" rx="4" fill={c} /><path d="M33 39 H67" stroke="#000" strokeOpacity=".2" strokeWidth="1" /><circle cx="50" cy="14" r="5" fill="#fff" /></g>);
    case 'cowboy': return (<g><ellipse cx="50" cy="33" rx="34" ry="6.5" fill="#92400e" /><path d="M35 33 Q34 14 44 14 Q50 19 56 14 Q66 14 65 33Z" fill="#b45309" /><rect x="35" y="27" width="30" height="4" fill="#451a03" /></g>);
    case 'tophat': return (<g><rect x="36" y="6" width="28" height="25" rx="2" fill="#0b0b0b" /><rect x="36" y="23" width="28" height="4" fill="#b91c1c" /><ellipse cx="50" cy="31" rx="23" ry="4" fill="#111" /></g>);
    case 'crown': return (<g><polygon points="32,31 32,15 41,24 50,10 59,24 68,15 68,31" fill="#fbbf24" stroke="#b45309" strokeWidth="1" /><circle cx="50" cy="25" r="2.5" fill="#dc2626" /><circle cx="39" cy="27" r="1.8" fill="#2563eb" /><circle cx="61" cy="27" r="1.8" fill="#16a34a" /></g>);
    case 'headband': return (<g><rect x="29.5" y="33" width="41" height="6" rx="3" fill={c} /><path d="M70 35 L80 31 L78 39Z M70 36 L81 40 L74 43Z" fill={c} /></g>);
    case 'bandana': return (<g><path d="M30 41 Q30 20 50 20 Q70 20 70 41 Q60 35 50 35 Q40 35 30 41Z" fill="#dc2626" />{[[40, 27], [50, 25], [60, 28], [45, 32], [56, 32]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.4" fill="#fff" />)}<path d="M68 35 L80 30 L79 42Z" fill="#b91c1c" /></g>);
    case 'viking': return (<g><path d="M30 34 Q16 28 18 12 Q25 26 34 30Z" fill="#f5f5f4" /><path d="M70 34 Q84 28 82 12 Q75 26 66 30Z" fill="#f5f5f4" /><path d="M29 42 Q29 19 50 19 Q71 19 71 42Z" fill="#9ca3af" /><rect x="28" y="37" width="44" height="6" rx="2" fill="#6b7280" /><rect x="48" y="19" width="4" height="23" fill="#6b7280" /></g>);
    case 'antenna': return (<g stroke="#a3e635" strokeWidth="2" fill="none"><path d="M42 30 L36 14" /><path d="M58 30 L64 14" /><circle cx="36" cy="13" r="3" fill="#facc15" stroke="none" /><circle cx="64" cy="13" r="3" fill="#facc15" stroke="none" /></g>);
    default: return null;
  }
}

const BEARDS = {
  stubble: (c) => <path fill={c} opacity=".35" d="M33 50 Q34 67 50 68 Q66 67 67 50 Q62 61 50 61 Q38 61 33 50Z" />,
  mustache: (c) => <path fill={c} d="M41 54.5 Q45.5 50.5 50 53 Q54.5 50.5 59 54.5 Q55 57.5 50 55.5 Q45 57.5 41 54.5Z" />,
  handlebar: (c) => <path fill={c} d="M39 53 Q45 49.5 50 52.5 Q55 49.5 61 53 Q65 52 66 47 Q67 56 59 56 Q54 55 50 55 Q46 55 41 56 Q33 56 34 47 Q35 52 39 53Z" />,
  goatee: (c) => (<g fill={c}>{BEARDS.mustache(c)}<path d="M45 60 Q50 70 55 60 Q50 62.5 45 60Z" /></g>),
  beard: (c) => (<g fill={c}><path d="M31 48 Q32 70 50 72 Q68 70 69 48 Q64 61 50 61 Q36 61 31 48Z" />{BEARDS.mustache(c)}</g>),
  longBeard: (c) => (
    <g fill={c}>
      <path d="M30 47 Q29 66 37 80 Q43 95 50 99 Q57 95 63 80 Q71 66 70 47 Q64 61 50 61 Q36 61 30 47Z" />
      <path d="M41 70 Q44 82 48 90 M59 70 Q56 82 52 90 M50 64 L50 94" stroke="#000" strokeOpacity=".15" strokeWidth="1.2" fill="none" />
      {BEARDS.mustache(c)}
    </g>
  ),
};

function Eyes({ p }) {
  if (p.eyes === 'alien') return (<g fill="#0b0b0b"><ellipse cx="42" cy="47" rx="5.5" ry="7" transform="rotate(-20 42 47)" /><ellipse cx="58" cy="47" rx="5.5" ry="7" transform="rotate(20 58 47)" /><circle cx="40.5" cy="44.5" r="1.4" fill="#fff" /><circle cx="56.5" cy="44.5" r="1.4" fill="#fff" /></g>);
  return (
    <g fill="#0b1020">
      {p.eyes === 'wink' ? <path d="M40 47 Q43 45 46 47" stroke="#0b1020" strokeWidth="2" fill="none" strokeLinecap="round" /> : <circle cx="43" cy="47" r="2.4" />}
      <circle cx="57" cy="47" r="2.4" />
    </g>
  );
}
function Brows({ p }) {
  const c = p.browColor || p.hair;
  if (p.brows === 'flat') return <g stroke={c} strokeWidth="2.2" strokeLinecap="round"><path d="M39 41.5 H46" /><path d="M54 41.5 H61" /></g>;
  if (p.brows === 'angry') return <g stroke={c} strokeWidth="2.4" strokeLinecap="round"><path d="M39 40 L46 43" /><path d="M61 40 L54 43" /></g>;
  return null;
}
function Mouth({ p }) {
  const lip = p.lips || '#0b1020';
  switch (p.mouth) {
    case 'grin': return (<g><path d="M43 54 Q50 64 57 54Z" fill="#3b0a0a" /><path d="M44.5 54.5 H55.5 L55 56 H45Z" fill="#fff" /></g>);
    case 'smirk': return <path d="M45 57 Q52 59 57 53.5" stroke={lip} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
    case 'neutral': return <path d="M45 56.5 H55" stroke={lip} strokeWidth="2.2" strokeLinecap="round" />;
    case 'o': return <ellipse cx="50" cy="57" rx="2.6" ry="3.2" fill="#14532d" />;
    default: return <path d="M43.5 55 Q50 61 56.5 55" stroke={lip} strokeWidth="2.3" fill="none" strokeLinecap="round" />;
  }
}
function Accessory({ p }) {
  switch (p.acc) {
    case 'sunglasses': return (<g><rect x="35.5" y="43" width="13" height="8" rx="3" fill="#0b1020" /><rect x="51.5" y="43" width="13" height="8" rx="3" fill="#0b1020" /><path d="M48.5 46 H51.5" stroke="#0b1020" strokeWidth="2" /><path d="M38 45 h5" stroke="#67e8f9" strokeWidth="1.4" opacity=".75" /><path d="M54 45 h5" stroke="#67e8f9" strokeWidth="1.4" opacity=".75" /></g>);
    case 'glasses': return (<g fill="none" stroke="#0b1020" strokeWidth="1.8"><rect x="36" y="42.5" width="12" height="9" rx="2" /><rect x="52" y="42.5" width="12" height="9" rx="2" /><path d="M48 46 H52" /></g>);
    case 'roundGlasses': return (<g fill="none" stroke="#a16207" strokeWidth="1.8"><circle cx="43" cy="47" r="5.5" /><circle cx="57" cy="47" r="5.5" /><path d="M48.5 47 H51.5" /></g>);
    case 'monocle': return (<g fill="none" stroke="#d4a017" strokeWidth="1.6"><circle cx="57" cy="47" r="5" /><path d="M61 51 Q64 60 62 68" /></g>);
    case 'eyepatch': return (<g><path d="M30 40 L70 50" stroke="#0b0b0b" strokeWidth="1.6" /><ellipse cx="43" cy="47" rx="5.5" ry="4.8" fill="#0b0b0b" /></g>);
    case 'earring': return <circle cx="31" cy="55" r="2.2" fill="#fbbf24" stroke="#b45309" strokeWidth=".8" />;
    case 'headphones': return (<g><path d="M27 50 Q27 15 50 15 Q73 15 73 50" fill="none" stroke="#0b1020" strokeWidth="4" /><rect x="23" y="43" width="9" height="14" rx="4" fill="#f43f5e" /><rect x="68" y="43" width="9" height="14" rx="4" fill="#f43f5e" /></g>);
    default: return null;
  }
}

export function Avatar({ avatar = 0, size = 56, className = '', glow, bg }) {
  const a = Math.abs(Math.round(avatar)) % AVATAR_COUNT;
  const base = PRESETS[a];
  const p = bg ? { ...base, bg } : base;
  const gid = bg ? `av-${a}-${bg[0].slice(1)}` : `av-${a}`;
  const hijab = p.hat === 'hijab';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`rounded-full ${className}`}
      style={glow ? { filter: `drop-shadow(0 0 10px ${p.bg[0]}aa)` } : undefined} role="img" aria-label={p.name}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.bg[0]} /><stop offset="1" stopColor={p.bg[1]} /></linearGradient>
        <clipPath id={`${gid}-c`}><circle cx="50" cy="50" r="50" /></clipPath>
      </defs>
      <g clipPath={`url(#${gid}-c)`}>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        <circle cx="80" cy="18" r="26" fill="#fff" opacity=".12" />
        {/* behind the head */}
        {hijab && <path fill={p.hijab} d="M24 104 Q22 60 27 44 Q30 21 50 20 Q70 21 73 44 Q78 60 76 104Z" />}
        {HAIR_BACK[p.style]?.(p.hair)}
        {/* body */}
        <path d="M13 104 Q15 75 50 73 Q85 75 87 104Z" fill={p.shirt} />
        {p.vest && <path d="M27 104 Q30 80 42 76 L50 92 L58 76 Q70 80 73 104Z" fill={p.vest} />}
        {!hijab && <rect x="44" y="61" width="12" height="15" rx="5" fill={p.skin} />}
        {/* head */}
        {!hijab && p.eyes !== 'alien' && <><circle cx="30.5" cy="49" r="4" fill={p.skin} /><circle cx="69.5" cy="49" r="4" fill={p.skin} /></>}
        {p.eyes === 'alien'
          ? <path d="M30 42 Q30 22 50 22 Q70 22 70 42 Q70 62 50 68 Q30 62 30 42Z" fill={p.skin} />
          : <circle cx="50" cy="47" r="19.5" fill={p.skin} />}
        {p.freckles && <g fill="#c2410c" opacity=".55">{[[39, 52], [42, 54], [45, 52], [55, 52], [58, 54], [61, 52]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".9" />)}</g>}
        <Eyes p={p} />
        <Brows p={p} />
        {p.beard && BEARDS[p.beard](p.beardColor || p.hair)}
        <Mouth p={p} />
        {HAIR_FRONT[p.style]?.(p.hair)}
        {hijab && <path fill={p.hijab} d="M30.5 50 Q29 27 50 26 Q71 27 69.5 50 Q66 33 50 32 Q34 33 30.5 50Z" />}
        <Hat p={p} />
        <Accessory p={p} />
      </g>
    </svg>
  );
}

/** Grid of all characters to pick from. `taken` ones are dimmed (still selectable). */
export function AvatarGrid({ value, onPick, taken = new Set(), size = 46 }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {[...Array(AVATAR_COUNT).keys()].map((a) => (
        <button key={a} type="button" onClick={() => onPick(a)} aria-label={avatarName(a)} title={avatarName(a)}
          className={`flex items-center justify-center rounded-full p-[2px] transition active:scale-90 ${a === value ? 'bg-gradient-to-br from-cyan-300 to-emerald-400 shadow-[0_0_14px_rgba(34,211,238,.7)]' : 'bg-white/10'} ${taken.has(a) && a !== value ? 'opacity-35' : ''}`}>
          <Avatar avatar={a} size={size} />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- casino-chip frame */
/** Classic casino chip colours: [main, dark, background tint for the avatar]. */
export const CHIP_COLORS = [
  { name: 'אדום',  main: '#d62839', dark: '#7a0f1b', bg: ['#f87171', '#991b1b'] },
  { name: 'כחול',  main: '#1d5fd6', dark: '#0b2a6b', bg: ['#60a5fa', '#1e3a8a'] },
  { name: 'ירוק',  main: '#159a4f', dark: '#08502a', bg: ['#4ade80', '#166534'] },
  { name: 'שחור',  main: '#2a2d35', dark: '#08090c', bg: ['#6b7280', '#111827'] },
  { name: 'סגול',  main: '#7c3aed', dark: '#3b0d8c', bg: ['#c084fc', '#5b21b6'] },
  { name: 'כתום',  main: '#f08a1c', dark: '#8a4605', bg: ['#fdba74', '#c2410c'] },
  { name: 'ורוד',  main: '#e2468f', dark: '#7d1247', bg: ['#f9a8d4', '#be185d'] },
  { name: 'טורקיז', main: '#0ea5a5', dark: '#065a5a', bg: ['#5eead4', '#0f766e'] },
  { name: 'צהוב',  main: '#e8b10c', dark: '#7a5a00', bg: ['#fde68a', '#b45309'] },
  { name: 'תכלת',  main: '#38bdf8', dark: '#0c5a80', bg: ['#bae6fd', '#0369a1'] },
];
export const CHIP_COUNT = CHIP_COLORS.length;
export const chipOf = (i) => CHIP_COLORS[((Number(i) || 0) % CHIP_COUNT + CHIP_COUNT) % CHIP_COUNT];

/** An avatar framed like a casino chip: coloured rim with white edge spots.
 *  `chip` = colour index, so two players with the same character still look different. */
/** Mix a #rrggbb colour toward black (amt<0) or white (amt>0). */
export function shade(hex, amt) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));

export function ChipAvatar({ avatar = 0, chip = 0, size = 48, className = '', dim = false, color = '' }) {
  // A player's own glow colour (from their profile) replaces the table's chip colour.
  const c = isHex(color)
    ? { main: color, dark: shade(color, -0.55), bg: [shade(color, 0.45), shade(color, -0.45)] }
    : chipOf(chip);
  const ring = Math.max(5, Math.round(size * 0.13));
  const outer = size + ring * 2;
  const spots = 8;
  return (
    <span className={`relative inline-block shrink-0 rounded-full ${className}`}
      style={{ width: outer, height: outer, boxShadow: isHex(color) ? `0 0 ${Math.round(size * 0.35)}px ${color}cc, 0 0 ${Math.round(size * 0.12)}px ${color}` : undefined }}>
      <svg viewBox="0 0 100 100" width={outer} height={outer} className="absolute inset-0" aria-hidden="true">
        <circle cx="50" cy="50" r="49" fill={c.dark} />
        <circle cx="50" cy="50" r="46.5" fill={c.main} />
        {[...Array(spots)].map((_, i) => (
          <rect key={i} x="45" y="3.5" width="10" height={(ring / outer) * 100 * 0.95} rx="1.5" fill="#fff" opacity=".95"
            transform={`rotate(${(360 / spots) * i + 360 / spots / 2} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r={50 - (ring / outer) * 100 - 0.5} fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.4" strokeDasharray="3 2.2" />
        <circle cx="50" cy="50" r="49" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="1" />
      </svg>
      <span className="absolute" style={{ left: ring, top: ring }}>
        <Avatar avatar={avatar} size={size} bg={c.bg} className={dim ? 'grayscale opacity-70' : ''} />
      </span>
    </span>
  );
}
