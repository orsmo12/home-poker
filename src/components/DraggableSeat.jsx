import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, TrendingDown, TrendingUp } from 'lucide-react';
import { linkColor } from '../lib/link';
import { ChipAvatar } from './Avatar';
import { Chips, M, netTone } from './ui';
import { fromCents, seatInfo } from '../state/store';

/* Table geometry, in "height units" (table box height = 1, width = AR).
 * Seats ride on a stadium-shaped path (straight sides + round ends) along the rail,
 * like a real poker table. */
export const TABLE = {
  portrait: { ar: 1.3, seatW: 1.0, seatH: 0.7, railInsetY: 0.17, railInsetX: 0.1, felt: 0.055 },
  wide: { ar: 1.85, seatW: 1.58, seatH: 0.74, railInsetY: 0.15, railInsetX: 0.12, felt: 0.06 },
};

/** Point at fraction t (0..1) along the stadium path, in % of the table box. t=0 is bottom-center, clockwise. */
export function seatPoint(t, portrait) {
  const g = portrait ? TABLE.portrait : TABLE.wide;
  const R = g.seatH / 2, S = g.seatW - g.seatH;           // end radius, straight length
  const P = 2 * S + 2 * Math.PI * R;                      // perimeter
  const cx = g.ar / 2, cy = 0.5;
  let d = ((((t % 1) + 1) % 1) * P);
  let x, y;
  if (d < S / 2) { x = cx - d; y = cy + R; }                                   // bottom, going left
  else if ((d -= S / 2) < Math.PI * R) { const a = Math.PI / 2 + d / R; x = cx - S / 2 + R * Math.cos(a); y = cy + R * Math.sin(a); } // left end, going up
  else if ((d -= Math.PI * R) < S) { x = cx - S / 2 + d; y = cy - R; }         // top, going right
  else if ((d -= S) < Math.PI * R) { const a = -Math.PI / 2 + d / R; x = cx + S / 2 + R * Math.cos(a); y = cy + R * Math.sin(a); } // right end, going down
  else { d -= Math.PI * R; x = cx + S / 2 - d; y = cy + R; }                   // bottom, back to center
  return { x: (x / g.ar) * 100, y: y * 100 };
}

/** Closest t on the path to a point given in px inside a table box of size w×h. */
export function nearestT(px, py, w, h, portrait) {
  let best = 0, bestD = Infinity;
  for (let k = 0; k < 480; k++) {
    const t = k / 480;
    const p = seatPoint(t, portrait);
    const d = Math.hypot((p.x / 100) * w - px, (p.y / 100) * h - py);
    if (d < bestD) { bestD = d; best = t; }
  }
  return { t: best, dist: bestD };
}

/**
 * A player seat that can be dragged anywhere along the rail (free placement), dropped on another
 * player (swap places), or tapped (open actions).
 * Outer layer animates between seat positions; inner layer handles the drag gesture.
 */
/** Banknotes thrown on the felt in front of a player — deliberately over the top:
 *  the more entries, the bigger and messier the pile. */
function BillStack({ count, portrait }) {
  const n = Math.min(Math.round(count * count * 0.7 + count * 1.3), 34);   // 1→2, 2→5, 3→10, 4→16, 5→24
  const w = portrait ? 22 : 30, h = portrait ? 12 : 16;
  const spread = Math.min(4 + n * 1.6, portrait ? 30 : 42);                // pile radius grows with the mess
  const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const box = spread * 2 + w;
  return (
    <div className="pointer-events-none relative" style={{ width: box, height: box * 0.75 }} aria-hidden="true">
      {[...Array(n)].map((_, i) => {
        const ang = rnd(i, 1) * Math.PI * 2, r = Math.sqrt(rnd(i, 2)) * spread;
        const x = box / 2 + Math.cos(ang) * r - w / 2, y = (box * 0.75) / 2 + Math.sin(ang) * r * 0.6 - h / 2;
        return (
          <svg key={i} viewBox="0 0 26 14" width={w} height={h} className="absolute drop-shadow-[0_1px_1.5px_rgba(0,0,0,.65)]"
            style={{ left: x, top: y - i * 0.35, transform: `rotate(${(rnd(i, 3) - 0.5) * 80}deg)`, zIndex: i }}>
            <rect x=".5" y=".5" width="25" height="13" rx="1.6" fill={['#5fb07e', '#7cc497', '#4f9f6d', '#8fd0a6'][i % 4]} stroke="#2f6b46" strokeWidth=".8" />
            <rect x="3" y="2.5" width="20" height="9" rx="1" fill="none" stroke="#2f6b46" strokeWidth=".6" opacity=".7" />
            <circle cx="13" cy="7" r="3.2" fill="#e8f5ec" stroke="#2f6b46" strokeWidth=".5" />
            <text x="13" y="8.9" textAnchor="middle" fontSize="5.4" fontWeight="900" fill="#2f6b46">₪</text>
          </svg>
        );
      })}
    </div>
  );
}

/** Drops of sweat for players who keep buying back in. */
function Sweat({ level }) {
  if (level <= 0) return null;
  const drops = level === 1 ? [[-2, 0]] : level === 2 ? [[-2, 0], [6, 0.7]] : [[-3, 0], [5, 0.5], [12, 1]];
  return (
    <span className="pointer-events-none absolute -top-1 right-0" aria-label="בלחץ">
      {drops.map(([x, d], i) => (
        <svg key={i} viewBox="0 0 10 14" width="8" height="11" className="sweat absolute" style={{ right: x, animationDelay: `${d}s` }}>
          <path d="M5 0 C5 0 0 7 0 9.5 A5 4.5 0 0 0 10 9.5 C10 7 5 0 5 0Z" fill="#7dd3fc" stroke="#0369a1" strokeWidth=".7" />
          <ellipse cx="3.4" cy="9" rx="1.1" ry="1.6" fill="#fff" opacity=".8" />
        </svg>
      ))}
    </span>
  );
}

export function DraggableSeat({ seat, index, ts, portrait, ratio, cur, tableRef, isTarget, onHover, onDrop, onTap, readOnly = false, entry = 0, crowd = false }) {
  const [dragging, setDragging] = useState(false);
  const wasDragged = useRef(false); // a drag must not also count as a tap
  const pos = seatPoint(ts[index], portrait);
  const s = seatInfo(seat, ratio);
  const out = seat.leftEarly;
  // Crowded phone table: seats on the round ends put the name beside the avatar (toward the felt),
  // so it doesn't run into the next seat below.
  const side = crowd && portrait ? (pos.x < 22 ? 'left' : pos.x > 78 ? 'right' : null) : null;
  const delta = s.stackChips !== null && !out ? s.stackChips - s.boughtChips : 0;
  // Entries = money in ÷ entry size (one 150₪ buy-in at 50₪ a seat counts as 3).
  const entries = entry > 0 ? Math.max(1, Math.round(s.buyIn / entry)) : seat.transactions.length;
  // Bills sit on the felt, between the player and the middle of the table.
  const toward = { x: 50 - pos.x, y: 50 - pos.y };
  const len = Math.hypot(toward.x, toward.y) || 1;
  // Seats on the top rail have their name + amount below the avatar, so push their bills further in.
  const billOff = (portrait ? 46 : 62) + (toward.y > 8 ? (portrait ? 22 : 30) : 0);
  const bills = { x: (toward.x / len) * billOff, y: (toward.y / len) * billOff * 0.85 };

  const avatarRef = useRef(null);

  // Where would the dragged avatar land? Projects its real on-screen centre onto the rail:
  //   { type: 'swap', j }   – on top of another player → swap places
  //   { type: 'place', t }  – an empty spot on the rail → sit there
  //   null                  – dragged far away from the table → snap back
  const landing = () => {
    const el = tableRef.current, av = avatarRef.current;
    if (!el || !av) return null;
    const r = el.getBoundingClientRect();
    const a = av.getBoundingClientRect();
    const px = a.left + a.width / 2 - r.left, py = a.top + a.height / 2 - r.top;
    const minDim = Math.min(r.width, r.height);
    const { t, dist } = nearestT(px, py, r.width, r.height, portrait);
    if (dist > minDim * 0.45) return null;
    const pt = seatPoint(t, portrait);
    let best = -1, bestD = Infinity;
    ts.forEach((tj, j) => {
      if (j === index) return;
      const q = seatPoint(tj, portrait);
      const d = Math.hypot(((q.x - pt.x) / 100) * r.width, ((q.y - pt.y) / 100) * r.height);
      if (d < bestD) { bestD = d; best = j; }
    });
    if (best >= 0 && bestD < Math.max(46, minDim * 0.17)) return { type: 'swap', j: best };
    return { type: 'place', t };
  };

  return (
    <motion.div
      className="absolute"
      style={{ width: 0, height: 0, zIndex: dragging ? 60 : 10 }}
      initial={false}
      animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      {!out && entries > 0 && (
        <div className="pointer-events-none absolute" style={{ left: bills.x, top: bills.y, transform: 'translate(-50%,-50%)', zIndex: 0 }}>
          <BillStack count={entries} portrait={portrait} />
        </div>
      )}
      <motion.div
        drag={!readOnly} dragSnapToOrigin dragMomentum={false}
        onTapStart={() => { wasDragged.current = false; }}
        onDragStart={() => { wasDragged.current = true; setDragging(true); }}
        onDrag={() => onHover(landing())}
        onDragEnd={(_, info) => {
          setDragging(false);
          // A finger never stays perfectly still: a tiny "drag" is really a tap.
          if (Math.hypot(info.offset.x, info.offset.y) < 14) { onHover(null); wasDragged.current = false; onTap(); return; }
          const h = landing();
          onHover(null);
          if (h) onDrop(index, h);
        }}
        onTap={() => { if (!wasDragged.current && !readOnly) onTap(); wasDragged.current = false; }}
        whileDrag={{ scale: 1.15 }}
        whileTap={readOnly ? undefined : { scale: 0.94 }}
        className={`absolute flex flex-col items-center ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ left: portrait ? (crowd ? -32 : -40) : -46, top: portrait ? (crowd ? -19 : -24) : -32, width: portrait ? (crowd ? 64 : 80) : 92, touchAction: 'none' }}
        data-seat={seat.name}
      >
        <div ref={avatarRef} className={`relative rounded-full transition-shadow ${isTarget ? 'shadow-[0_0_0_3px_rgba(34,211,238,.9),0_0_26px_rgba(34,211,238,.8)]' : 'shadow-[0_4px_12px_rgba(0,0,0,.6)]'}`}>
          <ChipAvatar avatar={seat.avatar} chip={seat.chip ?? index} color={seat.glow} size={portrait ? (crowd ? 27 : 34) : (crowd ? 40 : 46)} dim={out} />
          {seat.link && (
            <span title="חשבון משותף" className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-night-950 text-night-950"
              style={{ background: linkColor(seat.link), boxShadow: `0 0 8px ${linkColor(seat.link)}` }}><Link2 size={10} strokeWidth={3} /></span>
          )}
          {!out && <Sweat level={entries >= 5 ? 3 : entries >= 4 ? 2 : entries >= 3 ? 1 : 0} />}
          {(delta !== 0) && (
            <span className={`absolute -bottom-1 -left-1 rounded-full border border-white/20 bg-night-900 p-0.5 ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </span>
          )}
        </div>
        <div className={`mt-0.5 max-w-full truncate font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.9)] ${portrait ? (crowd ? 'text-[10.5px]' : 'text-[12px]') : 'text-[13px]'}`}
          style={side ? { position: 'absolute', top: pos.y < 40 ? 32 : pos.y > 60 ? -4 : 9, [side]: 54, maxWidth: 58, marginTop: 0, zIndex: 2 } : undefined}>{seat.name}</div>
        {!(crowd && portrait && !out) && <div className={`mt-0.5 whitespace-nowrap rounded-full border border-white/10 bg-black/55 leading-tight ${portrait ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}>
          {out
            ? <span className={`font-bold ${netTone(s.netC)}`}>יצא <M v={fromCents(s.netC)} signed cur={cur} /></span>
            : portrait || crowd
              ? <M v={s.buyIn} cur={cur} className="font-bold text-white" />
              : <span className="text-slate-200"><M v={s.buyIn} cur={cur} className="font-bold text-white" /> · <Chips v={s.shownChips} className="text-amber-200" /></span>}
        </div>}
      </motion.div>
    </motion.div>
  );
}
