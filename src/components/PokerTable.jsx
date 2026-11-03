import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Move } from 'lucide-react';
import { DraggableSeat, TABLE, seatPoint } from './DraggableSeat';
import { seatTs } from '../state/store';
import { useHint } from '../lib/hints';

function useIsNarrow(maxWidth = 640) {
  const q = `(max-width: ${maxWidth}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return undefined;
    const on = (e) => setNarrow(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return narrow;
}

/** Felt colours a table can have (its "arena" identity). */
export const FELTS = {
  green: { name: 'ירוק', felt: 'radial-gradient(ellipse at 50% 45%,#2fa65a 0%,#1d8a45 45%,#0f6230 100%)', swatch: '#1d8a45' },
  blue: { name: 'כחול', felt: 'radial-gradient(ellipse at 50% 45%,#3b82f6 0%,#1d4ed8 45%,#122f86 100%)', swatch: '#1d4ed8' },
  red: { name: 'אדום', felt: 'radial-gradient(ellipse at 50% 45%,#dc3545 0%,#a51d2d 45%,#661019 100%)', swatch: '#a51d2d' },
  black: { name: 'שחור', felt: 'radial-gradient(ellipse at 50% 45%,#3a3f47 0%,#22262c 45%,#0d0f12 100%)', swatch: '#22262c' },
};

/** Gold flourish beside the table name: a line that ends in a small diamond. */
function Flourish({ flip, small }) {
  return (
    <svg viewBox="0 0 60 12" width={small ? 26 : 44} height={small ? 6 : 10} aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <defs><linearGradient id="fl-g" x1="0" x2="1"><stop offset="0" stopColor="#f5d77a" stopOpacity="0" /><stop offset="1" stopColor="#f5d77a" /></linearGradient></defs>
      <path d="M2 6 H44" stroke="#f5d77a" strokeOpacity=".85" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 6 L50 1 L56 6 L50 11 Z" fill="#0a0a0a" stroke="#f5d77a" strokeWidth="1.3" />
      <circle cx="59" cy="6" r="1.2" fill="#f5d77a" />
    </svg>
  );
}

/** Printed in the middle of the felt, casino style: a black-and-gold chip emblem,
 *  the table name in heavy black letters edged in gold, the group, and the pot. */
function FeltCenter({ small, name, groupName, pot, cur }) {
  const gold = '#f5d77a';
  const em = small ? 30 : 46;
  return (
    <div className="pointer-events-none flex max-w-[70%] flex-col items-center text-center">
      {/* emblem: black chip with gold edge spots and a gold spade */}
      <svg viewBox="0 0 100 100" width={em} height={em} aria-hidden="true" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.55))' }}>
        <circle cx="50" cy="50" r="48" fill="#0a0a0a" stroke={gold} strokeWidth="3" />
        {[...Array(8)].map((_, i) => (
          <rect key={i} x="45" y="3" width="10" height="11" rx="2" fill={gold} transform={`rotate(${i * 45 + 22.5} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="33" fill="#111" stroke={gold} strokeWidth="1.5" strokeDasharray="4 3" />
        <path transform="translate(29 27) scale(.42)" fill={gold}
          d="M50 4C40 20 6 38 6 64c0 15 12 26 26 26 7 0 13-3 17-7-2 11-7 19-15 25h32c-8-6-13-14-15-25 4 4 10 7 17 7 14 0 26-11 26-26C94 38 60 20 50 4z" />
      </svg>

      <div className="mt-1 flex max-w-full items-center gap-1.5">
        <Flourish flip small={small} />
        <div className="min-w-0 truncate font-black italic leading-none"
          style={{
            fontFamily: 'Rubik, sans-serif',
            fontSize: name ? (small ? 19 : 30) : (small ? 14 : 22),
            letterSpacing: name ? '0.02em' : '0.35em',
            color: '#0a0a0a',
            WebkitTextStroke: `${small ? 3 : 4}px ${gold}`,
            paintOrder: 'stroke fill',
            textShadow: '0 3px 0 rgba(0,0,0,.45), 0 0 18px rgba(245,215,122,.35)',
            padding: '0 2px',
          }}>
          {name || 'POKER'}
        </div>
        <Flourish small={small} />
      </div>

      {groupName && (
        <div className="mt-1 max-w-full truncate rounded-sm px-2 font-black uppercase"
          style={{ fontSize: small ? 9 : 12, letterSpacing: '0.18em', color: gold, background: '#0a0a0a', boxShadow: `0 0 0 1px ${gold}66` }}>
          {groupName}
        </div>
      )}

      <div dir="ltr" className="mt-1.5 rounded-full px-2.5 font-black tabular leading-tight"
        style={{ fontSize: small ? 13 : 20, color: gold, background: 'linear-gradient(180deg,#1a1a1a,#050505)', border: `1.5px solid ${gold}`,
          boxShadow: '0 3px 8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.12)', textShadow: '0 0 10px rgba(245,215,122,.45)' }}>
        {Math.round(pot).toLocaleString('he-IL')}{cur}
      </div>
    </div>
  );
}

export function PokerTable({ game, maxSeats, cur, onSeatTap, onAddPlayer, onArrange, readOnly = false, entry = 0 }) {
  const dragHint = useHint('drag', 4);
  const portrait = useIsNarrow();
  const tableRef = useRef(null);
  const [hover, setHover] = useState(null);
  const full = game.seats.length >= maxSeats;
  const g = portrait ? TABLE.portrait : TABLE.wide;
  const ts = seatTs(game.seats);
  const drop = (i, h) => {
    const next = [...ts];
    if (h.type === 'swap') [next[i], next[h.j]] = [next[h.j], next[i]];
    else next[i] = h.t;
    onArrange(Object.fromEntries(game.seats.map((s, k) => [s.id, next[k]])));
  };
  const ghost = hover?.type === 'place' ? seatPoint(hover.t, portrait) : null;

  return (
    <div className="glass relative p-2 sm:p-4">
      {/* Stadium-shaped table (straight sides, round ends) with seats on the rail, like a real one. */}
      <div ref={tableRef} className="relative mx-auto w-full" style={{ aspectRatio: `${g.ar} / 1`, maxWidth: 900 }}>
        {/* padded rail */}
        <div className="absolute rounded-full" style={{
          top: `${g.railInsetY * 100}%`, bottom: `${g.railInsetY * 100}%`,
          left: `${(g.railInsetX / g.ar) * 100}%`, right: `${(g.railInsetX / g.ar) * 100}%`,
          background: 'linear-gradient(180deg,#2b2f36 0%,#15171b 55%,#0b0c0f 100%)',
          boxShadow: '0 22px 50px rgba(0,0,0,.75), inset 0 2px 3px rgba(255,255,255,.18), inset 0 -4px 10px rgba(0,0,0,.7)',
        }} />
        {/* thin wooden rim between rail and felt */}
        <div className="absolute rounded-full" style={{
          top: `${(g.railInsetY + g.felt * 0.75) * 100}%`, bottom: `${(g.railInsetY + g.felt * 0.75) * 100}%`,
          left: `${((g.railInsetX + g.felt * 0.75) / g.ar) * 100}%`, right: `${((g.railInsetX + g.felt * 0.75) / g.ar) * 100}%`,
          background: 'linear-gradient(180deg,#8a5a2b,#4a2c12)', boxShadow: '0 0 0 1px rgba(0,0,0,.6)',
        }} />
        {/* felt */}
        <div className="absolute flex items-center justify-center rounded-full" style={{
          top: `${(g.railInsetY + g.felt) * 100}%`, bottom: `${(g.railInsetY + g.felt) * 100}%`,
          left: `${((g.railInsetX + g.felt) / g.ar) * 100}%`, right: `${((g.railInsetX + g.felt) / g.ar) * 100}%`,
          background: (FELTS[game.felt] || FELTS.green).felt,
          boxShadow: 'inset 0 0 36px rgba(0,0,0,.55)',
        }}>
          <div className="pointer-events-none absolute rounded-full" style={{ inset: portrait ? '12% 7%' : '13% 6%', border: '1.5px solid rgba(255,255,255,.14)' }} />
          <FeltCenter small={portrait} name={game.name} groupName={game.groupName} cur={cur}
            pot={game.seats.reduce((a, st) => a + st.transactions.reduce((b2, t) => b2 + Number(t.amount || 0), 0), 0)} />
        </div>

        {/* where the dragged player will sit */}
        {ghost && (
          <div className="pointer-events-none absolute z-[5] rounded-full border-2 border-dashed border-cyan-300 bg-cyan-300/15 shadow-[0_0_22px_rgba(34,211,238,.7)]"
            style={{ left: `${ghost.x}%`, top: `${ghost.y}%`, width: portrait ? 46 : 60, height: portrait ? 46 : 60, transform: 'translate(-50%,-50%)' }} />
        )}

        {game.seats.map((seat, i) => (
          <DraggableSeat key={seat.id} seat={seat} index={i} ts={ts} portrait={portrait}
            ratio={game.chipsPerUnit} cur={cur} tableRef={tableRef}
            isTarget={hover?.type === 'swap' && hover.j === i} onHover={setHover} onDrop={drop} onTap={() => onSeatTap?.(seat.id)} readOnly={readOnly} entry={Number(game.entry) || entry} />
        ))}
      </div>

      {readOnly ? <div className="h-12 sm:h-10" /> : (
      <div className="mt-14 flex flex-col items-center gap-2 sm:mt-12">
        <motion.button whileTap={{ scale: 0.95 }} onClick={onAddPlayer} disabled={full}
          className="btn-ghost border-emerald-300/40 px-6 text-emerald-100 shadow-glow-emerald disabled:opacity-40">
          <UserPlus size={18} /> {full ? 'השולחן מלא' : 'הוסף שחקן'}
        </motion.button>
        {game.seats.length > 1 && dragHint && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Move size={12} /> גררו שחקן לכל מקום סביב השולחן, או על שחקן אחר כדי להחליף · לחצו לפעולות
          </div>
        )}
      </div>
      )}
    </div>
  );
}
