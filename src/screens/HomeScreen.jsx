import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Calculator, Check, CloudDownload, Crown, History, Keyboard, Pencil, Plus, RotateCcw, Sparkles, Trash2, UserPlus, Users, X, Contact } from 'lucide-react';
import { Avatar, AvatarGrid, AVATAR_COUNT } from '../components/Avatar';
import { Chips, M } from '../components/ui';
import { FELTS } from '../components/PokerTable';
import { buzz } from '../lib/haptics';
import { numFmt, toCents } from '../state/store';
import { track } from '../lib/analytics';
import { useCloud } from '../cloud/CloudProvider';
import { useHint } from '../lib/hints';
import { contactsSupported, pickContacts } from '../lib/contacts';
import { prettyPhone } from '../lib/phone';

/* ============================================================== HOME (lobby) */
function RestoreBanner() {
  const cloud = useCloud();
  const b = cloud.backup;
  if (!b) return null;
  const seats = b.game.seats || [];
  const pot = seats.reduce((a, s) => a + (s.transactions || []).reduce((x, t) => x + Number(t.amount || 0), 0), 0);
  const at = new Date(b.updated_at).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="rounded-3xl border border-amber-300/40 bg-amber-400/10 p-4">
      <div className="flex items-center gap-2 font-bold text-white"><CloudDownload size={18} className="text-amber-300" /> נמצא משחק פתוח בענן</div>
      <div className="mt-1 text-sm text-slate-300">{b.game.name || 'השולחן שלי'} · {seats.length} שחקנים · קופה {numFmt(pot)} · עודכן {at}</div>
      <div className="mt-3 flex gap-2">
        <button onClick={cloud.dismissBackup} className="btn-ghost flex-1">התעלם</button>
        <button onClick={cloud.restoreBackup} className="btn-primary flex-1">המשך את המשחק</button>
      </div>
    </div>
  );
}

export function HomeScreen({ state, dispatch, onNavigate, playTable, onPlayTableUsed }) {
  const [wizard, setWizard] = useState(false); // false | true | { tableId }
  const [editTables, setEditTables] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  useEffect(() => { if (playTable) { setWizard(playTable === 'new' ? true : { tableId: playTable }); onPlayTableUsed?.(); } }, [playTable]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = Object.values(state.tables || {}).filter((t) => t.lastPlayed).sort((a, b) => String(b.lastPlayed).localeCompare(String(a.lastPlayed))).slice(0, 6);
  const cur = state.settings.currency;
  const games = state.history.filter((h) => h.type === 'cash');
  const last = games[0];
  const lastTop = last ? [...last.results].sort((a, b) => b.net - a.net)[0] : null;
  const totalPot = games.reduce((a, g) => a + g.results.reduce((s, r) => s + toCents(r.buyIn), 0), 0) / 100;
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'עוד יד אחרונה?' : hour < 12 ? 'בוקר טוב' : hour < 18 ? 'מתכוננים לערב?' : 'ערב פוקר?';

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* hero */}
      <motion.div initial={false} className="pt-2 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white">{greeting}</h1>
        <div className="mt-1 text-sm text-slate-400">{games.length ? `${games.length} ערבים כבר נוהלו כאן` : 'כל ערב הפוקר במקום אחד'}</div>
      </motion.div>

      <RestoreBanner />

      {/* main call to action */}
      <motion.button
        initial={false}
        whileTap={{ scale: 0.97 }} onClick={() => setWizard(true)}
        className={`relative block w-full overflow-hidden rounded-[32px] text-right shadow-[0_20px_60px_rgba(16,185,129,.35)] ${games.length ? 'p-5' : 'p-6'}`}
        style={{ background: 'radial-gradient(ellipse at 20% 0%,#34d399 0%,#059669 45%,#064e3b 100%)' }}
      >
        <div className="pointer-events-none absolute -left-6 -top-10 text-[160px] leading-none text-black/10">♠</div>
        <div className="pointer-events-none absolute -bottom-12 left-16 text-[120px] leading-none text-black/10">♥</div>
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-emerald-50"><Sparkles size={13} /> כמה צעדים קצרים</div>
          <div className="mt-3 text-3xl font-black text-white">משחק חדש</div>
          {!games.length && <div className="mt-1 text-sm text-emerald-50/85">בוחרים שולחן, כניסה ומי משחק, ומתיישבים.</div>}
          <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-emerald-800 shadow-lg">
            בואו נתחיל <ArrowLeft size={18} />
          </div>
        </div>
      </motion.button>

      {/* first-timers: how it works, in three lines */}
      {games.length === 0 && (
        <ol className="glass space-y-2.5 p-4 text-sm text-slate-300">
          {[['🪑', 'פותחים שולחן ומוסיפים את החבר\'ה'], ['💵', 'כל קנייה נרשמת בלחיצה על השחקן'], ['🤝', 'בסוף סופרים צ\'יפים והאפליקציה אומרת מי מעביר למי']].map(([e, t]) => (
            <li key={t} className="flex items-center gap-3"><span className="text-xl">{e}</span>{t}</li>
          ))}
        </ol>
      )}

      {/* recent tables: play again in one tap */}
      {recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-bold text-white">השולחנות שלך</span>
            <button onClick={() => { setEditTables((v) => !v); setConfirmDel(null); }} className="text-[12px] font-semibold text-cyan-300">{editTables ? 'סיום' : 'עריכה'}</button>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 pt-2">
            {recent.map((t) => (
              <div key={t.id} className="relative shrink-0">
                <TableCard table={t} state={state} onClick={() => { if (editTables) return; buzz(10); setWizard({ tableId: t.id }); }} />
                {editTables && (confirmDel === t.id
                  ? <button onClick={() => { buzz(15); dispatch({ type: 'TABLE_REMOVE', id: t.id }); setConfirmDel(null); }} className="absolute -left-1 -top-2 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">למחוק?</button>
                  : <button onClick={() => setConfirmDel(t.id)} aria-label={`מחיקת ${t.name}`} className="absolute -left-1 -top-2 rounded-full border-2 border-night-950 bg-rose-500 p-1 text-white shadow-lg"><X size={14} strokeWidth={3} /></button>)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* stats */}
      {games.length > 0 && (
        <motion.div initial={false} className="grid grid-cols-3 gap-2">
          {[
            { label: 'משחקים', value: games.length },
            { label: 'שחקנים', value: Object.keys(state.players).length },
            { label: 'עבר על השולחן', value: <M v={totalPot} cur={cur} /> },
          ].map((s) => (
            <div key={s.label} className="glass rounded-3xl px-3 py-3 text-center">
              <div className="text-xl font-black text-white">{s.value}</div>
              <div className="text-[11px] text-slate-400">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* last game */}
      {last && (
        <motion.button initial={false}
          onClick={() => onNavigate('history')} className="glass flex w-full items-center gap-3 p-4 text-right active:scale-[0.99]">
          <div className="relative">
            <Avatar avatar={state.players[lastTop?.playerId]?.avatar ?? 0} size={46} />
            {lastTop?.net > 0 && <Crown size={16} className="absolute -top-2 left-1/2 -translate-x-1/2 text-amber-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-400">המשחק האחרון · {new Date(last.endedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</div>
            <div className="truncate font-bold text-white">
              {lastTop?.net > 0 ? <>{lastTop.name} לקח <M v={lastTop.net} cur={cur} className="text-emerald-300" /></> : `${last.results.length} שחקנים`}
            </div>
          </div>
          <ArrowLeft size={18} className="text-slate-500" />
        </motion.button>
      )}

      {/* shortcuts */}
      <motion.div initial={false} className="grid grid-cols-2 gap-2">
        <button onClick={() => onNavigate('odds')} className="glass flex items-center gap-3 p-4 text-right active:scale-[0.98]">
          <span className="rounded-2xl bg-violet-500/20 p-2.5 text-violet-200"><Calculator size={20} /></span>
          <span><span className="block font-bold text-white">סיכויים</span><span className="text-[11px] text-slate-400">מי מוביל ביד?</span></span>
        </button>
        <button onClick={() => onNavigate('history')} className="glass flex items-center gap-3 p-4 text-right active:scale-[0.98]">
          <span className="rounded-2xl bg-amber-500/20 p-2.5 text-amber-200"><History size={20} /></span>
          <span><span className="block font-bold text-white">סטטיסטיקה</span><span className="text-[11px] text-slate-400">{games.length ? `${games.length} משחקים` : 'עוד ריקה'}</span></span>
        </button>
      </motion.div>

      <AnimatePresence>{wizard && <NewGameWizard state={state} dispatch={dispatch} initialTableId={wizard?.tableId} onClose={() => setWizard(false)} />}</AnimatePresence>
    </div>
  );
}

/* ============================================================== TABLES */
export function FeltDot({ felt, size = 40, children }) {
  const f = FELTS[felt] || FELTS.green;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-amber-300/50 shadow-[inset_0_2px_8px_rgba(0,0,0,.5)]"
      style={{ width: size, height: size, background: f.felt }}>{children}</span>
  );
}

const ago = (iso) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'היום' : d === 1 ? 'אתמול' : d < 7 ? `לפני ${d} ימים` : d < 30 ? `לפני ${Math.round(d / 7)} שבועות` : new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
};

function TableCard({ table, state, onClick }) {
  const faces = (table.playerIds || []).map((id) => state.players[id]).filter(Boolean).slice(0, 4);
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick}
      className="glass flex w-[150px] flex-col items-start gap-2 p-3 text-right">
      <div className="flex w-full items-center justify-between">
        <FeltDot felt={table.felt} size={34}><span className="text-sm text-white/80">♠</span></FeltDot>
        <span className="rounded-full bg-emerald-400/15 p-1.5 text-emerald-300"><RotateCcw size={14} /></span>
      </div>
      <div className="w-full">
        <div className="truncate font-bold text-white">{table.name}</div>
        <div className="text-[11px] text-slate-400">{ago(table.lastPlayed)}{table.cloudId ? ' · ☁︎' : ''}</div>
      </div>
      {faces.length > 0 && (
        <div className="flex -space-x-2 space-x-reverse">
          {faces.map((p) => <span key={p.id} className="rounded-full ring-2 ring-night-900"><Avatar avatar={p.avatar} size={22} /></span>)}
          {(table.playerIds || []).length > 4 && <span className="flex h-[22px] items-center rounded-full bg-white/10 px-1.5 text-[10px] text-slate-300 ring-2 ring-night-900">+{table.playerIds.length - 4}</span>}
        </div>
      )}
    </motion.button>
  );
}

/* ============================================================== NEW GAME WIZARD */
const BUYINS = [50, 100, 150, 200, 300, 500];
const CHIP_OPTIONS = [500, 1000, 2000, 2500, 5000, 10000];

function OptionGrid({ options, value, onPick, render }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {options.map((o) => {
        const on = o === value;
        return (
          <motion.button key={o} whileTap={{ scale: 0.93 }} onClick={() => onPick(o)}
            className={`relative rounded-3xl border py-5 text-center transition ${on
              ? 'border-emerald-300 bg-emerald-400/20 shadow-glow-emerald'
              : 'border-white/10 bg-white/[0.05] hover:border-white/25'}`}>
            {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute left-2 top-2 rounded-full bg-emerald-400 p-0.5 text-night-950"><Check size={12} strokeWidth={3} /></motion.span>}
            <div className={`text-2xl font-black ${on ? 'text-white' : 'text-slate-200'}`}>{render(o)}</div>
          </motion.button>
        );
      })}
    </div>
  );
}

function CustomValue({ label, suffix, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  if (!open) {
    return (
      <button onClick={() => { setDraft(String(value)); setOpen(true); }} className="mx-auto mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
        <Keyboard size={15} /> {label}
      </button>
    );
  }
  const ok = Number(draft) > 0;
  return (
    <div className="mt-3 flex gap-2">
      <div className="relative flex-1">
        <input autoFocus type="number" inputMode="decimal" dir="ltr" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ok) { onChange(Number(draft)); setOpen(false); } }}
          className="text-input text-center text-xl font-black" />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{suffix}</span>
      </div>
      <button disabled={!ok} onClick={() => { onChange(Number(draft)); setOpen(false); }} className="btn-primary px-5">אישור</button>
    </div>
  );
}

const playersOfTable = (state, t) => (t?.playerIds || []).map((id) => state.players[id]).filter(Boolean)
  .map((pl) => ({ key: pl.id, name: pl.name, avatar: pl.avatar }));

function NewGameWizard({ state, dispatch, onClose, initialTableId }) {
  const avatarHint = useHint('avatar', 3);
  const cur = state.settings.currency;
  const init = initialTableId ? state.tables?.[initialTableId] : null;
  const [step, setStep] = useState(init ? 3 : 0);
  const [, setDir] = useState(1);
  const [buyIn, setBuyIn] = useState(init?.buyIn || state.settings.defaultBuyIn);
  const [chips, setChips] = useState(init?.chips || state.settings.chipsPerBuyIn);
  const [picked, setPicked] = useState(() => playersOfTable(state, init)); // [{ key, name, avatar }]
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // key of the player whose character is being changed
  useCloud();
  const [tableId, setTableId] = useState(init?.id || null); // null = new table
  const [tableName, setTableName] = useState('');
  const [felt, setFelt] = useState(init?.felt || 'green');
  const tables = useMemo(() => Object.values(state.tables || {})
    .sort((a, b) => String(b.lastPlayed || b.createdAt || '').localeCompare(String(a.lastPlayed || a.createdAt || ''))), [state.tables]);
  const chosen = tableId ? state.tables?.[tableId] : null;
  const [editTables, setEditTables] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const removeTable = (id) => { buzz(15); if (tableId === id) setTableId(null); dispatch({ type: 'TABLE_REMOVE', id }); };
  // the players of the most recent night, for one-tap seating at a new table
  const lastNight = useMemo(() => {
    const h = state.history.find((x) => x.type === 'cash');
    return h ? h.results.map((r) => state.players[r.playerId] || { id: r.playerId, name: r.name, avatar: r.avatar ?? 0 }).filter(Boolean) : [];
  }, [state.history, state.players]);
  const playAgain = (t) => {
    buzz(12);
    setTableId(t.id); setFelt(t.felt || 'green');
    if (t.buyIn) setBuyIn(t.buyIn);
    if (t.chips) setChips(t.chips);
    const ps = playersOfTable(state, t);
    if (ps.length) setPicked(ps);
    setDir(1); setStep(t.buyIn ? 3 : 1);
  };

  const known = useMemo(() => {
    // Most-played first, so regulars are one tap away.
    const counts = {};
    state.history.forEach((g) => g.results.forEach((r) => { counts[r.playerId] = (counts[r.playerId] || 0) + 1; }));
    return Object.values(state.players).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  }, [state.players, state.history]);

  const usedAvatars = new Set(picked.map((p) => p.avatar));
  const knownAvatars = new Set(Object.values(state.players).map((p) => p.avatar));
  const freeAvatar = () => [...Array(AVATAR_COUNT).keys()].find((a) => !usedAvatars.has(a) && !knownAvatars.has(a))
    ?? [...Array(AVATAR_COUNT).keys()].find((a) => !usedAvatars.has(a)) ?? 0;

  const isPicked = (n) => picked.some((p) => p.name.toLowerCase() === n.toLowerCase());
  const toggleKnown = (pl) => setPicked((cur) => (isPicked(pl.name) ? cur.filter((p) => p.name.toLowerCase() !== pl.name.toLowerCase()) : [...cur, { key: pl.id, name: pl.name, avatar: pl.avatar }]));
  const addNew = () => {
    const n = name.trim();
    if (!n || isPicked(n)) return;
    const existing = known.find((p) => p.name.toLowerCase() === n.toLowerCase());
    setPicked((cur) => [...cur, existing ? { key: existing.id, name: existing.name, avatar: existing.avatar } : { key: `new-${n}`, name: n, avatar: freeAvatar() }]);
    if (!existing) setEditing(`new-${n}`);
    setName('');
  };

  const go = (d) => { setDir(d); setStep((s) => s + d); };
  // friends from the phone's contacts: name + phone in one go (Android Chrome)
  const fromContacts = async () => {
    try {
      const list = await pickContacts(true);
      if (!list.length) return;
      buzz(12);
      setPicked((cur) => {
        let next = [...cur];
        const used = new Set(next.map((x) => x.avatar));
        for (const c of list) {
          const i = next.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase());
          if (i >= 0) { next[i] = { ...next[i], phone: c.phone || next[i].phone }; continue; }
          const existing = known.find((p) => p.name.toLowerCase() === c.name.toLowerCase());
          let av = existing?.avatar;
          if (av === undefined) { av = [...Array(AVATAR_COUNT).keys()].find((a) => !used.has(a) && !knownAvatars.has(a)) ?? [...Array(AVATAR_COUNT).keys()].find((a) => !used.has(a)) ?? 0; }
          used.add(av);
          next = [...next, { key: existing?.id || `new-${c.name}`, name: existing?.name || c.name, avatar: av, phone: c.phone }];
        }
        return next;
      });
      track('contacts_picked', { count: list.length });
    } catch { /* cancelled */ }
  };

  const start = () => {
    dispatch({ type: 'SETTINGS_UPDATE', patch: { defaultBuyIn: buyIn, chipsPerBuyIn: chips } });
    dispatch(chosen ? { type: 'GAME_START', tableId: chosen.id, felt } : { type: 'GAME_START', name: tableName.trim(), felt });
    buzz([15, 40, 25]);
    picked.forEach((p) => dispatch({ type: 'ADD_PLAYER', name: p.name, amount: buyIn, avatar: p.avatar, phone: p.phone || undefined }));
    track('game_started', { players: picked.length, returning_user: state.history.length > 0, via: 'wizard' });
    onClose();
  };

  const steps = [
    {
      title: 'איפה משחקים?',
      sub: tables.length ? 'פתחו שולחן חדש, או שחקו שוב בשולחן קודם.' : 'תנו שם לשולחן ובחרו צבע בד.',
      body: (<>
        <div className={`rounded-3xl border p-4 ${!tableId ? 'border-emerald-300/50 bg-emerald-400/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><Plus size={16} /> שולחן חדש</div>
          <input value={tableName} maxLength={30} onFocus={() => setTableId(null)} onChange={(e) => { setTableId(null); setTableName(e.target.value); }}
            placeholder="למשל: הקזינו של יוסי" className="text-input" />
          <div className="mt-3 text-xs text-slate-500">צבע הבד</div>
          <div className="mt-2 flex gap-3">
            {Object.entries(FELTS).map(([k, f]) => (
              <button key={k} type="button" onClick={() => { setTableId(null); setFelt(k); buzz(8); }} aria-label={f.name}
                className={`flex flex-col items-center gap-1 rounded-2xl p-1 ${felt === k && !tableId ? 'ring-2 ring-emerald-300' : ''}`}>
                <FeltDot felt={k} size={42}>{felt === k && !tableId && <Check size={18} className="text-white" />}</FeltDot>
                <span className="text-[11px] text-slate-400">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
        {tables.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-slate-500">או שחקו שוב בשולחן קודם</span>
              <button onClick={() => { setEditTables((v) => !v); setConfirmDel(null); }} className="text-xs font-semibold text-cyan-300">{editTables ? 'סיום' : 'עריכה'}</button>
            </div>
            {tables.slice(0, 12).map((t) => {
              const on = tableId === t.id;
              const n = (t.playerIds || []).length;
              return (
                <div key={t.id} className={`flex w-full items-center gap-3 rounded-3xl border p-3 text-right transition ${on ? 'border-emerald-300 bg-emerald-400/15' : 'border-white/10 bg-white/[0.04]'}`}>
                  <button onClick={() => !editTables && playAgain(t)} className="flex min-w-0 flex-1 items-center gap-3 text-right">
                    <FeltDot felt={t.felt} size={44}><span className="text-white/80">♠</span></FeltDot>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-white">{t.name}</span>
                      <span className="block text-[11px] text-slate-400">{[n ? `${n} שחקנים` : '', t.buyIn ? `כניסה ${numFmt(t.buyIn)}${cur}` : '', ago(t.lastPlayed)].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                  {!editTables ? (
                    <button onClick={() => playAgain(t)} className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1.5 text-xs font-bold text-emerald-200"><RotateCcw size={13} /> שחק שוב</button>
                  ) : confirmDel === t.id ? (
                    <button onClick={() => { removeTable(t.id); setConfirmDel(null); }} className="shrink-0 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">למחוק?</button>
                  ) : (
                    <button onClick={() => setConfirmDel(t.id)} aria-label={`מחיקת ${t.name}`} className="shrink-0 rounded-full p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 size={18} /></button>
                  )}
                </div>
              );
            })}
            {editTables && <p className="px-1 text-[11px] text-slate-500">מחיקה מסירה את השולחן מהרשימה. הערבים שנשמרו נשארים בסטטיסטיקה.</p>}
          </div>
        )}
      </>),
      ok: true,
    },
    {
      title: 'כמה עולה כניסה?',
      sub: 'הסכום שכל שחקן משלם כשהוא מתיישב.',
      body: (<>
        <OptionGrid options={BUYINS.includes(buyIn) ? BUYINS : [...BUYINS.slice(0, 5), buyIn]}
          value={buyIn} onPick={setBuyIn} render={(v) => <M v={v} cur={cur} />} />
        <CustomValue label="סכום אחר" suffix={cur} value={buyIn} onChange={(v) => setBuyIn(Math.round(v * 100) / 100)} />
      </>),
      ok: buyIn > 0,
    },
    {
      title: 'כמה צ\'יפים מקבלים?',
      sub: <>על כל כניסה של <M v={buyIn} cur={cur} className="font-bold text-white" />.</>,
      body: (<>
        <OptionGrid options={CHIP_OPTIONS.includes(chips) ? CHIP_OPTIONS : [...CHIP_OPTIONS.slice(0, 5), chips]}
          value={chips} onPick={setChips} render={(v) => <Chips v={v} />} />
        <CustomValue label="כמות אחרת" suffix="צ'יפים" value={chips} onChange={(v) => setChips(Math.round(v))} />
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center text-sm text-slate-300">
          צ'יפ אחד שווה <M v={buyIn / chips} cur={cur} className="font-bold text-white" />
        </div>
      </>),
      ok: chips > 0,
    },
    {
      title: 'מי משחק הערב?',
      sub: (chosen ? `${chosen.name} · ` : '') + (picked.length < 2 ? 'צריך לפחות שני שחקנים. אפשר להוסיף עוד גם אחר כך.' : `${picked.length} שחקנים · קופה פותחת ${numFmt(picked.length * buyIn)}${cur}`),
      body: (<>
        {!chosen && lastNight.some((p) => !isPicked(p.name)) && (
          <div className="mb-4 rounded-3xl border border-amber-300/30 bg-amber-400/[0.07] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-white">מהערב האחרון</span>
              <button onClick={() => { buzz(12); setPicked((cur) => [...cur, ...lastNight.filter((p) => !cur.some((c) => c.name.toLowerCase() === p.name.toLowerCase())).map((p) => ({ key: p.id, name: p.name, avatar: p.avatar }))]); }}
                className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-100">הוסף את כולם</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {lastNight.filter((p) => !isPicked(p.name)).map((p) => (
                <button key={p.id} onClick={() => { buzz(6); toggleKnown(p); }} className="glass-pill flex items-center gap-1.5 py-1 pl-3 pr-1 text-sm text-slate-100">
                  <Avatar avatar={p.avatar} size={26} /> {p.name} <Plus size={13} className="text-amber-200" />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNew()} placeholder="שם שחקן" className="text-input flex-1" />
          <button onClick={addNew} disabled={!name.trim() || isPicked(name.trim())} className="btn-primary px-4" aria-label="הוסף"><UserPlus size={20} /></button>
        </div>
        {contactsSupported() && (
          <button onClick={fromContacts} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 py-2.5 text-sm font-semibold text-cyan-100">
            <Contact size={17} /> בחירה מאנשי הקשר (שם + טלפון)
          </button>
        )}

        {picked.length > 0 && (
          <div className="mt-4 space-y-2">
            {avatarHint && <div className="text-xs text-slate-500">לחצו על הדמות כדי להחליף אותה</div>}
            {picked.map((p) => {
              const open = editing === p.key;
              return (
                <div key={p.key} className={`rounded-3xl border p-2 transition ${open ? 'border-cyan-300/50 bg-cyan-400/10' : 'border-emerald-300/40 bg-emerald-400/10'}`}>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setEditing(open ? null : p.key)} aria-label={`החלף דמות ל${p.name}`}
                      className="relative rounded-full bg-gradient-to-br from-amber-200 to-amber-500 p-[2px]">
                      <Avatar avatar={p.avatar} size={44} />
                      <span className="absolute -bottom-1 -left-1 rounded-full bg-night-900 p-1 text-cyan-300"><Pencil size={11} /></span>
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-white">{p.name}</span>
                      {(p.phone || state.players[p.key]?.phone) && <span dir="ltr" className="block text-right text-[11px] text-slate-400">📱 {prettyPhone(p.phone || state.players[p.key]?.phone)}</span>}
                    </span>
                    <button type="button" onClick={() => { setPicked((c) => c.filter((x) => x.key !== p.key)); if (open) setEditing(null); }}
                      aria-label={`הסר את ${p.name}`} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-rose-300"><X size={18} /></button>
                  </div>
                  {open && (
                    <div className="mt-3">
                      <AvatarGrid value={p.avatar} taken={usedAvatars} size={40}
                        onPick={(a) => { setPicked((c) => c.map((x) => (x.key === p.key ? { ...x, avatar: a } : x))); setEditing(null); }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {known.filter((p) => !isPicked(p.name)).length > 0 && (
          <>
            <div className="mb-2 mt-5 text-xs text-slate-500">שיחקו איתך בעבר</div>
            <div className="grid grid-cols-4 gap-2">
              {known.filter((p) => !isPicked(p.name)).slice(0, 12).map((p) => (
                <motion.button key={p.id} whileTap={{ scale: 0.9 }} onClick={() => toggleKnown(p)} className="flex flex-col items-center gap-1 rounded-2xl p-1.5 hover:bg-white/5">
                  <span className="relative"><Avatar avatar={p.avatar} size={48} /><span className="absolute -bottom-0.5 -left-0.5 rounded-full bg-emerald-400 p-0.5 text-night-950"><Plus size={11} strokeWidth={3} /></span></span>
                  <span className="max-w-full truncate text-[11px] text-slate-300">{p.name}</span>
                </motion.button>
              ))}
            </div>
          </>
        )}

      </>),
      ok: picked.length >= 2,
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col bg-night-950"
      initial={false}>
      <div className="pt-safe">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <button onClick={step === 0 ? onClose : () => go(-1)} aria-label={step === 0 ? 'סגור' : 'חזרה'} className="rounded-full p-2 text-slate-300 hover:bg-white/10">
            {step === 0 ? <X size={22} /> : <ArrowRight size={22} />}
          </button>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <motion.span key={i} animate={{ width: i === step ? 26 : 8, opacity: i <= step ? 1 : 0.35 }} className="h-2 rounded-full bg-emerald-400" />
            ))}
          </div>
          <div className="w-10 text-left text-xs text-slate-500">{step + 1}/{steps.length}</div>
        </div>
      </div>

      <div className="no-scrollbar mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-4">
        <motion.div key={step}
            initial={false}>
            <h2 className="mt-4 text-3xl font-black text-white">{s.title}</h2>
            <p className="mb-6 mt-1 text-sm text-slate-400">{s.sub}</p>
            {s.body}
          </motion.div>
      </div>

      <div className="pb-safe border-t border-white/10 bg-night-950/80">
        <div className="mx-auto max-w-md px-5 pt-3">
          <button disabled={!s.ok} onClick={last ? start : () => go(1)} className="btn-primary w-full text-lg">
            {last ? <><Users size={20} /> שבו לשולחן</> : <>המשך <ArrowLeft size={20} /></>}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
