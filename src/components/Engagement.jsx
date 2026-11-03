/* Sign-up follow-ups and "you were added to a game":
 *  - Onboarding: after the first sign-in, ask (optionally) for a phone number so hosts can link the
 *    player to this account, then offer push notifications.
 *  - PushPrompt: a soft prompt (never the raw browser dialog out of the blue) after install / sign-in.
 *  - InvitePopup: in-app fallback when push is off: "Yossi added you to a game, watch it live". */
import { useEffect, useState } from 'react';
import { Bell, BellOff, Phone, Radio, ShieldCheck, X } from 'lucide-react';
import { useCloud } from '../cloud/CloudProvider';
import { pushSupported } from '../cloud/push';
import { normalizePhone } from '../lib/phone';
import { cloudErrorText } from '../cloud/client';
import { track } from '../lib/analytics';

const LS = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } },
};
const phoneOtp = import.meta.env.VITE_PHONE_OTP === '1';

function Sheet({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog">
      <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#11152a] p-5 shadow-[0_20px_60px_rgba(0,0,0,.7)]">
        {onClose && <button onClick={onClose} aria-label="סגור" className="absolute left-3 top-3 rounded-full p-2 text-slate-400 hover:bg-white/10"><X size={18} /></button>}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ phone form (also used in the profile) */
export function PhoneForm({ onDone, compact }) {
  const cloud = useCloud();
  const [raw, setRaw] = useState('');
  const [disc, setDisc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [otp, setOtp] = useState(null); // { e164 } after an SMS was sent
  const [code, setCode] = useState('');
  const ok = !!normalizePhone(raw);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await cloud.setMyPhone(raw, disc);
      if (phoneOtp) { const e164 = await cloud.sendPhoneCode(raw); setOtp({ e164 }); }
      else onDone?.();
    } catch (e) { setErr(e.message?.includes('תקין') ? e.message : cloudErrorText(e)); }
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true); setErr('');
    try { const n = await cloud.verifyPhoneCode(otp.e164, code); onDone?.(n); } catch (e) { setErr(cloudErrorText(e)); }
    setBusy(false);
  };

  if (otp) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-300">שלחנו SMS עם קוד. הקלידו אותו כדי לאמת את המספר ולחבר אליכם ערבים קודמים:</p>
        <input dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••" className="text-input text-center text-2xl tracking-[0.4em]" />
        {err && <p className="text-center text-sm text-rose-300">{err}</p>}
        <div className="flex gap-2">
          <button onClick={() => onDone?.()} className="btn-ghost flex-1">אחר כך</button>
          <button disabled={code.length < 6 || busy} onClick={verify} className="btn-primary flex-1">אימות</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <input dir="ltr" type="tel" inputMode="tel" autoComplete="tel" value={raw} onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && ok && save()} placeholder="050-123-4567" className="text-input text-center text-xl tracking-wider" />
      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={disc} onChange={(e) => setDisc(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-500" />
        <span>חברים שמושיבים אותי בשולחן יכולים לזהות אותי לפי המספר</span>
      </label>
      {!compact && <p className="flex items-start gap-1.5 text-[11px] text-slate-500"><ShieldCheck size={13} className="mt-0.5 shrink-0" /> המספר עצמו לא נשמר אצלנו: נשמר רק קוד מוצפן שלו, ואף אחד לא יכול לראות אותו. אפשר למחוק בכל רגע בפרופיל.</p>}
      {err && <p className="text-center text-sm text-rose-300">{err}</p>}
      <div className="flex gap-2">
        {onDone && <button onClick={() => onDone()} className="btn-ghost flex-1">דלג</button>}
        <button disabled={!ok || busy} onClick={save} className="btn-primary flex-[2]"><Phone size={17} /> שמירה</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ first sign-in */
export function Onboarding() {
  const cloud = useCloud();
  const uid = cloud.user?.id;
  const key = uid ? `hpm-onboarded-${uid}` : null;
  const [step, setStep] = useState(null); // 'phone' | 'push' | null
  useEffect(() => {
    if (!uid || cloud.user?.cached || !cloud.ready || LS.get(key)) return;
    let stop = false;
    cloud.loadMyPhone().then((p) => {
      if (stop) return;
      if (!p) setStep('phone');
      else if (pushSupported() && Notification.permission === 'default') setStep('push');
      else LS.set(key, '1');
    }).catch(() => {});
    return () => { stop = true; };
  }, [uid, cloud.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => { LS.set(key, '1'); setStep(null); };
  const afterPhone = () => (pushSupported() && Notification.permission === 'default' ? setStep('push') : finish());
  if (!step) return null;
  return (
    <Sheet onClose={finish}>
      {step === 'phone' ? (<>
        <div className="mb-1 flex items-center gap-2 text-xl font-black text-white"><Phone size={20} className="text-emerald-300" /> עוד צעד קטן</div>
        <p className="mb-4 text-sm text-slate-300">מה מספר הטלפון שלך? כשחבר יושיב אותך בשולחן לפי המספר, הדמות שלך תופיע אוטומטית והערב ייכנס לסטטיסטיקה שלך.</p>
        <PhoneForm onDone={afterPhone} />
      </>) : (
        <PushAsk onDone={finish} />
      )}
    </Sheet>
  );
}

function PushAsk({ onDone }) {
  const cloud = useCloud();
  const [busy, setBusy] = useState(false);
  return (<>
    <div className="mb-1 flex items-center gap-2 text-xl font-black text-white"><Bell size={20} className="text-amber-300" /> לדעת כשהמשחק מתחיל?</div>
    <p className="mb-4 text-sm text-slate-300">נשלח התראה כשחבר מושיב אותך בשולחן, עם קישור לשידור החי. רק זה, בלי ספאם.</p>
    <div className="flex gap-2">
      <button onClick={() => { track('push_prompt', { result: 'later' }); onDone(); }} className="btn-ghost flex-1"><BellOff size={16} /> לא עכשיו</button>
      <button disabled={busy} onClick={async () => { setBusy(true); try { await cloud.enablePush(); } catch { /* blocked */ } onDone(); }} className="btn-primary flex-[2]"><Bell size={17} /> כן, תעדכנו אותי</button>
    </div>
  </>);
}

/** After the app is installed (or on later visits), a gentle one-time push prompt for signed-in users. */
export function PushPrompt() {
  const cloud = useCloud();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!cloud.signedIn || !pushSupported() || Notification.permission !== 'default' || LS.get('hpm-push-asked')) return undefined;
    const onInstalled = () => setShow(true);
    window.addEventListener('appinstalled', onInstalled);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    const onboarded = LS.get(`hpm-onboarded-${cloud.user?.id}`);
    if (standalone && onboarded) setShow(true);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [cloud.signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  const done = () => { LS.set('hpm-push-asked', '1'); setShow(false); };
  return <Sheet onClose={done}><PushAsk onDone={done} /></Sheet>;
}

/* ------------------------------------------------------------ "you were added to a game" */
export function InvitePopup() {
  const cloud = useCloud();
  const inv = cloud.invites?.find((i) => !LS.get(`hpm-invite-seen-${i.id}`));
  if (!inv) return null;
  const seen = () => LS.set(`hpm-invite-seen-${inv.id}`, '1');
  return (
    <Sheet onClose={() => { seen(); cloud.dismissInvite(inv.id); }}>
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20 text-rose-200"><Radio size={26} className="animate-pulse" /></div>
        <div className="text-xl font-black text-white">{inv.host_name || 'חבר'} הושיב אותך בשולחן!</div>
        <p className="mt-1 text-sm text-slate-300">{inv.table_name ? `המשחק ב"${inv.table_name}" כבר התחיל.` : 'המשחק כבר התחיל.'} רוצה לראות את השולחן בשידור חי?</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => { seen(); cloud.dismissInvite(inv.id); }} className="btn-ghost flex-1">לא עכשיו</button>
          <a href={`${window.location.pathname}?view=${encodeURIComponent(inv.view_token)}`} onClick={() => { seen(); track('invite_opened'); }}
            className="btn-primary flex-[2]"><Radio size={17} /> לשידור החי</a>
        </div>
      </div>
    </Sheet>
  );
}
