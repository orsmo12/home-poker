import { useEffect, useMemo, useState } from 'react';
import { track } from '../lib/analytics';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, CheckSquare, Crown, History, Pencil, Trash2, Trophy, Users, AlertTriangle, Check, X } from 'lucide-react';
import { FELTS } from '../components/PokerTable';
import { Avatar } from '../components/Avatar';
import { BottomSheet, M, Segmented, StatTile, netTone } from '../components/ui';
import { computePlayerStats, toCents } from '../state/store';
import { useCloud } from '../cloud/CloudProvider';
import { CloudUpload, Check as CloudCheck, LineChart } from 'lucide-react';
import { Dashboard } from '../components/Dashboard';
import { EXPENSE_KINDS, ExpenseIcon } from '../components/Expenses';

const dateFmt = (iso) => new Date(iso).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = (iso) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const potOf = (g) => g.results.reduce((a, r) => a + toCents(r.buyIn), 0) / 100;

export const nightTitle = (g, tables) => g.title || tables?.[g.tableId]?.name || g.name || dateFmt(g.endedAt);

/** Rename a past night, rename its table, or move it to another table. */
function NightEditor({ game, tables, dispatch }) {
  const cloud = useCloud();
  const table = tables?.[game.tableId];
  const [edit, setEdit] = useState(null); // 'title' | 'table' | null
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const others = Object.values(tables || {}).filter((t) => t.id !== game.tableId);
  const save = async () => {
    const v = text.trim();
    if (edit === 'title') dispatch({ type: 'HISTORY_PATCH', id: game.id, patch: { title: v } });
    if (edit === 'table' && v && table) {
      dispatch({ type: 'TABLE_UPSERT', table: { id: table.id, name: v } });
      if (table.cloudId && cloud.signedIn) { try { await cloud.renameTable(table.cloudId, v); } catch { setErr('השם השתנה במכשיר, אבל לא בענן (רק מי שפתח את השולחן יכול לשנות שם).'); } }
    }
    setEdit(null);
  };
  return (
    <div className="space-y-2 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
      {edit ? (
        <div className="flex gap-2">
          <input autoFocus value={text} maxLength={40} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder={edit === 'title' ? 'למשל: הערב של יום ההולדת' : 'שם השולחן'} className="text-input flex-1 py-2" />
          <button onClick={save} aria-label="שמירה" className="btn-primary px-3 py-2"><Check size={18} /></button>
          <button onClick={() => setEdit(null)} aria-label="ביטול" className="btn-ghost px-3 py-2"><X size={18} /></button>
        </div>
      ) : (<>
        <button onClick={() => { setText(game.title || ''); setEdit('title'); }} className="flex w-full items-center gap-2 text-right">
          <span className="text-xs text-slate-500">שם הערב</span>
          <span className="min-w-0 flex-1 truncate font-bold text-white">{game.title || <span className="font-normal text-slate-500">בלי שם</span>}</span>
          <Pencil size={14} className="text-cyan-300" />
        </button>
        <button onClick={() => { setText(table?.name || ''); setEdit('table'); }} disabled={!table} className="flex w-full items-center gap-2 text-right">
          <span className="text-xs text-slate-500">שולחן</span>
          <span className="h-3 w-3 rounded-full border border-amber-200/50" style={{ background: (FELTS[table?.felt] || FELTS.green).swatch }} />
          <span className="min-w-0 flex-1 truncate font-bold text-white">{table?.name || game.name || 'השולחן שלי'}</span>
          <Pencil size={14} className="text-cyan-300" />
        </button>
      </>)}
      {!edit && others.length > 0 && !game.syncedAt && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-500">להעביר לשולחן אחר:</span>
          {others.slice(0, 8).map((t) => (
            <button key={t.id} onClick={() => dispatch({ type: 'HISTORY_PATCH', id: game.id, patch: { tableId: t.id } })}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200">{t.name}</button>
          ))}
        </div>
      )}
      {err && <p className="text-xs text-amber-200">{err}</p>}
    </div>
  );
}

function GameSheet({ game, players, tables, cur, dispatch, onClose }) {
  const [confirm, setConfirm] = useState(false);
  const av = (id) => players[id]?.avatar ?? 0;
  return (
    <BottomSheet open={!!game} onClose={() => { setConfirm(false); onClose(); }} title={game ? dateFmt(game.endedAt) : ''}>
      {game && (
        <div className="space-y-4">
          <NightEditor key={game.id} game={game} tables={tables} dispatch={dispatch} />
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatTile label="שעות"><span dir="ltr" className="whitespace-nowrap text-sm">{timeFmt(game.startedAt)}–{timeFmt(game.endedAt)}</span></StatTile>
            <StatTile label="שחקנים">{game.results.length}</StatTile>
            <StatTile label="קופה"><M v={potOf(game)} cur={cur} /></StatTile>
          </div>

          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-slate-400"><tr className="border-b border-white/10">
                <th className="px-3 py-2 text-right font-medium">שחקן</th><th className="px-2 py-2 font-medium">קנה</th><th className="px-2 py-2 font-medium">יצא עם</th><th className="px-3 py-2 font-medium">נטו</th>
              </tr></thead>
              <tbody>
                {[...game.results].sort((a, b) => b.net - a.net).map((r) => (
                  <tr key={r.playerId} className="border-t border-white/5 text-center">
                    <td className="px-3 py-2 text-right"><span className="flex items-center gap-2 font-medium text-white"><Avatar avatar={av(r.playerId)} size={22} />{r.name}</span></td>
                    <td className="px-2 py-2 text-slate-300"><M v={r.buyIn} cur={cur} /></td>
                    <td className="px-2 py-2 text-slate-300"><M v={r.cashOut} cur={cur} /></td>
                    <td className={`px-3 py-2 font-bold ${netTone(toCents(r.net))}`}><M v={r.net} signed cur={cur} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="mb-2 text-xs text-slate-500">{game.settlements.length ? 'העברות' : 'אין העברות, כולם יצאו באפס'}</div>
            <ul className="space-y-1.5">
              {game.settlements.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                  <Avatar avatar={av(p.fromId)} size={24} />
                  <span className="text-slate-200">{p.from} מעביר ל{p.to}</span>
                  <ArrowLeft size={14} className="text-emerald-300" />
                  <M v={p.amount} cur={cur} className="mr-auto font-black text-white" />
                </li>
              ))}
            </ul>
          </div>

          {game.expenses?.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-slate-500">הוצאות משותפות (כלולות בהעברות)</div>
              <ul className="space-y-1.5">
                {game.expenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                    <ExpenseIcon kind={e.kind} size={28} />
                    <span className="flex-1 text-slate-200">{e.label || EXPENSE_KINDS[e.kind]?.label} · שילם {e.paidByName}</span>
                    <M v={e.amount} cur={cur} className="font-bold text-white" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <GameCloudRow game={game} dispatch={dispatch} />

          {!confirm
            ? <button onClick={() => setConfirm(true)} className="w-full py-1 text-sm text-slate-500 hover:text-rose-300"><Trash2 size={14} className="inline" /> מחק משחק מההיסטוריה</button>
            : <div className="flex gap-2">
                <button onClick={() => setConfirm(false)} className="btn-ghost flex-1">השאר</button>
                <button onClick={() => { dispatch({ type: 'DELETE_GAME', id: game.id }); setConfirm(false); onClose(); }} className="btn-danger flex-1"><AlertTriangle size={16} /> כן, למחוק</button>
              </div>}
        </div>
      )}
    </BottomSheet>
  );
}

/** Cloud status of one night (only when signed in). */
function GameCloudRow({ game, dispatch }) {
  const cloud = useCloud();
  if (!cloud.signedIn) return null;
  const pending = !game.syncedAt && (game.groupId || game.cloud);
  if (game.syncedAt || pending) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
        {game.syncedAt ? <CloudCheck size={16} className="text-emerald-300" /> : <CloudUpload size={16} className="text-amber-300" />}
        <span className="flex-1 text-slate-300">
          {game.syncedAt ? 'שמור בענן ונכנס לסטטיסטיקה של כל השולחן' : game.syncError ? game.syncError : 'ממתין לסנכרון לענן'}
        </span>
        {game.syncError && <button onClick={() => dispatch({ type: 'HISTORY_PATCH', id: game.id, patch: { syncError: null } })} className="text-xs text-cyan-300">נסו שוב</button>}
      </div>
    );
  }
  return (
    <button onClick={() => dispatch({ type: 'HISTORY_PATCH', id: game.id, patch: { cloud: true, syncError: null } })}
      className="flex w-full items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
      <CloudUpload size={16} /> העלו את הערב הזה לענן (לסטטיסטיקה של כל השולחן)
    </button>
  );
}

export function HistoryScreen({ state, dispatch }) {
  const cur = state.settings.currency;
  const games = state.history.filter((h) => h.type === 'cash');
  const cloud = useCloud();
  const [view, setView] = useState('me');
  const unsynced = games.filter((g) => !g.syncedAt && !g.cloud && !g.groupId).length;
  const [openId, setOpenId] = useState(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const togglePick = (id) => setPicked((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const stopPicking = () => { setPicking(false); setPicked(new Set()); setConfirmDel(false); };
  const deletePicked = () => {
    const ids = [...picked];
    const synced = games.filter((g) => picked.has(g.id) && g.syncedAt).map((g) => g.id);
    dispatch({ type: 'DELETE_GAMES', ids });
    if (synced.length && cloud.signedIn) cloud.deleteGames(synced).catch(() => {});
    track('games_deleted', { count: ids.length });
    stopPicking();
  };
  const stats = useMemo(() => computePlayerStats(games), [games]);
  const totalPot = games.reduce((a, g) => a + potOf(g), 0);
  const av = (id) => state.players[id]?.avatar ?? 0;
  useEffect(() => { track('history_viewed', { games: games.length }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (games.length === 0 && !(cloud.allGames?.length)) {
    return (
      <motion.div initial={false} className="glass mx-auto mt-4 max-w-md p-8 text-center">
        <History className="mx-auto mb-3 text-emerald-300" size={40} />
        <h2 className="text-2xl font-black text-white">עוד אין משחקים</h2>
        <p className="mt-2 text-sm text-slate-400">בסוף כל ערב, אחרי הסליקה, לחצו על <b className="text-slate-200">"שמור וסגור משחק"</b>. המשחק יישמר כאן עם התוצאות וההעברות, וייכנס לסטטיסטיקה של כל שחקן.</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={false} className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-3xl font-black text-white">סטטיסטיקה</h2>
        <p className="text-sm text-slate-400">{games.length} משחקים · <M v={totalPot} cur={cur} /> עברו על השולחן</p>
      </div>

      <Segmented value={view} onChange={setView} options={[
        { id: 'me', label: 'שלי', icon: LineChart },
        { id: 'games', label: 'משחקים', icon: CalendarDays },
        { id: 'players', label: 'שחקנים', icon: Users },
      ]} />

      {view === 'me' && <Dashboard state={state} dispatch={dispatch} />}

      {view === 'games' && cloud.signedIn && unsynced > 0 && (
        <button onClick={() => games.forEach((g) => { if (!g.syncedAt && !g.cloud && !g.groupId) dispatch({ type: 'HISTORY_PATCH', id: g.id, patch: { cloud: true, syncError: null } }); })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 py-2.5 text-sm font-semibold text-emerald-100">
          <CloudUpload size={16} /> העלו {unsynced} ערבים קודמים לענן
        </button>
      )}

      {view === 'games' && games.length > 0 && (
        <div className="flex items-center justify-between">
          {picking ? (<>
            <button onClick={() => setPicked(picked.size === games.length ? new Set() : new Set(games.map((g) => g.id)))} className="text-sm font-semibold text-cyan-300">
              {picked.size === games.length ? 'נקה בחירה' : 'בחר הכל'}
            </button>
            <span className="text-sm text-slate-300">{picked.size} נבחרו</span>
            <button onClick={stopPicking} className="text-sm text-slate-400">סיום</button>
          </>) : (
            <button onClick={() => setPicking(true)} className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-cyan-300"><CheckSquare size={16} /> בחירה ומחיקה</button>
          )}
        </div>
      )}

      {view === 'games' && (
        <ul className={`space-y-2 ${picking ? 'pb-24' : ''}`}>
          {games.map((g, i) => {
            const top = [...g.results].sort((a, b) => b.net - a.net)[0];
            const on = picked.has(g.id);
            const tname = state.tables?.[g.tableId]?.name || g.name;
            return (
              <motion.li key={g.id} initial={false}>
                <button onClick={() => (picking ? togglePick(g.id) : setOpenId(g.id))}
                  className={`glass flex w-full items-center gap-3 p-3 text-right transition active:scale-[0.99] ${on ? 'ring-2 ring-rose-300/70' : ''}`}>
                  {picking && (
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${on ? 'border-rose-300 bg-rose-400 text-night-950' : 'border-white/30'}`}>{on && <Check size={15} strokeWidth={3} />}</span>
                  )}
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] leading-none">
                    <span className="text-lg font-black text-white">{new Date(g.endedAt).getDate()}</span>
                    <span className="text-[10px] text-slate-400">{new Date(g.endedAt).toLocaleDateString('he-IL', { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-white">{nightTitle(g, state.tables)}</div>
                    <div className="text-xs text-slate-400">{g.title && tname ? `${tname} · ` : ''}{new Date(g.endedAt).toLocaleDateString('he-IL', { weekday: 'short' })} · {g.results.length} שחקנים · קופה <M v={potOf(g)} cur={cur} /> · {g.settlements.length} העברות</div>
                  </div>
                  {top && top.net > 0 && (
                    <div className="flex shrink-0 flex-col items-center">
                      <div className="relative">
                        <Avatar avatar={av(top.playerId)} size={34} />
                        <Crown size={14} className="absolute -top-2 left-1/2 -translate-x-1/2 text-amber-300 drop-shadow" />
                      </div>
                      <M v={top.net} signed cur={cur} className="text-[11px] font-bold text-emerald-300" />
                    </div>
                  )}
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}

      {view === 'players' && (
        <ul className="space-y-2">
          {stats.map((p, i) => (
            <motion.li key={p.playerId} initial={false}
              className="glass flex items-center gap-3 p-3">
              <div className="relative">
                <Avatar avatar={av(p.playerId)} size={42} />
                {i === 0 && p.netC > 0 && <Trophy size={15} className="absolute -bottom-1 -left-1 rounded-full bg-night-900 p-0.5 text-amber-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-white">{p.name}</div>
                <div className="text-xs text-slate-400">
                  {p.games} משחקים · {p.wins} ברווח · שיא <M v={p.best} signed cur={cur} />
                </div>
              </div>
              <div className="text-left">
                <div className={`text-lg font-black ${netTone(p.netC)}`}><M v={p.net} signed cur={cur} /></div>
                <div className="text-[10px] text-slate-500">ממוצע <M v={p.net / p.games} signed cur={cur} /></div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      {picking && picked.size > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-[92px] z-[45] px-4">
          <div className="mx-auto flex max-w-md gap-2 rounded-3xl border border-rose-300/30 bg-[#1f1220] p-2 shadow-[0_12px_30px_rgba(0,0,0,.6)]">
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} className="btn-danger flex-1"><Trash2 size={18} /> מחיקת {picked.size} ערבים</button>
            ) : (<>
              <button onClick={() => setConfirmDel(false)} className="btn-ghost flex-1">ביטול</button>
              <button onClick={deletePicked} className="btn-danger flex-[2]"><AlertTriangle size={16} /> כן, למחוק {picked.size}</button>
            </>)}
          </div>
        </div>
      )}

      <GameSheet game={games.find((g) => g.id === openId)} players={state.players} tables={state.tables} cur={cur} dispatch={dispatch} onClose={() => setOpenId(null)} />
      {view !== 'me' && <p className="text-center text-[11px] text-slate-500">{cloud.signedIn ? 'ערבים שנשמרו כשמחוברים עולים לענן אוטומטית.' : 'ההיסטוריה נשמרת במכשיר הזה. התחברו כדי לגבות ולאחד סטטיסטיקה.'}</p>}
    </motion.div>
  );
}
