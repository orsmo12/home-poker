import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { buzz } from './lib/haptics';
import { motion } from 'framer-motion';
import { Calculator, Coins, Download, LineChart, Radio, Share, UserRound, X } from 'lucide-react';
import { fetchLive } from './cloud/live';
import { CloudProvider, useCloud } from './cloud/CloudProvider';
import { cloudConfigured } from './cloud/config';
import { CloudScreen } from './screens/CloudScreen';
import { useAppState } from './state/store';
import { GameScreen, BuyInSetup } from './screens/GameScreen';
import { OddsCalculator } from './screens/OddsCalculator';
import { HistoryScreen } from './screens/HistoryScreen';
import { BottomSheet, Segmented } from './components/ui';
import { ChipAvatar } from './components/Avatar';
import { Celebration } from './components/Celebration';
import { EXPENSE_KINDS } from './components/Expenses';
import { InvitePopup, Onboarding, PushPrompt } from './components/Engagement';
import { validateZeroSum } from './state/store';
import { WheelPicker } from './components/WheelPicker';
import { APP_VERSION, analyticsConfigured, isOptedOut, setOptOut, track } from './lib/analytics';

const TABS = [
  { id: 'game', label: 'משחק', icon: Coins },
  { id: 'history', label: 'סטטיסטיקה', icon: LineChart },
  { id: 'odds', label: 'סיכויים', icon: Calculator },
];

/* Cheap static glow: radial gradients instead of huge blur filters + endless animation,
 * which made phones flicker while scrolling. Always mounted, so switching tabs never flashes. */
function GameBackdrop({ hidden }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-night-950 transition-opacity duration-300" style={{
      opacity: hidden ? 0 : 1,
      backgroundImage: 'radial-gradient(520px 420px at 50% -120px, rgba(16,185,129,.20), transparent 70%), radial-gradient(320px 320px at 0% 100%, rgba(6,182,212,.10), transparent 70%), radial-gradient(300px 300px at 100% 40%, rgba(251,191,36,.08), transparent 70%)',
    }} />
  );
}

/** Captures the browser's install prompt (Android/desktop Chrome) and detects iOS Safari. */
function useInstall() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); track('app_installed'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return { canPrompt: !!prompt && !installed, isIOS: isIOS && !installed, install: async () => { track('install_clicked', { ios: isIOS }); prompt?.prompt(); await prompt?.userChoice; setPrompt(null); } };
}

/** Reads (and removes) the invite / cloud params from the address bar once, on launch. */
function useCloudEntry() {
  const [entry] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const join = (q.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const open = cloudConfigured && (!!join || q.has('cloud') || q.has('code'));
    if (q.has('join') || q.has('cloud')) {
      q.delete('join'); q.delete('cloud');
      const rest = q.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    }
    return { join, open };
  });
  return entry;
}

/** A viewer who signed up from a live link gets a way back to that game while it's still on. */
function ReturnToLive() {
  const [ret, setRet] = useState(() => {
    try {
      const r = JSON.parse(window.localStorage.getItem('hpm-return-view') || 'null');
      return r && Date.now() - r.at < 12 * 3600e3 ? r : null;
    } catch { return null; }
  });
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!ret || !cloudConfigured) return undefined;
    let stop = false, timer;
    const forget = () => { try { window.localStorage.removeItem('hpm-return-view'); } catch { /* blocked */ } setRet(null); setLive(false); };
    const tick = async () => {
      try {
        const d = await fetchLive(ret.token);
        if (stop) return;
        if (!d || d.snapshot?.end) { forget(); return; }
        setLive(true);
      } catch { /* offline: try again later */ }
      if (!stop) timer = setTimeout(tick, 60000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [ret]);
  if (!ret || !live) return null;
  return (
    <a href={`${window.location.pathname}?view=${encodeURIComponent(ret.token)}`}
      className="flex items-center gap-1.5 rounded-full border border-rose-300/40 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-100">
      <Radio size={13} className="animate-pulse" /> חזרה למשחק החי
    </a>
  );
}

function CloudButton({ onOpen }) {
  const cloud = useCloud();
  const dot = cloud.pendingCount > 0 || cloud.failedCount > 0;
  const me = cloud.signedIn && cloud.profile;
  return (
    <button onClick={onOpen} aria-label="הפרופיל שלי" className="relative rounded-full p-1 text-slate-300 hover:bg-white/10 hover:text-white">
      {me ? <ChipAvatar avatar={me.avatar ?? 0} color={me.color || '#34d399'} size={32} /> : <span className="flex h-8 w-8 items-center justify-center"><UserRound size={20} /></span>}
      {dot && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-night-950 bg-amber-400" />}
    </button>
  );
}

// Tiny haptic "clicks" for the moments that matter at the table (Android; iOS ignores vibrate).
const HAPTIC = { ADD_EXPENSE: 12, ADD_BUYIN: [18, 40, 18], ADD_PLAYER: 14, SET_POSITIONS: 6, LEAVE_EARLY: 12, REMOVE_PLAYER: 20, SET_PHASE: 12, FINISH: [20, 50, 20, 50, 40] };

// Table actions that can be taken back for a few seconds (fat-finger insurance).
const UNDO_LABEL = {
  ADD_BUYIN: (a, g) => `נוספה קנייה ל${seatName(g, a.seatId)}`,
  REMOVE_TXN: (a, g) => `נמחקה קנייה של ${seatName(g, a.seatId)}`,
  REMOVE_PLAYER: (a, g) => `${seatName(g, a.seatId)} הוסר מהשולחן`,
  LEAVE_EARLY: (a, g) => `${seatName(g, a.seatId)} קם מהשולחן`,
  ADD_PLAYER: (a) => `${a.name} התיישב`,
  SET_POSITIONS: () => 'המושב הוזז',
  ADD_EXPENSE: (a) => `נוספה הוצאה: ${a.expense.label || EXPENSE_KINDS[a.expense.kind]?.label || 'הוצאה'}`,
  REMOVE_EXPENSE: () => 'ההוצאה נמחקה',
  FILL_ZERO: (a) => `כל הצ'יפים נספרו: ${a.names.join(', ')} קיבלו 0`,
};
const seatName = (g, id) => g?.seats?.find((s) => s.id === id)?.name || 'שחקן';

function UndoToast({ undo, onUndo, onClose }) {
  useEffect(() => { if (!undo) return undefined; const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [undo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!undo) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[96px] z-[45] flex justify-center px-4">
      <div key={undo.id} className="toast-in pointer-events-auto flex max-w-md flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1f33] px-4 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,.5)]">
        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{undo.label}</span>
        <button onClick={onUndo} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm font-bold text-cyan-300 active:scale-95"><RotateCcw size={15} /> ביטול</button>
        <span className="h-1 w-8 overflow-hidden rounded-full bg-white/10"><span className="toast-timer block h-full bg-cyan-300" /></span>
      </div>
    </div>
  );
}

export default function App() {
  const [state, rawDispatch, storageOk] = useAppState();
  const stateRef = useRef(state); stateRef.current = state;
  const [undo, setUndo] = useState(null); // { id, label, game }
  const [celebrate, setCelebrate] = useState(null); // end-of-night winner screen
  const dispatch = useCallback((a) => {
    const p = HAPTIC[a?.type]; if (p) buzz(p);
    const label = UNDO_LABEL[a?.type];
    const before = stateRef.current.activeGame;
    if (label && before) setUndo({ id: Date.now(), label: label(a, before), game: before });
    if (a?.type === 'FINISH') setCelebrate({ record: a.record, history: stateRef.current.history, players: stateRef.current.players });
    else if (a?.type === 'SET_PHASE' || a?.type === 'FINISH' || a?.type === 'DISCARD' || a?.type === 'GAME_START') setUndo(null);
    rawDispatch(a);
  }, [rawDispatch]);
  return (
    <CloudProvider state={state} dispatch={dispatch}>
      <AppShell state={state} dispatch={dispatch} storageOk={storageOk} />
      <UndoToast undo={undo} onClose={() => setUndo(null)}
        onUndo={() => { buzz(8); rawDispatch({ type: 'RESTORE_GAME', game: undo.game }); setUndo(null); }} />
      <Onboarding />
      <PushPrompt />
      <InvitePopup />
      {celebrate && <Celebration {...celebrate} cur={state.settings.currency} onClose={() => setCelebrate(null)} />}
    </CloudProvider>
  );
}

function SettingsPanel({ state, dispatch }) {
  const [optedOut, setOptedOut] = useState(isOptedOut);
  return (
        <div className="space-y-5">
          <div>
            <div className="label">מטבע</div>
            <Segmented value={state.settings.currency} onChange={(c) => dispatch({ type: 'SETTINGS_UPDATE', patch: { currency: c } })}
              options={[{ id: '₪', label: '₪ שקל' }, { id: '$', label: '$ דולר' }, { id: '€', label: '€ אירו' }]} />
          </div>
          <div>
            <div className="label">כניסה וצ'יפים</div>
            <BuyInSetup settings={state.settings} dispatch={dispatch} />
            {state.activeGame && <p className="mt-2 text-xs text-slate-500">במשחק הנוכחי היחס כבר נעול, ולכן שינוי כאן ישפיע רק מהמשחק הבא.</p>}
          </div>
          <div>
            <div className="label text-center">מספר כיסאות מקסימלי</div>
            <WheelPicker visible={3} items={[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: n }))}
              value={state.settings.maxSeats} onChange={(n) => dispatch({ type: 'SETTINGS_UPDATE', patch: { maxSeats: n } })} ariaLabel="מספר כיסאות" />
          </div>
          {analyticsConfigured && (
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-500" checked={!optedOut}
                onChange={(e) => { const off = !e.target.checked; setOptOut(off); setOptedOut(off); }} />
              <span className="text-sm text-slate-300">
                שליחת נתוני שימוש אנונימיים
                <span className="block text-xs text-slate-500">עוזר לנו לשפר את האפליקציה. לא נשלחים שמות, סכומים או צ'יפים, רק כמה משחקים ושחקנים היו.</span>
              </span>
            </label>
          )}
          <p className="text-center text-[11px] text-slate-500" dir="ltr">Home Poker · v{APP_VERSION}</p>
        </div>
  );
}

function AppShell({ state, dispatch, storageOk }) {
  const entry = useCloudEntry();
  const [cloudOpen, setCloudOpen] = useState(entry.open);
  const [tab, setTab] = useState('game');
  const [playTable, setPlayTable] = useState(null);
  const [iosHint, setIosHint] = useState(false);
  const install = useInstall();
  const night = tab === 'odds';

  return (
    <div dir="rtl" className="min-h-full">
      <GameBackdrop hidden={night} />

      <header className="pt-safe sticky top-0 z-40 border-b border-white/[0.06] bg-night-950">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          {/* App logo placeholder: replace public/logo.svg */}
          <img src="./logo.svg" alt="" className="h-8 w-8 drop-shadow-[0_0_10px_rgba(52,211,153,.6)]" />
          <span className="text-lg font-black tracking-tight text-white">Home <span className="text-emerald-300">Poker</span></span>
          <span dir="ltr" className="self-end pb-1 text-[10px] font-medium text-slate-500">v{APP_VERSION}</span>
          <div className="mr-auto flex items-center gap-1">
            {(install.canPrompt || install.isIOS) && (
              <button onClick={() => (install.canPrompt ? install.install() : setIosHint(true))}
                className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-glow-emerald">
                <Download size={14} /> התקנה
              </button>
            )}
            <ReturnToLive />
            <CloudButton onOpen={() => setCloudOpen(true)} />
          </div>
        </div>
        {!storageOk && <div className="bg-amber-500/20 py-1 text-center text-xs text-amber-100">האחסון בדפדפן חסום כאן, ולכן הנתונים יימחקו כשתסגרו את הדף.</div>}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-4">
        {/* Plain keyed fade-in: no exit animation, so a screen can never get stuck half-way. */}
        <motion.div key={tab} initial={false}>
            {tab === 'game' && <GameScreen state={state} dispatch={dispatch} onNavigate={setTab} playTable={playTable} onPlayTableUsed={() => setPlayTable(null)} />}
            {tab === 'history' && <HistoryScreen state={state} dispatch={dispatch} />}
            {tab === 'odds' && <OddsCalculator />}
        </motion.div>
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 px-4">
        <div className="mx-auto mb-2 grid max-w-md grid-cols-3 gap-1 rounded-[28px] border border-white/10 bg-[#0d1020] p-1.5 shadow-glass">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { if (t.id !== tab) { setTab(t.id); window.scrollTo(0, 0); } }}
              className={`relative flex flex-col items-center gap-0.5 rounded-[22px] py-2 text-xs font-bold transition ${tab === t.id ? 'text-night-950' : 'text-slate-400'}`}>
              {tab === t.id && (
                <motion.span initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 22, stiffness: 380 }}
                  className={`absolute inset-0 rounded-[22px] ${night ? 'bg-gradient-to-l from-violet-300 to-indigo-400 shadow-glow-violet' : 'bg-gradient-to-l from-emerald-300 to-emerald-500 shadow-glow-emerald'}`} />
              )}
              <t.icon size={21} className="relative" />
              <span className="relative">{t.label}</span>
              {t.id === 'game' && state.activeGame && state.activeGame.seats.length > 0 && (
                <span dir="ltr" className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200/60 bg-gradient-to-b from-amber-300 to-amber-500 px-2 py-[1px] text-[10px] font-black text-night-950 shadow-[0_2px_8px_rgba(251,191,36,.5)]">
                  {Math.round(validateZeroSum(state.activeGame).totalBuyIn).toLocaleString('en-US')}{state.settings.currency}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <BottomSheet open={iosHint} onClose={() => setIosHint(false)} title="התקנה באייפון">
        <ol className="space-y-3 text-slate-200">
          <li className="flex items-center gap-2">1. לחצו על כפתור השיתוף <Share size={18} className="text-sky-300" /> בתחתית ספארי</li>
          <li>2. בחרו "הוספה למסך הבית"</li>
          <li>3. לחצו "הוסף". האפליקציה תופיע עם האייקון שלה ותיפתח במסך מלא.</li>
        </ol>
        <button onClick={() => setIosHint(false)} className="btn-ghost mt-5 w-full"><X size={16} /> הבנתי</button>
      </BottomSheet>

      {cloudOpen && <CloudScreen settings={<SettingsPanel state={state} dispatch={dispatch} />} joinCode={entry.join} state={state} dispatch={dispatch} cur={state.settings.currency} onClose={() => setCloudOpen(false)}
        onPlayAgain={state.activeGame ? null : (tid) => { setCloudOpen(false); setTab('game'); setPlayTable(tid); window.scrollTo(0, 0); }} />}
    </div>
  );
}
