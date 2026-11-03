/* Personal poker dashboard: P/L curve, instant filters, records, head-to-head with smart tags.
 * Pure client-side: recomputed from every night we know (this device + every cloud table). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Check, Flame, Pencil, Snowflake, Trophy, TrendingDown, TrendingUp, Users, Wallet, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { FELTS } from './PokerTable';
import { M, netTone } from './ui';
import { buildNights, computeDashboard, suggestMe } from '../state/stats';
import { useCloud } from '../cloud/CloudProvider';
import { buzz } from '../lib/haptics';
import { useHint } from '../lib/hints';

const lc = (s) => String(s || '').trim().toLowerCase();
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '');

/** Every night + "me", shared by the dashboard and the profile screen. */
export function useMyNights(state) {
  const cloud = useCloud();
  const loaded = useRef(false);
  useEffect(() => {
    if (cloud.signedIn && cloud.ready && !loaded.current) { loaded.current = true; cloud.loadAllGames?.().catch(() => {}); }
  }, [cloud.signedIn, cloud.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const nights = useMemo(() => buildNights({
    history: state.history, tables: state.tables, cloudGames: cloud.allGames, cloudPlayers: cloud.allPlayers, cloudGroups: cloud.groups,
  }), [state.history, state.tables, cloud.allGames, cloud.allPlayers, cloud.groups]);

  const claimed = useMemo(() => (cloud.user ? cloud.allPlayers.filter((p) => p.claimed_by === cloud.user.id).map((p) => p.name) : []),
    [cloud.allPlayers, cloud.user]);
  const meNames = useMemo(() => {
    const out = new Map();
    [...(state.settings.me || []), ...claimed].forEach((n) => n && out.set(lc(n), n));
    return [...out.values()];
  }, [state.settings.me, claimed]);

  const avatarOf = useMemo(() => {
    const m = new Map();
    cloud.allPlayers.forEach((p) => m.set(lc(p.name), p.avatar ?? 0));
    Object.values(state.players).forEach((p) => m.set(lc(p.name), p.avatar ?? 0));
    cloud.tableProfiles.forEach((p) => { if (p.avatar != null) m.set(lc(p.name), p.avatar); });
    return (name) => m.get(lc(name)) ?? 0;
  }, [state.players, cloud.allPlayers, cloud.tableProfiles]);

  return { nights, meNames, avatarOf, cloud };
}

/* ------------------------------------------------------------------ chart */
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function ProfitChart({ series, cur }) {
  const W = 340, H = 170, PX = 6, PY = 14;
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const data = [{ cum: 0, at: null, net: 0, table: '' }, ...series];
  const vals = data.map((d) => d.cum);
  let max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  if (max === min) { max += 1; min -= 1; }
  const x = (i) => PX + (i * (W - 2 * PX)) / Math.max(1, data.length - 1);
  const y = (v) => PY + ((max - v) * (H - 2 * PY)) / (max - min);
  const pts = data.map((d, i) => [x(i), y(d.cum)]);
  const zeroY = y(0);
  const zeroOff = Math.max(0, Math.min(1, (zeroY - 0) / H));
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1][0]},${zeroY} L${pts[0][0]},${zeroY} Z`;

  const pick = (e) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const rel = (e.clientX - r.left) / r.width; // svg is LTR (time flows left → right)
    const i = Math.round(rel * (data.length - 1));
    setHover(Math.max(1, Math.min(data.length - 1, i)));
  };
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg ref={ref} dir="ltr" viewBox={`0 0 ${W} ${H}`} className="block h-[170px] w-full touch-none select-none"
        onPointerDown={pick} onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && pick(e)} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="pl-stroke" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
            <stop offset={zeroOff} stopColor="#34d399" /><stop offset={zeroOff} stopColor="#fb7185" />
          </linearGradient>
          <linearGradient id="pl-fill" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#34d399" stopOpacity=".35" />
            <stop offset={zeroOff} stopColor="#34d399" stopOpacity=".04" />
            <stop offset={zeroOff} stopColor="#fb7185" stopOpacity=".04" />
            <stop offset="1" stopColor="#fb7185" stopOpacity=".35" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,.18)" strokeDasharray="3 4" />
        <path d={area} fill="url(#pl-fill)" />
        <path d={line} fill="none" stroke="url(#pl-stroke)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.4))' }} />
        {data.length <= 40 && pts.slice(1).map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="2.4" fill={data[i + 1].net >= 0 ? '#34d399' : '#fb7185'} opacity=".85" />
        ))}
        {h && (
          <g>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1="0" y2={H} stroke="rgba(255,255,255,.3)" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="5.5" fill="#0b1020" stroke={h.cum >= 0 ? '#34d399' : '#fb7185'} strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl border border-white/10 bg-night-900/95 px-3 py-1.5 text-center text-xs shadow-lg">
          <div className="text-slate-400">{shortDate(h.at)} · {h.table}</div>
          <div><M v={h.net} signed cur={cur} className={`font-bold ${netTone(h.net)}`} /> <span className="text-slate-500">· מצטבר</span> <M v={h.cum} signed cur={cur} className="font-bold text-white" /></div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bits */
function Signal({ level }) {
  return (
    <span className="inline-flex items-end gap-[2px]" aria-label={`חפיפה ${level} מתוך 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`w-[3px] rounded-sm ${i <= level ? 'bg-cyan-300' : 'bg-white/15'}`} style={{ height: 3 + i * 2.2 }} />
      ))}
    </span>
  );
}

const TONE = {
  emerald: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  rose: 'border-rose-300/40 bg-rose-400/15 text-rose-100',
  cyan: 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100',
  amber: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
};

function Pill({ on, onClick, children, felt }) {
  return (
    <button type="button" onClick={() => { buzz(6); onClick(); }}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${on
        ? 'border-emerald-300/60 bg-emerald-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-500 line-through decoration-slate-600'}`}>
      {felt && <span className="h-3 w-3 rounded-full border border-amber-200/50" style={{ background: (FELTS[felt] || FELTS.green).swatch }} />}
      {children}
    </button>
  );
}

function Record({ icon: Icon, tone, label, children, sub }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
      <div className={`mb-1 flex items-center gap-1.5 text-[11px] ${tone}`}><Icon size={14} />{label}</div>
      <div className="text-lg font-black text-white">{children}</div>
      {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ "who am I" */
export function MePicker({ nights, meNames, dispatch, settingsMe, cloud, compact }) {
  const [open, setOpen] = useState(!meNames.length);
  const suggestions = useMemo(() => suggestMe(nights, [cloud.profile?.display_name || '']).slice(0, 12), [nights, cloud.profile]);
  const mine = new Set((settingsMe || []).map(lc));
  const toggle = (name) => {
    buzz(8);
    const next = mine.has(lc(name)) ? (settingsMe || []).filter((n) => lc(n) !== lc(name)) : [...(settingsMe || []), name];
    dispatch({ type: 'SETTINGS_UPDATE', patch: { me: next } });
  };
  if (!suggestions.length) return null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-slate-400">
        <Pencil size={12} /> הנתונים של: <b className="text-slate-200">{meNames.join(', ')}</b>
      </button>
    );
  }
  return (
    <div className={`rounded-3xl border border-cyan-300/30 bg-cyan-400/[0.06] p-4 ${compact ? '' : ''}`}>
      <div className="font-bold text-white">מי אתה בשולחן?</div>
      <div className="mb-3 text-xs text-slate-400">בחרו את השם (או השמות) שלכם, והסטטיסטיקה האישית תיבנה מכל הערבים.</div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s.name} onClick={() => toggle(s.name)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${mine.has(lc(s.name)) ? 'border-cyan-300 bg-cyan-400/20 text-white' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
            {mine.has(lc(s.name)) && <Check size={13} />}{s.name}<span className="text-[10px] text-slate-500">{s.games}</span>
          </button>
        ))}
      </div>
      {meNames.length > 0 && <button onClick={() => setOpen(false)} className="btn-primary mt-3 w-full py-2">זה אני</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ dashboard */
export function Dashboard({ state, dispatch }) {
  const barsHint = useHint('bars', 3);
  const cur = state.settings.currency;
  const { nights, meNames, avatarOf, cloud } = useMyNights(state);
  const [offTables, setOffTables] = useState(() => new Set());
  const [withPlayers, setWithPlayers] = useState(() => new Set());
  const [showAllOpp, setShowAllOpp] = useState(false);

  const d = useMemo(() => computeDashboard(nights, meNames, { offTables, withPlayers }), [nights, meNames, offTables, withPlayers]);
  const toggleSet = (setter, key) => setter((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  if (!meNames.length) {
    return <MePicker nights={nights} meNames={meNames} dispatch={dispatch} settingsMe={state.settings.me} cloud={cloud} />;
  }

  const t = d.totals;
  const r = d.records;
  const filtered = offTables.size > 0 || withPlayers.size > 0;
  const opp = showAllOpp ? d.opponents : d.opponents.slice(0, 6);

  return (
    <div className="space-y-4">
      <MePicker nights={nights} meNames={meNames} dispatch={dispatch} settingsMe={state.settings.me} cloud={cloud} />

      {/* hero */}
      <div className="glass relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-0"
          style={{ background: `radial-gradient(circle, ${t.net >= 0 ? '#10b981' : '#f43f5e'} 0%, transparent 70%)` }} />
        <div className="relative flex items-end justify-between gap-2">
          <div>
            <div className="text-xs text-slate-400">{filtered ? 'רווח / הפסד (מסונן)' : 'רווח / הפסד כולל'}</div>
            <div className={`text-4xl font-black ${netTone(t.net)}`}><M v={t.net} signed cur={cur} /></div>
            <div className="mt-0.5 text-xs text-slate-400">{t.games} ערבים · ממוצע <M v={t.avg} signed cur={cur} /></div>
          </div>
          {t.streakNow !== 0 && (
            <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${t.streakNow > 0 ? 'bg-amber-400/15 text-amber-200' : 'bg-sky-400/15 text-sky-200'}`}>
              {t.streakNow > 0 ? <Flame size={14} /> : <Snowflake size={14} />}
              {Math.abs(t.streakNow)} {t.streakNow > 0 ? 'ניצחונות ברצף' : 'הפסדים ברצף'}
            </div>
          )}
        </div>
        {d.series.length > 0
          ? <div className="mt-3"><ProfitChart series={d.series} cur={cur} /></div>
          : <div className="py-10 text-center text-sm text-slate-500">אין ערבים שמתאימים לסינון</div>}
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/[0.04] py-2"><div className="text-lg font-black text-white">{Math.round(t.winRate * 100)}%</div><div className="text-[10px] text-slate-400">ערבים ברווח</div></div>
          <div className="rounded-2xl bg-white/[0.04] py-2"><div className={`text-lg font-black ${netTone(t.roi)}`} dir="ltr">{t.roi > 0 ? '+' : ''}{Math.round(t.roi * 100)}%</div><div className="text-[10px] text-slate-400">תשואה (ROI)</div></div>
          <div className="rounded-2xl bg-white/[0.04] py-2"><div className="text-lg font-black text-white"><M v={t.totalIn} cur={cur} /></div><div className="text-[10px] text-slate-400">הושקע</div></div>
        </div>
      </div>

      {/* filters */}
      {(d.tables.length > 1 || d.players.length > 0) && (
        <div className="space-y-2">
          {d.tables.length > 1 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {d.tables.map((tb) => (
                <Pill key={tb.key} felt={tb.felt} on={!offTables.has(tb.key)} onClick={() => toggleSet(setOffTables, tb.key)}>{tb.name}</Pill>
              ))}
            </div>
          )}
          {d.players.length > 0 && (
            <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500"><Users size={13} /> רק ערבים עם</span>
              {d.players.slice(0, 20).map((p) => {
                const on = withPlayers.has(lc(p.name));
                return (
                  <button key={p.name} onClick={() => { buzz(6); toggleSet(setWithPlayers, lc(p.name)); }}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-[13px] transition active:scale-95 ${on ? 'border-cyan-300/70 bg-cyan-400/20 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}>
                    <Avatar avatar={avatarOf(p.name)} size={22} />{p.name}
                  </button>
                );
              })}
              {filtered && (
                <button onClick={() => { setOffTables(new Set()); setWithPlayers(new Set()); }} className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] text-rose-300">
                  <X size={13} /> נקה
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* records */}
      {t.games > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 px-1 text-sm font-bold text-white"><Trophy size={16} className="text-amber-300" /> השיאים שלך</div>
          <div className="grid grid-cols-2 gap-2">
            <Record icon={TrendingUp} tone="text-emerald-300" label="הערב הכי טוב" sub={r.best && `${shortDate(r.best.night.endedAt)} · ${r.best.night.tableName}`}>
              <M v={r.best?.net || 0} signed cur={cur} className="text-emerald-300" />
            </Record>
            <Record icon={TrendingDown} tone="text-rose-300" label="הערב הכי קשה" sub={r.worst && `${shortDate(r.worst.night.endedAt)} · ${r.worst.night.tableName}`}>
              <M v={r.worst?.net || 0} signed cur={cur} className={r.worst?.net < 0 ? 'text-rose-300' : ''} />
            </Record>
            <Record icon={Flame} tone="text-amber-300" label="רצף ניצחונות" sub={r.worstStreak ? `רצף הפסדים הכי ארוך: ${r.worstStreak}` : null}>
              {r.bestStreak} ערבים
            </Record>
            <Record icon={Wallet} tone="text-cyan-300" label="הקופה הכי גדולה" sub={r.biggestPot && `${shortDate(r.biggestPot.night.endedAt)} · ${r.biggestPot.night.tableName}`}>
              <M v={r.biggestPot?.pot || 0} cur={cur} />
            </Record>
          </div>
        </div>
      )}

      {/* head to head */}
      {d.opponents.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-sm font-bold text-white"><Award size={16} className="text-cyan-300" /> ראש בראש</span>
            {barsHint && <span className="text-[10px] text-slate-500">פסים = כמה שיחקתם יחד</span>}
          </div>
          <ul className="space-y-2">
            {opp.map((o) => (
              <motion.li key={o.name} initial={false} className="glass flex items-center gap-3 p-3">
                <Avatar avatar={avatarOf(o.name)} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-white">{o.name}</span>
                    <Signal level={o.overlap} />
                  </div>
                  <div className="text-[11px] text-slate-400">{o.shared} ערבים יחד · ניצח אותך ב-{o.beatMe}</div>
                  {o.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.tags.map((tg) => <span key={tg.id} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[tg.tone]}`}>{tg.emoji} {tg.label}</span>)}
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <div className={`font-black ${netTone(o.transfers)}`}><M v={o.transfers} signed cur={cur} /></div>
                  <div className="text-[10px] text-slate-500">{o.transfers > 0 ? 'שילם לך' : o.transfers < 0 ? 'שילמת לו' : 'תיקו בהעברות'}</div>
                </div>
              </motion.li>
            ))}
          </ul>
          {d.opponents.length > 6 && (
            <button onClick={() => setShowAllOpp((v) => !v)} className="mt-2 w-full py-1 text-sm text-cyan-300">{showAllOpp ? 'הצג פחות' : `הצג את כל ה-${d.opponents.length}`}</button>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-500">
        {cloud.signedIn ? 'כולל כל הערבים מכל השולחנות שלך בענן.' : 'מבוסס על הערבים שנשמרו במכשיר הזה. התחברו כדי לאחד מכל השולחנות.'}
      </p>
    </div>
  );
}
