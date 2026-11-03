/* Shared table expenses (pizza, beer, snacks…) and the night's buy-in log.
 * Icons are drawn as casino chips in the app's own style, not OS emoji, so they look the same everywhere. */
import { useState } from 'react';
import { Beer, CakeSlice, Car, Check, Coffee, Cookie, Pizza, Plus, Receipt, Sandwich, ShoppingBag, Trash2, Wine, ScrollText, LogOut, Users } from 'lucide-react';
import { ChipAvatar } from './Avatar';
import { BottomSheet, M } from './ui';
import { expenseBalances, fromCents, numFmt } from '../state/store';
import { buzz } from '../lib/haptics';

export const EXPENSE_KINDS = {
  pizza: { label: 'פיצה', icon: Pizza, color: '#f97316' },
  food: { label: 'אוכל', icon: Sandwich, color: '#eab308' },
  beer: { label: 'בירה', icon: Beer, color: '#f59e0b' },
  wine: { label: 'יין/אלכוהול', icon: Wine, color: '#e11d48' },
  coffee: { label: 'קפה', icon: Coffee, color: '#a16207' },
  snacks: { label: 'נשנושים', icon: Cookie, color: '#d97706' },
  dessert: { label: 'קינוח', icon: CakeSlice, color: '#ec4899' },
  shop: { label: 'קניות', icon: ShoppingBag, color: '#06b6d4' },
  ride: { label: 'נסיעה', icon: Car, color: '#6366f1' },
  other: { label: 'אחר', icon: Receipt, color: '#10b981' },
};

/** A small casino chip with the expense icon in the middle. */
export function ExpenseIcon({ kind, size = 40 }) {
  const k = EXPENSE_KINDS[kind] || EXPENSE_KINDS.other;
  const Icon = k.icon;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 35% 30%, ${k.color} 0%, ${k.color}cc 55%, ${k.color}88 100%)`,
        boxShadow: `0 0 0 2px rgba(0,0,0,.35), 0 4px 12px ${k.color}55, inset 0 2px 3px rgba(255,255,255,.35)`,
      }}>
      {/* chip edge marks */}
      <span className="pointer-events-none absolute inset-[2px] rounded-full" style={{ border: `${Math.max(2, size / 14)}px dashed rgba(255,255,255,.75)` }} />
      <span className="relative flex items-center justify-center rounded-full bg-black/25" style={{ width: size * 0.6, height: size * 0.6 }}>
        <Icon size={size * 0.36} strokeWidth={2.4} className="text-white drop-shadow" />
      </span>
    </span>
  );
}

const seatName = (game, id) => game.seats.find((s) => s.id === id)?.name || '—';

/* ------------------------------------------------------------ card on the table screen / settlement */
export function ExpensesCard({ game, settings, dispatch, compact }) {
  const [open, setOpen] = useState(false);
  const cur = settings.currency;
  const list = game.expenses || [];
  const total = list.reduce((a, e) => a + Number(e.amount || 0), 0);
  const bal = expenseBalances(game);
  return (
    <div className="glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-white"><ExpenseIcon kind="pizza" size={26} /> הוצאות משותפות</span>
        {total > 0 && <M v={total} cur={cur} className="text-sm font-bold text-amber-200" />}
      </div>
      {list.length === 0 ? (
        <p className="mb-3 text-xs text-slate-400">הזמנתם פיצה? קניתם בירות? רשמו מי שילם, והסליקה בסוף תחלק את זה בין כולם.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-2.5 py-2">
              <ExpenseIcon kind={e.kind} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{e.label || EXPENSE_KINDS[e.kind]?.label || 'הוצאה'}</div>
                <div className="truncate text-[11px] text-slate-400">
                  שילם {seatName(game, e.paidBy)} · {e.split?.length && e.split.length < game.seats.length ? `מתחלק בין ${e.split.length}` : 'מתחלק בין כולם'}
                </div>
              </div>
              <M v={e.amount} cur={cur} className="font-bold text-white" />
              {!compact && (
                <button onClick={() => dispatch({ type: 'REMOVE_EXPENSE', id: e.id })} aria-label="מחק הוצאה" className="rounded-full p-1.5 text-slate-500 hover:text-rose-300"><Trash2 size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && compact && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {game.seats.filter((s) => bal[s.id]).map((s) => (
            <span key={s.id} className={`rounded-full px-2 py-0.5 text-[11px] ${bal[s.id] > 0 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'}`}>
              {s.name} <M v={fromCents(bal[s.id])} signed cur={cur} />
            </span>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(true)} disabled={game.seats.length === 0} className="btn-ghost w-full py-2 text-sm"><Plus size={16} /> הוספת הוצאה</button>
      {compact && list.length > 0 && <p className="mt-2 text-center text-[11px] text-slate-500">ההוצאות כבר כלולות בהעברות. הרווח בפוקר נשאר נקי בסטטיסטיקה.</p>}
      <AddExpenseSheet open={open} game={game} settings={settings} dispatch={dispatch} onClose={() => setOpen(false)} />
    </div>
  );
}

function AddExpenseSheet({ open, game, settings, dispatch, onClose }) {
  const cur = settings.currency;
  const [kind, setKind] = useState('pizza');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(null);
  const [split, setSplit] = useState(null); // null = everyone
  const everyone = game.seats.map((s) => s.id);
  const chosen = split ?? everyone;
  const amt = Number(amount);
  const ok = amt > 0 && paidBy && chosen.length > 0;
  const reset = () => { setKind('pizza'); setLabel(''); setAmount(''); setPaidBy(null); setSplit(null); };
  const close = () => { reset(); onClose(); };
  const toggle = (id) => { buzz(5); setSplit((cur0) => { const c = cur0 ?? everyone; return c.includes(id) ? c.filter((x) => x !== id) : [...c, id]; }); };
  const save = () => {
    if (!ok) return;
    buzz([10, 30, 10]);
    dispatch({ type: 'ADD_EXPENSE', expense: { kind, label: label.trim(), amount: amt, paidBy, split: chosen.length === everyone.length ? [] : chosen } });
    close();
  };
  return (
    <BottomSheet open={open} onClose={close} title="הוצאה משותפת">
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(EXPENSE_KINDS).map(([k, v]) => (
            <button key={k} onClick={() => { buzz(5); setKind(k); }} className={`flex flex-col items-center gap-1 rounded-2xl p-1.5 transition ${kind === k ? 'bg-white/10 ring-2 ring-amber-300' : ''}`}>
              <ExpenseIcon kind={k} size={42} />
              <span className="text-[10px] text-slate-300">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input type="number" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-input text-center text-2xl font-black" />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{cur}</span>
          </div>
          <input value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} placeholder={EXPENSE_KINDS[kind].label} className="text-input flex-1" />
        </div>
        <div>
          <div className="label">מי שילם?</div>
          <div className="flex flex-wrap gap-2">
            {game.seats.map((s, i) => (
              <button key={s.id} onClick={() => { buzz(5); setPaidBy(s.id); }}
                className={`flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-sm transition ${paidBy === s.id ? 'border-emerald-300 bg-emerald-400/20 text-white' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                <ChipAvatar avatar={s.avatar} chip={s.chip ?? i} color={s.glow} size={26} /> {s.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label flex items-center justify-between">
            <span className="flex items-center gap-1"><Users size={13} /> מתחלק בין</span>
            <button onClick={() => setSplit(null)} className="text-xs text-cyan-300">כולם</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {game.seats.map((s) => {
              const on = chosen.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition ${on ? 'border-amber-300/60 bg-amber-400/15 text-white' : 'border-white/10 text-slate-500 line-through'}`}>
                  {on && <Check size={13} />} {s.name}
                </button>
              );
            })}
          </div>
          {amt > 0 && chosen.length > 0 && <p className="mt-2 text-center text-xs text-slate-400">{numFmt(amt / chosen.length)}{cur} לכל אחד</p>}
        </div>
        <button disabled={!ok} onClick={save} className="btn-primary w-full text-lg"><Plus size={20} /> הוספה</button>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------ the night's log */
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '');

export function NightLog({ game, settings }) {
  const [all, setAll] = useState(false);
  const cur = settings.currency;
  const events = [];
  game.seats.forEach((s, i) => {
    s.transactions.forEach((t, j) => events.push({ at: t.at, seat: s, i, kind: j === 0 ? 'in' : 'rebuy', amount: t.amount, n: j + 1 }));
    if (s.leftEarly) events.push({ at: s.leftAt, seat: s, i, kind: 'left' });
  });
  (game.expenses || []).forEach((e) => events.push({ at: e.at, kind: 'expense', e }));
  events.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  if (!events.length) return null;
  const shown = all ? events : events.slice(0, 6);
  return (
    <div className="glass p-4">
      <div className="mb-2 flex items-center gap-2 font-bold text-white"><ScrollText size={17} className="text-cyan-300" /> יומן הערב</div>
      <ul className="space-y-1.5">
        {shown.map((ev, k) => (
          <li key={k} className="flex items-center gap-2.5 text-sm">
            <span dir="ltr" className="w-11 shrink-0 text-[11px] tabular text-slate-500">{timeOf(ev.at)}</span>
            {ev.kind === 'expense' ? (<>
              <ExpenseIcon kind={ev.e.kind} size={24} />
              <span className="min-w-0 flex-1 truncate text-slate-300">{seatNameFromList(game, ev.e.paidBy)} שילם על {ev.e.label || EXPENSE_KINDS[ev.e.kind]?.label}</span>
              <M v={ev.e.amount} cur={cur} className="text-amber-200" />
            </>) : ev.kind === 'left' ? (<>
              <ChipAvatar avatar={ev.seat.avatar} chip={ev.seat.chip ?? ev.i} color={ev.seat.glow} size={24} dim />
              <span className="min-w-0 flex-1 truncate text-slate-400">{ev.seat.name} קם מהשולחן</span>
              <LogOut size={14} className="text-slate-500" />
            </>) : (<>
              <ChipAvatar avatar={ev.seat.avatar} chip={ev.seat.chip ?? ev.i} color={ev.seat.glow} size={24} />
              <span className="min-w-0 flex-1 truncate text-slate-300">{ev.seat.name} {ev.kind === 'in' ? 'התיישב' : `קנייה #${ev.n}`}</span>
              <M v={ev.amount} cur={cur} className={ev.kind === 'in' ? 'text-slate-200' : 'font-bold text-rose-200'} />
            </>)}
          </li>
        ))}
      </ul>
      {events.length > 6 && <button onClick={() => setAll((v) => !v)} className="mt-2 w-full text-center text-xs text-cyan-300">{all ? 'הצג פחות' : `הצג את כל ${events.length} הפעולות`}</button>}
    </div>
  );
}
const seatNameFromList = (game, id) => game.seats.find((s) => s.id === id)?.name || 'מישהו';
