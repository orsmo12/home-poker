/* Read-only viewer for a shared game.
 *   ?view=TOKEN  → live: polls the host's latest snapshot every few seconds.
 *   #snap=DATA   → a frozen snapshot carried inside the link (no server needed).
 * It never reads or writes this device's own games. */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Eye, Home, PlayCircle, Radio, Trophy, UserPlus, X } from 'lucide-react';
import { PokerTable } from '../components/PokerTable';
import { ChipAvatar } from '../components/Avatar';
import { Chips, M, StatTile, netTone } from '../components/ui';
import { computeNets, computeSettlements, withExpenses, byInvested, entriesOf, fromCents, seatChip, validateZeroSum } from '../state/store';
import { decodeSnap, fetchLive, snapshotToGame } from '../cloud/live';
import { appBaseUrl, cloudConfigured } from '../cloud/config';
import { track } from '../lib/analytics';

const POLL_MS = 4000;
const ago = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return 'עכשיו';
  if (s < 60) return `לפני ${s} שניות`;
  const m = Math.round(s / 60);
  return m < 60 ? `לפני ${m} דק׳` : `לפני ${Math.round(m / 60)} שע׳`;
};

function useSharedGame() {
  const [state, setState] = useState(() => {
    const token = new URLSearchParams(window.location.search).get('view');
    if (token) return { mode: 'live', token, snap: null, group: null, status: 'loading' };
    const snap = decodeSnap(window.location.hash.slice('#snap='.length));
    return { mode: 'snap', snap, status: snap ? 'ok' : 'bad' };
  });

  useEffect(() => {
    if (state.mode !== 'live') return undefined;
    if (!cloudConfigured) { setState((s) => ({ ...s, status: 'bad' })); return undefined; }
    let stop = false, timer;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const data = await fetchLive(state.token);
          if (stop) return;
          if (!data) setState((s) => ({ ...s, status: s.snap ? 'ok' : 'bad' }));
          else setState((s) => ({ ...s, snap: data.snapshot, group: data.group, status: 'ok', offline: false }));
        } catch {
          if (!stop) setState((s) => ({ ...s, offline: true, status: s.snap ? 'ok' : 'loading' }));
        }
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [state.mode, state.token]);

  return state;
}

export default function ViewerApp() {
  const shared = useSharedGame();
  const [ctaOpen, setCtaOpen] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  useEffect(() => { track('live_viewed', { mode: shared.mode }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const snap = shared.snap;
  const game = useMemo(() => (snap ? snapshotToGame(snap) : null), [snap]);
  const cur = snap?.cur || '₪';
  const v = game ? validateZeroSum(game) : null;
  const showSettle = v && (snap.ph === 'settle' || (snap.ph === 'cashout' && v.balanced)) && v.balanced;
  const settlements = showSettle ? computeSettlements(withExpenses(computeNets(v), game)) : [];

  // Remember this live game, so after signing up the app offers a way back to it while it's still on.
  const rememberReturn = () => {
    if (shared.mode === 'live' && shared.token && !snap?.end) {
      try { window.localStorage.setItem('hpm-return-view', JSON.stringify({ token: shared.token, at: Date.now(), name: snap?.nm || shared.group?.name || '' })); } catch { /* blocked */ }
    }
  };
  // Anyone can run their own night without an account: the app is fully local-first.
  const homeUrl = appBaseUrl();
  const goHome = (where) => () => { rememberReturn(); track('viewer_to_home', { where, ended: !!snap?.end, mode: shared.mode }); };
  const ctaUrl = cloudConfigured
    ? `${appBaseUrl()}${shared.group?.invite_code ? `?join=${shared.group.invite_code}` : '?cloud=1'}`
    : appBaseUrl();

  return (
    <div dir="rtl" className="min-h-full bg-night-950 pb-28">
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: 'radial-gradient(520px 420px at 50% -120px, rgba(16,185,129,.18), transparent 70%)' }} />
      <header className="pt-safe sticky top-0 z-40 border-b border-white/[0.06] bg-night-950">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <img src="./logo.svg" alt="" className="h-8 w-8" />
          <span className="whitespace-nowrap text-lg font-black tracking-tight text-white">Home <span className="text-emerald-300">Poker</span></span>
          <span className="mr-auto flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300" aria-label="צפייה בלבד">
            <Eye size={13} /> <span className="hidden min-[390px]:inline">צפייה בלבד</span>
          </span>
          <a href={homeUrl} onClick={goHome('header')} data-testid="viewer-home"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-100">
            <Home size={13} /> משחק משלכם
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {shared.status === 'loading' && <p className="py-24 text-center text-slate-500">טוען את המשחק…</p>}
        {shared.status === 'bad' && (
          <div className="glass mx-auto mt-10 max-w-sm p-6 text-center">
            <h2 className="text-xl font-black text-white">הקישור לא זמין</h2>
            <p className="mt-2 text-sm text-slate-400">ייתכן שהמשחק נגמר מזמן או שהקישור נקטע. בקשו מהמארח קישור חדש.</p>
            <a href={homeUrl} onClick={goHome('bad')} className="btn-ghost mt-4 inline-flex"><Home size={16} /> למסך הבית</a>
          </div>
        )}

        {game && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {shared.group?.name && <span className="font-bold text-white">{shared.group.name}</span>}
              {snap.end ? (
                <span className="rounded-full bg-slate-500/20 px-2.5 py-1 text-xs text-slate-300">הערב הסתיים</span>
              ) : shared.mode === 'live' ? (
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${shared.offline ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
                  <Radio size={13} className={shared.offline ? '' : 'animate-pulse'} /> {shared.offline ? 'אין חיבור, מנסה שוב' : 'חי'} · עודכן {ago(now - snap.u)}
                </span>
              ) : (
                <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs text-amber-200">תמונת מצב מ־{new Date(snap.u).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
              <span className="mr-auto text-xs text-slate-500">
                {snap.ph === 'playing' ? 'משחקים' : snap.ph === 'cashout' ? 'סופרים צ׳יפים' : 'סליקה'}
              </span>
            </div>

            {snap.end && (
              <div className="glass flex items-center gap-3 border-emerald-300/30 p-4" data-testid="viewer-ended">
                <div className="min-w-0 flex-1">
                  <div className="font-black text-white">הערב נסגר! רוצים לנהל את הערב הבא?</div>
                  <p className="text-xs text-slate-400">קניות, ספירת צ׳יפים וסליקה אוטומטית. בלי הרשמה.</p>
                </div>
                <a href={homeUrl} onClick={goHome('ended')} className="btn-primary shrink-0 px-3 py-2.5 text-sm"><PlayCircle size={16} /> התחילו משחק</a>
              </div>
            )}

            <PokerTable game={game} cur={cur} readOnly />

            <div className="grid grid-cols-2 gap-2">
              <StatTile label="סה״כ קניות"><M v={v.totalBuyIn} cur={cur} /></StatTile>
              <StatTile label="צ'יפים בשולחן"><Chips v={v.boughtChips} /></StatTile>
            </div>

            <ul className="glass divide-y divide-white/5 px-3">
              {byInvested(v.rows).map((r) => (
                <li key={r.seat.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <ChipAvatar avatar={r.seat.avatar} chip={seatChip(r.seat, r.i)} color={r.seat.glow || ''} size={28} dim={r.seat.leftEarly} />
                  <span className="flex-1 truncate font-semibold text-white">{r.seat.name}</span>
                  <span className="text-slate-400">קנה <M v={r.buyIn} cur={cur} className="text-slate-200" />{entriesOf(r.buyIn, game.entry) > 1 && <span className="text-[11px]"> ({entriesOf(r.buyIn, game.entry)} כניסות)</span>}</span>
                  {r.counted && <M v={fromCents(r.netC)} signed cur={cur} className={`w-16 text-left font-bold ${netTone(r.netC)}`} />}
                </li>
              ))}
            </ul>

            {showSettle && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm text-slate-400"><Trophy size={15} className="text-amber-300" /> {settlements.length ? 'מי מעביר למי' : 'כולם יצאו באפס'}</div>
                {settlements.map((p, i) => (
                  <div key={i} className={`glass flex items-center gap-3 p-3 ${snap.pd?.includes(`${p.from}>${p.to}`) ? 'opacity-60' : ''}`}>
                    <ChipAvatar avatar={p.fromAvatar} chip={p.fromChip} size={32} />
                    <span className="flex-1 text-sm text-slate-200"><b className="text-white">{p.from}</b> {p.fromMembers ? 'מעבירים' : 'מעביר'} ל<b className="text-white">{p.to}</b></span>
                    <ArrowLeft size={16} className="text-emerald-300" />
                    <M v={p.amount} cur={cur} className="text-lg font-black text-white" />
                    {snap.pd?.includes(`${p.from}>${p.to}`) && <span className="flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-bold text-emerald-200"><Check size={12} /> שולם</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Call to action: compact bar at the bottom; can be tucked to a side button so the table stays visible */}
      {ctaOpen ? (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 px-3">
          <div className="relative mx-auto mb-3 flex max-w-md items-center gap-3 rounded-[24px] border border-emerald-300/30 p-3 pl-10 shadow-glow-emerald"
            style={{ background: 'linear-gradient(150deg, #10301f 0%, #0d1a24 60%, #0d1020 100%)' }}>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white">רוצה משתמש משלך ולהצטרף לשולחן?</div>
              <p className="truncate text-[11px] text-slate-300">
                {shared.group?.name ? `הצטרפו ל"${shared.group.name}", עצבו את הדמות שלכם ועקבו אחרי הסטטיסטיקה` : 'צרו משתמש בחינם, עצבו את הדמות שלכם ועקבו אחרי הרווחים'}
              </p>
              <a href={homeUrl} onClick={goHome('cta')} className="text-[11px] font-semibold text-emerald-300 underline underline-offset-2">או התחילו משחק בלי משתמש</a>
            </div>
            <a href={ctaUrl} onClick={() => { rememberReturn(); track('viewer_cta_clicked', { group: !!shared.group }); }}
              className="btn-primary shrink-0 px-3 py-2.5 text-sm"><UserPlus size={16} /> {cloudConfigured ? 'הצטרפות' : 'פתיחה'}</a>
            <button onClick={() => setCtaOpen(false)} aria-label="הסתר" className="absolute left-2 top-2 rounded-full p-1 text-slate-400 hover:text-white"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <a href={ctaUrl} onClick={() => { rememberReturn(); track('viewer_cta_clicked', { group: !!shared.group, side: true }); }}
          className="pb-safe fixed bottom-5 left-3 z-40 flex items-center gap-1.5 rounded-full border border-emerald-300/40 px-3.5 py-2.5 text-xs font-bold text-emerald-100 shadow-glow-emerald"
          style={{ background: 'linear-gradient(150deg, #10301f, #0d1020)' }}>
          <UserPlus size={15} /> הצטרפות
        </a>
      )}
    </div>
  );
}
