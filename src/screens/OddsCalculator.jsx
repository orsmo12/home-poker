import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Plus, RotateCcw, Sparkles, Trash2, UserPlus, X, Check } from 'lucide-react';
import { BottomSheet } from '../components/ui';
import { HAND_NAMES, RANK_CH, SUIT_NAMES, cardId, handName, simulate } from '../lib/poker';
import { numFmt } from '../state/store';
import { track } from '../lib/analytics';
import { buzz } from '../lib/haptics';
import { CardFace } from '../components/CardFace';
import { useHint } from '../lib/hints';

const BOARD_LABELS = ['פלופ', 'פלופ', 'פלופ', 'טרן', 'ריבר'];
const ITERATIONS = 60000;

/* ---------------------------------------------------------------- card visuals */
export function PlayingCard({ card, onClick, size = 'md', highlight }) {
  const dims = size === 'lg' ? 'h-[84px] w-[60px]' : size === 'xl' ? 'h-[150px] w-[107px]' : 'h-[70px] w-[50px]';
  const empty = card === null || card === undefined;
  return (
    <motion.button
      type="button" onClick={onClick} whileTap={{ scale: 0.92 }} whileHover={{ y: -3 }}
      aria-label={empty ? 'הוסף קלף' : `${RANK_CH[card >> 2]} ${SUIT_NAMES[card & 3]}`}
      className={`relative shrink-0 overflow-hidden rounded-[10px] bg-white ${dims} ${
        empty ? 'border-2 border-white shadow-[0_0_0_1px_rgba(244,63,94,.25),0_8px_24px_rgba(0,0,0,.4)]'
          : 'shadow-[0_10px_26px_rgba(0,0,0,.45)]'} ${highlight ? 'ring-4 ring-cyan-300/80' : ''}`}
    >
      {empty && <div className="pointer-events-none absolute inset-[3px] rounded-[9px] border border-slate-200" />}
      <AnimatePresence mode="popLayout" initial={false}>
        {empty ? (
          <motion.span key="plus" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center text-rose-500">
            <Plus size={size === 'xl' ? 44 : 24} strokeWidth={3} />
          </motion.span>
        ) : (
          <motion.span key={card} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.22 }}
            className="absolute inset-0">
            <CardFace rank={card >> 2} suit={card & 3} className="h-full w-full" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ---------------------------------------------------------------- picker overlay */

function CardPickerSheet({ slot, current, used, label, onPick, onClear, onClose }) {
  return (
    <BottomSheet open={!!slot} onClose={onClose} title={label}>
      {slot && <CardPickerBody key={label} current={current} used={used} onPick={onPick} onClear={onClear} onDone={onClose} />}
    </BottomSheet>
  );
}

/** Keyboard-style picker: tap a value, then a suit. Two taps, no scrolling. */
const RANK_ORDER = [12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // A, 2…10, J, Q, K
function CardPickerBody({ current, used, onPick, onClear, onDone }) {
  const [rank, setRank] = useState(null);
  const free = (r, su) => !used.has(cardId(r, su)) || cardId(r, su) === current;
  const pickRank = (r) => {
    buzz(8);
    const open = [0, 1, 2, 3].filter((su) => free(r, su));
    if (open.length === 1) { onPick(cardId(r, open[0])); return; } // only one suit left: done in one tap
    setRank(r);
  };
  return (
    <div className="space-y-4">
      {rank === null ? (
        <div className="grid grid-cols-5 gap-2" dir="ltr">
          {RANK_ORDER.map((r) => {
            const any = [0, 1, 2, 3].some((su) => free(r, su));
            const on = current !== null && current >> 2 === r;
            return (
              <button key={r} type="button" disabled={!any} onClick={() => pickRank(r)} aria-label={RANK_CH[r]}
                className={`rounded-[9px] transition active:scale-90 disabled:opacity-20 ${on ? 'ring-4 ring-cyan-300' : ''} shadow-[0_6px_14px_rgba(0,0,0,.45)]`}>
                <CardFace rank={r} suit={null} className="block h-auto w-full" />
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-4 gap-2.5" dir="ltr">
            {[0, 1, 2, 3].map((su) => (
              <button key={su} type="button" disabled={!free(rank, su)} onClick={() => { buzz(10); onPick(cardId(rank, su)); setRank(null); }}
                aria-label={`${RANK_CH[rank]} ${SUIT_NAMES[su]}`}
                className="rounded-[10px] shadow-[0_8px_20px_rgba(0,0,0,.5)] transition active:scale-95 disabled:opacity-20">
                <CardFace rank={rank} suit={su} className="block h-auto w-full" />
              </button>
            ))}
          </div>
          <button onClick={() => setRank(null)} className="mx-auto mt-3 block text-sm text-slate-400">← חזרה לערכים</button>
        </div>
      )}
      <div className="flex gap-2">
        {current !== null && <button onClick={onClear} className="btn-ghost flex-1"><Trash2 size={16} /> הסר קלף</button>}
        <button onClick={onDone} className="btn-ghost flex-1"><Check size={16} /> סיום</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- background */
export function NightSky() {
  const stars = useMemo(() => {
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    return Array.from({ length: 120 }, () => ({ x: rnd() * 100, y: rnd() * 100, s: rnd() < 0.85 ? 1 : 2, d: rnd() * 6, t: 3 + rnd() * 4, o: 0.3 + rnd() * 0.7 }));
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% -10%,#1a2456 0%,#0a0e2a 42%,#03040c 100%)' }}>
      <div className="absolute -right-24 top-24 h-80 w-80" style={{ background: 'radial-gradient(closest-side, rgba(124,58,237,.28), transparent)' }} />
      <div className="absolute -left-24 bottom-24 h-80 w-80" style={{ background: 'radial-gradient(closest-side, rgba(6,182,212,.22), transparent)' }} />
      {stars.map((st, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, opacity: st.o, animation: `twinkle ${st.t}s ease-in-out ${st.d}s infinite` }} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- screen */
export function OddsCalculator() {
  const oddsHint = useHint('odds', 3);
  const [hands, setHands] = useState([[null, null], [null, null]]);
  const [board, setBoard] = useState([null, null, null, null, null]);
  const [slot, setSlot] = useState(null); // { t:'p', p, j } | { t:'b', j }
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const runId = useRef(0);

  const used = useMemo(() => new Set([...hands.flat(), ...board].filter((c) => c !== null)), [hands, board]);
  const inputKey = JSON.stringify([hands, board]);
  const stale = result && result.key !== inputKey;
  const getCard = (s) => (s.t === 'b' ? board[s.j] : hands[s.p][s.j]);
  const setCard = (s, c) => {
    if (s.t === 'b') setBoard((b) => b.map((x, i) => (i === s.j ? c : x)));
    else setHands((h) => h.map((hand, p) => (p === s.p ? hand.map((x, j) => (j === s.j ? c : x)) : hand)));
  };
  // After a pick, jump straight to the next empty slot so a whole hand is entered in a few taps.
  const nextEmpty = (from, justPicked) => {
    const order = [...hands.flatMap((h, p) => h.map((_, j) => ({ t: 'p', p, j }))), ...board.map((_, j) => ({ t: 'b', j }))];
    const same = (a, b2) => a.t === b2.t && a.j === b2.j && (a.t === 'b' || a.p === b2.p);
    const idx = order.findIndex((x) => same(x, from));
    const isEmpty = (x) => (same(x, from) ? justPicked === null : getCard(x) === null);
    for (let k = 1; k <= order.length; k++) { const x = order[(idx + k) % order.length]; if (isEmpty(x)) return x; }
    return null;
  };
  const slotLabel = slot ? (slot.t === 'b' ? `קלף שולחן · ${BOARD_LABELS[slot.j]}` : `שחקן ${slot.p + 1} · קלף ${slot.j + 1}`) : '';

  const addPlayer = () => hands.length < 9 && setHands([...hands, [null, null]]);
  const removePlayer = (p) => hands.length > 2 && setHands(hands.filter((_, i) => i !== p));
  const reset = () => { runId.current++; setHands([[null, null], [null, null]]); setBoard([null, null, null, null, null]); setResult(null); setProgress(null); };

  const ranOnce = useRef(false);
  const calculate = (auto = false) => {
    ranOnce.current = true;
    if (auto !== true) track('odds_calculated', { players: hands.length, known_hole_cards: hands.flat().filter((c) => c !== null).length, board_cards: board.filter((c) => c !== null).length });
    const id = ++runId.current;
    const n = hands.length;
    const acc = { win: Array(n).fill(0), tie: Array(n).fill(0), equity: Array(n).fill(0), heroCat: Array(9).fill(0), done: 0 };
    const unknown = hands.flat().filter((c) => c === null).length + board.filter((c) => c === null).length;
    const total = unknown === 0 ? 1 : ITERATIONS;
    const key = inputKey;
    const h = hands, b = board;
    setProgress(0);
    const step = () => {
      if (id !== runId.current) return;
      simulate(h, b, Math.min(3000, total - acc.done), acc);
      setProgress(acc.done / total);
      if (acc.done < total) { setTimeout(step, 0); return; }
      setResult({ ...acc, key, exact: unknown === 0, n });
      setProgress(null);
    };
    setTimeout(step, 30);
  };

  // Fewer taps: once the board is being dealt (or after the first "חשב"), every card change recalculates by itself.
  const calcRef = useRef(calculate); calcRef.current = calculate;
  useEffect(() => {
    const someHand = hands.some((h) => h[0] !== null && h[1] !== null);
    const boardCards = board.filter((c) => c !== null).length;
    if (!someHand || (boardCards === 0 && !ranOnce.current)) return undefined;
    if (result && result.key === inputKey) return undefined;
    const t = setTimeout(() => calcRef.current(true), 200);
    return () => clearTimeout(t);
  }, [inputKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = (x) => (result ? (100 * x) / result.done : 0);
  const valid = result && result.n === hands.length;
  const maxEq = valid ? Math.max(...result.equity) : -1;
  const knownBoard = board.filter((c) => c !== null);
  const running = progress !== null;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <NightSky />
      <motion.header initial={false} className="pt-1 text-center">
        <h2 className="flex items-center justify-center gap-2 text-[32px] font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(139,92,246,.55)]">
          <Sparkles className="text-amber-300" size={26} /> סיכויי טקסס הולדם
        </h2>
        {oddsHint && <p className="mt-1 text-sm text-indigo-200/70">לחצו על + כדי לבחור קלף. קלף שלא נבחר נחשב לא ידוע.</p>}
      </motion.header>

      {/* players */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {hands.map((hand, p) => {
            const eq = valid ? pct(result.equity[p]) : 0;
            const leader = valid && !stale && result.equity[p] === maxEq;
            const known = [...hand.filter((c) => c !== null), ...knownBoard];
            const made = hand.every((c) => c !== null) && known.length >= 5 ? handName(known) : null;
            return (
              <motion.div key={p} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className={`glass overflow-hidden p-3 ${leader ? 'border-emerald-300/50 shadow-glow-emerald' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">שחקן {p + 1}</span>
                      {made && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">{made}</span>}
                      {hands.length > 2 && (
                        <button onClick={() => removePlayer(p)} aria-label="הסר שחקן" className="mr-auto rounded-full p-1 text-slate-500 hover:text-rose-300"><X size={16} /></button>
                      )}
                    </div>
                    <AnimatePresence>
                      {valid && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: stale ? 0.4 : 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5">
                          <div className="flex items-baseline justify-between">
                            <span className={`text-2xl font-black tabular ${leader ? 'text-emerald-300' : 'text-white'}`} dir="ltr">{eq.toFixed(1)}%</span>
                            <span className="text-[11px] text-slate-400">ניצחון <span dir="ltr">{pct(result.win[p]).toFixed(1)}%</span> · תיקו <span dir="ltr">{pct(result.tie[p]).toFixed(1)}%</span></span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${eq}%` }} transition={{ type: 'spring', damping: 20 }}
                              className={`h-full rounded-full ${leader ? 'bg-gradient-to-l from-emerald-300 to-emerald-500 shadow-glow-emerald' : 'bg-gradient-to-l from-violet-300 to-indigo-500'}`} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex gap-2" dir="ltr">
                    {hand.map((c, j) => <PlayingCard key={j} card={c} onClick={() => setSlot({ t: 'p', p, j })} highlight={slot?.t === 'p' && slot.p === p && slot.j === j} />)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <motion.button whileTap={{ scale: 0.97 }} onClick={addPlayer} disabled={hands.length >= 9}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300/40 bg-white/[0.02] py-3 font-semibold text-violet-100 transition hover:border-violet-300/80 hover:bg-violet-400/10 hover:shadow-glow-violet disabled:opacity-30">
          <UserPlus size={18} /> הוסף שחקן
        </motion.button>
      </div>

      {/* community cards */}
      <div className="glass p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-indigo-100">קלפי השולחן</span>
          {knownBoard.length > 0 && <button onClick={() => setBoard([null, null, null, null, null])} className="text-xs text-slate-400 hover:text-white">נקה</button>}
        </div>
        <div className="flex items-start justify-center gap-2" dir="ltr">
          {board.map((c, j) => (
            <div key={j} className={`flex flex-col items-center gap-1.5 ${j === 3 ? 'ml-2' : ''} ${j === 4 ? 'ml-1' : ''}`}>
              <PlayingCard card={c} size="lg" onClick={() => setSlot({ t: 'b', j })} highlight={slot?.t === 'b' && slot.j === j} />
              <span className="text-[11px] text-indigo-200/60">{j === 1 ? 'פלופ' : j === 3 ? 'טרן' : j === 4 ? 'ריבר' : ' '}</span>
            </div>
          ))}
        </div>
      </div>

      {/* calculate */}
      <div className="flex items-center gap-2">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => calculate()} disabled={running}
          className="relative flex-1 overflow-hidden rounded-full bg-gradient-to-l from-emerald-300 to-emerald-500 py-4 text-xl font-black text-night-950 shadow-[0_0_34px_rgba(52,211,153,.55)]">
          {running && <motion.span className="absolute inset-y-0 right-0 bg-white/35" animate={{ width: `${(progress || 0) * 100}%` }} />}
          <span className="relative flex items-center justify-center gap-2">
            {running ? `מחשב… ${Math.round((progress || 0) * 100)}%` : stale ? 'חשב מחדש' : 'חשב'} {!running && <ArrowLeft size={22} strokeWidth={3} />}
          </span>
        </motion.button>
        <button onClick={reset} aria-label="נקה הכל" className="glass-pill p-4 text-slate-300 hover:text-white"><RotateCcw size={20} /></button>
      </div>
      {valid && !running && (
        <p className="-mt-2 text-center text-xs text-indigo-200/60">{result.exact ? 'תוצאה מדויקת' : `מבוסס על ${numFmt(result.done, 0)} חלוקות אקראיות`}{stale ? ' · מעדכן…' : ''}</p>
      )}

      {/* hero distribution */}
      {valid && !result.exact && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: stale ? 0.4 : 1, y: 0 }} className="glass p-4">
          <div className="mb-3 text-sm font-bold text-indigo-100">עם איזו יד שחקן 1 יסיים</div>
          <ul className="space-y-1.5">
            {HAND_NAMES.map((name, cat) => ({ name, cat, v: pct(result.heroCat[cat]) })).reverse().filter((x) => x.v > 0.05).map((x) => (
              <li key={x.cat} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-slate-300">{x.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${x.v}%` }} className="h-full rounded-full bg-gradient-to-l from-amber-200 to-amber-400" />
                </div>
                <span className="w-12 text-left text-slate-400 tabular" dir="ltr">{x.v.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <CardPickerSheet
        slot={slot} label={slotLabel} used={used}
        current={slot ? getCard(slot) : null}
        onPick={(c) => { setCard(slot, c); setSlot(nextEmpty(slot, c)); }}
        onClear={() => { setCard(slot, null); setSlot(null); }}
        onClose={() => setSlot(null)}
      />
    </div>
  );
}
