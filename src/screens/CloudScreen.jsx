/* "Profile & groups" — the optional cloud area. Opens as a full-screen layer over the
 * app; closing it returns exactly where you were. Nothing here is needed to play. */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Check, CloudOff, Copy, Crown, LogOut, Mail, RefreshCw, Share2, ShieldCheck,
  Trophy, Users, X, TrendingUp, Palette, Pencil, RotateCcw, Settings, Phone, Bell,
} from 'lucide-react';
import { useCloud } from '../cloud/CloudProvider';
import { appBaseUrl, cloudConfigured, emailAuthEnabled } from '../cloud/config';
import { cloudErrorText } from '../cloud/client';
import { AvatarGrid, ChipAvatar } from '../components/Avatar';
import { FELTS } from '../components/PokerTable';
import { Dashboard, useMyNights } from '../components/Dashboard';
import { buzz } from '../lib/haptics';
import { PhoneForm } from '../components/Engagement';
import { pushSupported } from '../cloud/push';
import { M, Segmented, netTone } from '../components/ui';


function useBusy() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn) => {
    setBusy(true); setErr('');
    try { return await fn(); } catch (e) { setErr(cloudErrorText(e)); return undefined; } finally { setBusy(false); }
  };
  return { busy, err, setErr, run };
}

function ErrorLine({ text }) {
  return text ? <p className="text-center text-sm text-rose-300">{text}</p> : null;
}

/* ------------------------------------------------------------ signed out */
function SignIn({ joinCode }) {
  const cloud = useCloud();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, err, run } = useBusy();
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-400/30 to-emerald-400/30 shadow-glow-emerald">
          <Users size={30} className="text-emerald-200" />
        </div>
        <h2 className="text-3xl font-black text-white">הפרופיל שלך</h2>
        <p className="mt-1 text-sm text-slate-400">כל הערבים מכל השולחנות נשמרים אוטומטית לסטטיסטיקה האישית שלך. אופציונלי: האפליקציה עובדת גם בלי.</p>
      </div>

      {joinCode && (
        <div className="rounded-3xl border border-emerald-300/40 bg-emerald-400/10 p-3 text-center text-sm text-emerald-50">
          הוזמנת לשולחן (קוד <b dir="ltr">{joinCode}</b>). התחברו, ותצטרפו אליה אוטומטית.
        </div>
      )}

      <ul className="glass space-y-2.5 p-4 text-sm text-slate-200">
        <li className="flex items-center gap-2.5"><TrendingUp size={17} className="text-emerald-300" /> גרף רווח/הפסד, שיאים וראש בראש מול כל חבר</li>
        <li className="flex items-center gap-2.5"><Trophy size={17} className="text-amber-300" /> טבלה משותפת לכל שולחן, בכל טלפון של החבר'ה</li>
        <li className="flex items-center gap-2.5"><Palette size={17} className="text-pink-300" /> דמות וצבע זוהר משלך, שכולם רואים</li>
      </ul>

      <button disabled={busy || !cloud.online} onClick={() => run(() => cloud.signInWithGoogle(joinCode ? `?join=${joinCode}` : '?cloud=1'))}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 font-bold text-slate-900 shadow-lg transition active:scale-[0.98] disabled:opacity-50">
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
        המשך עם Google
      </button>

      {emailAuthEnabled && (<>
      <div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10" />או עם קוד למייל<span className="h-px flex-1 bg-white/10" /></div>

      {!sent ? (
        <div className="flex gap-2">
          <input dir="ltr" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && emailOk && run(async () => { await cloud.sendCode(email); setSent(true); })}
            placeholder="name@email.com" className="text-input flex-1 text-left" />
          <button disabled={!emailOk || busy || !cloud.online} onClick={() => run(async () => { await cloud.sendCode(email); setSent(true); })} className="btn-primary px-4">
            <Mail size={18} /> שלח קוד
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-sm text-slate-300">שלחנו קוד ל־<b dir="ltr" className="text-white">{email.trim()}</b>. הקלידו אותו כאן:</p>
          <div className="flex gap-2">
            <input dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && run(() => cloud.verifyCode(email, code))}
              placeholder="••••••" className="text-input flex-1 text-center text-2xl tracking-[0.4em]" />
            <button disabled={code.length < 6 || busy} onClick={() => run(() => cloud.verifyCode(email, code))} className="btn-primary px-5"><Check size={18} /> אישור</button>
          </div>
          <button onClick={() => { setSent(false); setCode(''); }} className="w-full text-xs text-slate-500 hover:text-slate-300">שינוי כתובת / שליחה מחדש</button>
        </div>
      )}
      </>)}
      <ErrorLine text={err} />
      {!cloud.online && <p className="text-center text-xs text-amber-200">אין חיבור לאינטרנט. ההתחברות תתאפשר כשתחזור הרשת.</p>}
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500"><ShieldCheck size={13} /> רק מי שיושב בשולחן רואה את נתוני השולחן.</p>
    </div>
  );
}

/* ------------------------------------------------------------ my look (character + glow) */
const GLOWS = ['#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185', '#f59e0b', '#facc15', '#ffffff'];

function LookEditor({ onDone }) {
  const cloud = useCloud();
  const [avatar, setAvatar] = useState(cloud.profile?.avatar ?? 0);
  const [color, setColor] = useState(cloud.profile?.color || '#34d399');
  const [hex, setHex] = useState(cloud.profile?.color || '#34d399');
  const { busy, err, run } = useBusy();
  const validHex = /^#[0-9a-fA-F]{6}$/.test(hex);
  return (
    <div className="glass space-y-4 p-4">
      <div className="flex items-center gap-4">
        <ChipAvatar avatar={avatar} color={color} size={84} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white">הדמות שלך</div>
          <div className="text-xs text-slate-400">תופיע לכולם בשולחנות, בטבלאות, בהיסטוריה ובצפייה בשידור החי.</div>
        </div>
      </div>
      <AvatarGrid value={avatar} onPick={(a) => { setAvatar(a); buzz(8); }} size={42} />
      <div>
        <div className="mb-2 text-xs text-slate-400">צבע זוהר</div>
        <div className="flex flex-wrap items-center gap-2">
          {GLOWS.map((g) => (
            <button key={g} onClick={() => { setColor(g); setHex(g); buzz(6); }} aria-label={g}
              className={`h-8 w-8 rounded-full border-2 transition ${color.toLowerCase() === g ? 'scale-110 border-white' : 'border-transparent'}`}
              style={{ background: g, boxShadow: `0 0 12px ${g}88` }} />
          ))}
          <label className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-dashed border-white/30" aria-label="צבע מותאם">
            <input type="color" value={validHex ? hex : '#34d399'} onChange={(e) => { setHex(e.target.value); setColor(e.target.value); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            <Palette size={14} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-300" />
          </label>
          <input dir="ltr" value={hex} maxLength={7} onChange={(e) => { const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`; setHex(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(v); }}
            className={`text-input w-[104px] py-1.5 text-center font-mono text-sm ${validHex ? '' : 'border-rose-400/60'}`} />
        </div>
      </div>
      <ErrorLine text={err} />
      <div className="flex gap-2">
        <button onClick={onDone} className="btn-ghost flex-1">ביטול</button>
        <button disabled={busy || !validHex} onClick={() => run(async () => { await cloud.updateProfile({ avatar, color }); buzz([10, 30, 10]); onDone(); })} className="btn-primary flex-1"><Check size={18} /> שמירה</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ "which one is you?" */
/** After joining a table: pick your player, and every night you already played there joins your stats. */
function ClaimCard({ table }) {
  const cloud = useCloud();
  const [opts, setOpts] = useState(null);
  const [pick, setPick] = useState(null);
  const [done, setDone] = useState(null);
  const { busy, err, run } = useBusy();
  useEffect(() => {
    if (!table.cloudId || !cloud.ready || cloud.user?.cached) return;
    cloud.claimOptions(table.cloudId).then((o) => { setOpts(o); const m = o.find((x) => x.phone_match); if (m) setPick(m.id); }).catch(() => setOpts([]));
  }, [table.cloudId, cloud.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  if (done) return <div className="rounded-3xl border border-emerald-300/40 bg-emerald-400/10 p-3 text-sm text-emerald-50">מעולה! {done.games ? `${done.games} ערבים של ${done.name} נכנסו לסטטיסטיקה שלך.` : `מעכשיו כל ערב של ${done.name} ייכנס לסטטיסטיקה שלך.`}</div>;
  if (!opts?.length) return null;
  const chosen = opts.find((o) => o.id === pick);
  return (
    <div className="rounded-3xl border border-cyan-300/40 bg-cyan-400/[0.07] p-4">
      <div className="font-bold text-white">מי אתה בשולחן הזה?</div>
      <p className="mb-3 text-xs text-slate-400">בחרו את השם שלכם, וכל הערבים ששיחקתם כאן לפני שנרשמתם יתחברו לסטטיסטיקה שלכם.</p>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o.id} onClick={() => { buzz(6); setPick(o.id); }}
            className={`flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-sm transition ${pick === o.id ? 'border-cyan-300 bg-cyan-400/20 text-white' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
            <ChipAvatar avatar={o.avatar ?? 0} chip={0} size={26} /> {o.name}
            <span className="text-[10px] text-slate-500">{o.games}</span>
            {o.phone_match && <span className="rounded-full bg-emerald-400/20 px-1.5 text-[10px] text-emerald-200">המספר שלך</span>}
          </button>
        ))}
      </div>
      <ErrorLine text={err} />
      <button disabled={!chosen || busy} onClick={() => run(async () => { await cloud.claimPlayer(chosen.id, table.cloudId); buzz([10, 30, 10]); setDone(chosen); })}
        className="btn-primary mt-3 w-full">{chosen ? `זה אני: ${chosen.name}` : 'בחרו שם'}</button>
    </div>
  );
}

/* ------------------------------------------------------------ one table */
function TableView({ table, state, dispatch, cur, nights, onBack, onPlayAgain }) {
  const cloud = useCloud();
  const [copied, setCopied] = useState(false);
  const { busy, err, run } = useBusy();
  const group = table.cloudId ? cloud.groups.find((g) => g.id === table.cloudId) : null;
  const inviteUrl = group ? `${appBaseUrl()}?join=${group.invite_code}` : '';
  const mine = nights.filter((n) => n.tableKey === table.id || (table.cloudId && n.tableKey === `cloud:${table.cloudId}`));
  const board = useMemo(() => {
    const m = new Map();
    mine.forEach((n) => n.results.forEach((r) => {
      const k = r.name.trim().toLowerCase();
      const x = m.get(k) || { name: r.name, games: 0, net: 0, wins: 0 };
      x.games += 1; x.net += r.net; if (r.net > 0) x.wins += 1; m.set(k, x);
    }));
    return [...m.values()].sort((a, b) => b.net - a.net);
  }, [mine]);
  const me = new Set((state.settings.me || []).map((n) => n.trim().toLowerCase()));
  const pot = mine.reduce((a, n) => a + n.pot, 0);

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const rename = () => {
    const v = newName.trim(); if (!v) return;
    dispatch({ type: 'TABLE_UPSERT', table: { id: table.id, name: v } });
    if (table.cloudId && cloud.signedIn) run(() => cloud.renameTable(table.cloudId, v));
    setRenaming(false);
  };
  const setFelt = (felt) => {
    buzz(8);
    dispatch({ type: 'TABLE_UPSERT', table: { id: table.id, felt } });
    if (table.cloudId && cloud.signedIn) cloud.setTableFelt(table.cloudId, felt).catch(() => {});
  };
  const share = async () => {
    const text = `הצטרפו לשולחן הפוקר "${table.name}" ב-Home Poker 🃏\nכל הערבים, הטבלה והסטטיסטיקה שלכם במקום אחד:\n${inviteUrl}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ } };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="חזרה" className="rounded-full p-2 text-slate-300 hover:bg-white/10"><ArrowRight size={22} /></button>
        {renaming ? (
          <div className="flex min-w-0 flex-1 gap-2">
            <input autoFocus value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} className="text-input min-w-0 flex-1 py-2" />
            <button onClick={rename} disabled={!newName.trim()} aria-label="שמירה" className="btn-primary px-3 py-2"><Check size={18} /></button>
          </div>
        ) : (
          <button onClick={() => { setNewName(table.name); setRenaming(true); }} className="flex min-w-0 flex-1 items-center gap-2 text-right">
            <h2 className="truncate text-2xl font-black text-white">{table.name}</h2><Pencil size={16} className="shrink-0 text-cyan-300" />
          </button>
        )}
        {busy && <RefreshCw size={16} className="animate-spin text-slate-500" />}
      </div>

      <div className="relative overflow-hidden rounded-[28px] border-4 border-amber-900/60 p-4 shadow-[inset_0_0_40px_rgba(0,0,0,.6)]" style={{ background: (FELTS[table.felt] || FELTS.green).felt }}>
        <div className="flex items-center justify-around text-center">
          <div><div className="text-2xl font-black text-white drop-shadow">{mine.length}</div><div className="text-[11px] text-white/70">ערבים</div></div>
          <div><div className="text-2xl font-black text-white drop-shadow">{board.length}</div><div className="text-[11px] text-white/70">שחקנים</div></div>
          <div><div className="text-2xl font-black text-amber-200 drop-shadow"><M v={pot} cur={cur} /></div><div className="text-[11px] text-white/70">עבר על השולחן</div></div>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          {Object.entries(FELTS).map(([k, f]) => (
            <button key={k} onClick={() => setFelt(k)} aria-label={f.name}
              className={`h-8 w-8 rounded-full border-2 transition ${table.felt === k ? 'scale-110 border-amber-200' : 'border-white/30'}`} style={{ background: f.swatch }} />
          ))}
        </div>
      </div>

      {cloud.signedIn && table.cloudId && <ClaimCard table={table} />}

      {onPlayAgain && (
        <button onClick={() => { buzz(12); onPlayAgain(table.id); }} className="btn-primary w-full text-lg"><RotateCcw size={20} /> שחקו שוב בשולחן הזה</button>
      )}

      {cloud.signedIn && (group ? (
        <div className="glass flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-400">קוד הצטרפות לשולחן</div>
            <div dir="ltr" className="text-right text-2xl font-black tracking-[0.25em] text-white">{group.invite_code}</div>
          </div>
          <button onClick={copy} aria-label="העתק קישור" className="glass-pill p-2.5 text-slate-200">{copied ? <Check size={18} className="text-emerald-300" /> : <Copy size={18} />}</button>
          <button onClick={share} className="btn-primary px-4 py-2.5 text-sm"><Share2 size={16} /> הזמנה</button>
        </div>
      ) : (
        <button disabled={busy || !cloud.online} onClick={() => run(() => cloud.shareTable(table.id))}
          className="flex w-full items-center gap-3 rounded-3xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-right">
          <Share2 size={20} className="text-cyan-300" />
          <span className="flex-1"><span className="block font-bold text-white">הזמינו את החבר'ה לשולחן</span><span className="text-[11px] text-slate-400">השולחן עולה לענן, וכל אחד יראה את הטבלה והסטטיסטיקה שלו</span></span>
        </button>
      ))}

      <div>
        <div className="mb-2 flex items-center gap-1.5 px-1 text-sm font-bold text-white"><Trophy size={16} className="text-amber-300" /> טבלת השולחן</div>
        {board.length === 0 ? <p className="glass p-4 text-center text-sm text-slate-400">עוד אין ערבים בשולחן הזה.</p> : (
          <ul className="space-y-2">
            {board.map((p, i) => {
              const isMe = me.has(p.name.trim().toLowerCase());
              const look = cloud.tableProfiles.find((tp) => tp.group_id === table.cloudId && tp.name.trim().toLowerCase() === p.name.trim().toLowerCase());
              const localAv = Object.values(state.players).find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase())?.avatar ?? 0;
              return (
                <li key={p.name} className={`glass flex items-center gap-3 p-3 ${isMe ? 'ring-1 ring-emerald-300/50' : ''}`}>
                  <span className={`w-6 text-center text-sm font-black ${i === 0 ? 'text-amber-300' : 'text-slate-500'}`}>{i === 0 && p.net > 0 ? <Crown size={18} className="mx-auto" /> : i + 1}</span>
                  <ChipAvatar avatar={look?.avatar ?? localAv} chip={i} color={look?.color || ''} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-bold text-white">{p.name}{isMe && <span className="rounded-full bg-emerald-400/20 px-1.5 text-[10px] text-emerald-200">אני</span>}</div>
                    <div className="text-[11px] text-slate-400">{p.games} ערבים · {Math.round((p.wins / p.games) * 100)}% ברווח</div>
                  </div>
                  <div className={`text-lg font-black ${netTone(p.net)}`}><M v={p.net} signed cur={cur} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ErrorLine text={err} />
      {group
        ? <button onClick={() => run(async () => { await cloud.leaveGroup(group.id); dispatch({ type: 'TABLE_UPSERT', table: { id: table.id, cloudId: null } }); onBack(); })} className="w-full py-1 text-xs text-slate-500 hover:text-rose-300">עזיבת השולחן בענן</button>
        : <button onClick={() => { dispatch({ type: 'TABLE_REMOVE', id: table.id }); onBack(); }} className="w-full py-1 text-xs text-slate-500 hover:text-rose-300">הסרת השולחן מהרשימה (הערבים נשארים בהיסטוריה)</button>}
    </div>
  );
}

/* ------------------------------------------------------------ tables list */
function TablesList({ state, dispatch, cur, nights, onPlayAgain, joinCode, onJoined }) {
  const cloud = useCloud();
  const [open, setOpen] = useState(null);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState(joinCode || '');
  const [joined, setJoined] = useState(null);
  const { busy, err, run } = useBusy();

  useEffect(() => {
    if (!joinCode || !cloud.ready || cloud.user?.cached) return;
    run(async () => { const g = await cloud.joinGroup(joinCode); onJoined?.(); if (g?.id) setJoined(g.id); });
  }, [joinCode, cloud.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // open the table I just joined as soon as it lands in my list (so I can say "this is me")
  useEffect(() => {
    if (!joined) return;
    const local = Object.values(state.tables || {}).find((t) => t.cloudId === joined);
    if (local) { setOpen(local.id); setJoined(null); }
  }, [joined, state.tables]);

  const tables = Object.values(state.tables || {}).sort((a, b) => String(b.lastPlayed || '').localeCompare(String(a.lastPlayed || '')));
  const table = open && state.tables?.[open];
  if (table) return <TableView table={table} state={state} dispatch={dispatch} cur={cur} nights={nights} onBack={() => setOpen(null)} onPlayAgain={onPlayAgain} />;
  const count = (t) => nights.filter((n) => n.tableKey === t.id || (t.cloudId && n.tableKey === `cloud:${t.cloudId}`)).length;

  return (
    <div className="space-y-3">
      {tables.length === 0 && <p className="glass p-4 text-center text-sm text-slate-400">עוד אין שולחנות. כל משחק חדש נפתח בשולחן, ואפשר לחזור אליו בלחיצה.</p>}
      <ul className="space-y-2">
        {tables.map((t) => (
          <li key={t.id}>
            <button onClick={() => setOpen(t.id)} className="glass flex w-full items-center gap-3 p-3 text-right active:scale-[0.99]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-300/50 text-white/80 shadow-[inset_0_2px_8px_rgba(0,0,0,.5)]" style={{ background: (FELTS[t.felt] || FELTS.green).felt }}>♠</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-white">{t.name}</span>
                <span className="text-[11px] text-slate-400">{count(t)} ערבים{t.cloudId ? ' · משותף ☁︎' : ' · במכשיר'}</span>
              </span>
              <ArrowRight size={18} className="rotate-180 text-slate-500" />
            </button>
          </li>
        ))}
      </ul>
      {cloud.signedIn && (joining ? (
        <div className="glass space-y-3 p-4">
          <div className="font-bold text-white">הצטרפות לשולחן עם קוד</div>
          <input autoFocus dir="ltr" value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="ABC123" className="text-input text-center text-xl tracking-[0.3em]" />
          <div className="flex gap-2">
            <button onClick={() => { setJoining(false); setCode(''); }} className="btn-ghost flex-1">ביטול</button>
            <button disabled={!code.trim() || busy || !cloud.online} onClick={() => run(async () => { const g = await cloud.joinGroup(code); setJoining(false); setCode(''); if (g?.id) setJoined(g.id); })} className="btn-primary flex-1">הצטרפות</button>
          </div>
        </div>
      ) : (
        <button disabled={!cloud.online} onClick={() => setJoining(true)} className="btn-ghost w-full"><Users size={18} /> יש לי קוד לשולחן של חברים</button>
      ))}
      <ErrorLine text={err} />
    </div>
  );
}

/* ------------------------------------------------------------ phone + notifications */
function PhoneAndAlerts() {
  const cloud = useCloud();
  const [editing, setEditing] = useState(false);
  const [perm, setPerm] = useState(() => (pushSupported() ? Notification.permission : 'unsupported'));
  const { busy, err, run } = useBusy();
  useEffect(() => { if (cloud.ready && !cloud.user?.cached) cloud.loadMyPhone().catch(() => {}); }, [cloud.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = cloud.myPhone;
  return (
    <div className="glass space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Phone size={17} className="text-emerald-300" />
        <span className="flex-1 font-bold text-white">טלפון</span>
        {p && !editing && <button onClick={() => setEditing(true)} className="text-xs text-cyan-300">שינוי</button>}
      </div>
      {p && !editing ? (
        <div className="text-sm text-slate-300">
          <span dir="ltr">•••-•••-{p.last4}</span>{p.verified && <span className="mr-2 text-emerald-300">✓ מאומת</span>}
          <div className="mt-1 text-[11px] text-slate-500">{p.discoverable ? 'מי שמושיב אותך בשולחן לפי המספר יקשר אותך אוטומטית.' : 'מוסתר: אי אפשר למצוא אותך לפי המספר.'}</div>
          <div className="mt-2 flex gap-3 text-xs">
            <button disabled={busy} onClick={() => run(() => cloud.setMyPhone(null))} className="text-rose-300">מחיקת המספר</button>
          </div>
        </div>
      ) : (
        <PhoneForm compact onDone={() => setEditing(false)} />
      )}
      <div className="flex items-center gap-2 border-t border-white/10 pt-3">
        <Bell size={17} className="text-amber-300" />
        <span className="flex-1 text-sm text-slate-200">התראה כשמושיבים אותי במשחק</span>
        {perm === 'granted' ? <span className="text-xs text-emerald-300">פעיל</span>
          : perm === 'denied' ? <span className="text-[11px] text-slate-500">חסום בהגדרות הדפדפן · נציג הזמנה כשתפתחו את האפליקציה</span>
          : perm === 'unsupported' ? <span className="text-[11px] text-slate-500">לא נתמך כאן (באייפון: אחרי התקנה למסך הבית)</span>
          : <button disabled={busy} onClick={() => run(async () => setPerm(await cloud.enablePush()))} className="btn-primary px-3 py-1.5 text-sm">הפעלה</button>}
      </div>
      <ErrorLine text={err} />
    </div>
  );
}

/* ------------------------------------------------------------ signed in: profile */
function Profile({ state, dispatch, cur, joinCode, onJoined, onPlayAgain }) {
  const cloud = useCloud();
  const { nights } = useMyNights(state);
  const [tab, setTab] = useState(joinCode ? 'tables' : 'stats');
  const [look, setLook] = useState(false);
  const [name, setName] = useState('');
  const [editName, setEditName] = useState(false);
  const { err, run } = useBusy();

  return (
    <div className="space-y-4">
      {look ? <LookEditor onDone={() => setLook(false)} /> : (
        <div className="glass flex items-center gap-3 p-3">
          <button onClick={() => setLook(true)} aria-label="עיצוב הדמות" className="relative">
            <ChipAvatar avatar={cloud.profile?.avatar ?? 0} color={cloud.profile?.color || '#34d399'} size={58} />
            <span className="absolute -bottom-1 -left-1 rounded-full bg-night-900 p-1 text-cyan-300"><Pencil size={12} /></span>
          </button>
          <div className="min-w-0 flex-1">
            {editName ? (
              <div className="flex gap-2">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="text-input flex-1 py-2" placeholder="השם שלך" />
                <button disabled={!name.trim()} onClick={() => run(async () => { await cloud.updateName(name); setEditName(false); })} className="btn-primary px-3 py-2"><Check size={16} /></button>
              </div>
            ) : (
              <button onClick={() => { setName(cloud.profile?.display_name || ''); setEditName(true); }} className="block truncate text-right font-bold text-white">
                {cloud.profile?.display_name || 'הפרופיל שלי'} <span className="text-[11px] font-normal text-cyan-300">עריכה</span>
              </button>
            )}
            <button onClick={() => setLook(true)} className="text-[11px] text-cyan-300">עיצוב הדמות והזוהר</button>
            <div dir="ltr" className="truncate text-right text-[11px] text-slate-500">{cloud.user?.email || ''}</div>
          </div>
          <button onClick={() => run(() => cloud.signOut())} aria-label="התנתקות" className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-rose-300"><LogOut size={18} /></button>
        </div>
      )}
      <ErrorLine text={err} />
      {!look && <PhoneAndAlerts />}

      {(cloud.pendingCount > 0 || cloud.failedCount > 0) && (
        <div className="rounded-3xl border border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-50">
          {cloud.pendingCount > 0 && <div>{cloud.syncing ? 'מסנכרן…' : `${cloud.pendingCount} ערבים ממתינים לסנכרון${cloud.online ? '' : ' (כשתחזור הרשת)'}`}</div>}
          {cloud.failedCount > 0 && <button onClick={cloud.retryFailed} className="underline">{cloud.failedCount} ערבים לא עלו. נסו שוב</button>}
        </div>
      )}

      <Segmented value={tab} onChange={setTab} options={[{ id: 'stats', label: 'הסטטיסטיקה שלי', icon: TrendingUp }, { id: 'tables', label: `שולחנות (${Object.keys(state.tables || {}).length})`, icon: Users }]} />
      {tab === 'stats' && <Dashboard state={state} dispatch={dispatch} />}
      {tab === 'tables' && <TablesList state={state} dispatch={dispatch} cur={cur} nights={nights} onPlayAgain={onPlayAgain} joinCode={joinCode} onJoined={onJoined} />}
    </div>
  );
}

/* ------------------------------------------------------------ screen */
export function CloudScreen({ onClose, joinCode, cur, state, dispatch, onPlayAgain, settings }) {
  const [showSettings, setShowSettings] = useState(!cloudConfigured);
  const cloud = useCloud();
  const [pendingJoin, setPendingJoin] = useState(joinCode || '');
  useEffect(() => { cloud.boot(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night-950" role="dialog" aria-label="הפרופיל שלי">
      <div className="pt-safe border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <span className="text-sm font-bold text-slate-300">Home Poker · הפרופיל שלי</span>
          <button onClick={onClose} aria-label="סגור" className="rounded-full p-2 text-slate-300 hover:bg-white/10"><X size={22} /></button>
        </div>
      </div>
      <div className="no-scrollbar mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-10 pt-5">
        {!cloud.online && cloud.signedIn && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
            <CloudOff size={15} /> אין חיבור. מוצג המידע האחרון ששמור במכשיר.
          </div>
        )}
        {!cloud.configured ? null : cloud.signedIn
          ? <Profile state={state} dispatch={dispatch} cur={cur} joinCode={pendingJoin} onJoined={() => setPendingJoin('')} onPlayAgain={onPlayAgain} />
          : cloud.booting && !cloud.ready ? <p className="py-20 text-center text-sm text-slate-500">טוען…</p>
            : <SignIn joinCode={pendingJoin} />}
        {settings && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <button onClick={() => setShowSettings((v) => !v)} className="flex w-full items-center justify-between py-2 text-right font-bold text-white">
              <span className="flex items-center gap-2"><Settings size={18} className="text-slate-400" /> הגדרות</span>
              <span className="text-xs text-slate-500">{showSettings ? 'הסתר' : 'מטבע, כניסה, כיסאות'}</span>
            </button>
            {showSettings && <div className="pt-3">{settings}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
