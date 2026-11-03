import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Calculator, Layers, LogOut, Plus, RotateCcw,
  Save, Share2, Trash2, Users, Wallet, X, Check, Pencil, Eye, Radio, Copy, Timer, Palette, Link2, Unlink, Phone, Contact,
} from 'lucide-react';
import { FELTS, PokerTable } from '../components/PokerTable';
import { ShotClock } from '../components/ShotClock';
import { buzz } from '../lib/haptics';
import { ExpensesCard, NightLog } from '../components/Expenses';
import { normalizePhone, prettyPhone } from '../lib/phone';
import { contactsSupported, pickContacts } from '../lib/contacts';
import { linkColor } from '../lib/link';
import { HomeScreen } from './HomeScreen';
import { track } from '../lib/analytics';
import { clearLiveSession, encodeSnap, getLiveSession, makeSnapshot, pushLive, startLive } from '../cloud/live';
import { useCloud } from '../cloud/CloudProvider';
import { appBaseUrl, cloudConfigured } from '../cloud/config';
import { Avatar, AvatarGrid, AVATAR_COUNT, ChipAvatar } from '../components/Avatar';
import { ChipsInput, WheelOrType, amountItems, chipItems } from '../components/WheelPicker';
import { BottomSheet, Chips, GlowAlert, M, Segmented, StatTile, netTone } from '../components/ui';
import { byInvested, entriesOf, gameEntry, seatChip, CURRENCY_WORD, computeNets, computeSettlements, withExpenses, fromCents, numFmt, seatInfo, toCents, validateZeroSum } from '../state/store';

const fade = { initial: false };

/* ---------------------------------------------------------------- start */
export function BuyInSetup({ settings, dispatch }) {
  const cur = settings.currency;
  const set = (patch) => dispatch({ type: 'SETTINGS_UPDATE', patch });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <WheelOrType label="סכום כניסה" suffix={cur} items={amountItems(cur, [settings.defaultBuyIn])}
          value={settings.defaultBuyIn} onChange={(v) => set({ defaultBuyIn: v })} />
        <WheelOrType label="צ'יפים לכניסה" suffix="צ'יפים" items={chipItems([settings.chipsPerBuyIn, settings.defaultBuyIn])}
          value={settings.chipsPerBuyIn} onChange={(v) => set({ chipsPerBuyIn: Math.round(v) })} />
      </div>
      <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2.5 text-center text-sm text-emerald-50">
        כל כניסה של <M v={settings.defaultBuyIn} cur={cur} className="font-bold" /> = <Chips v={settings.chipsPerBuyIn} className="font-bold" /> צ'יפים
        <div className="text-xs text-emerald-200/70">צ'יפ אחד שווה <M v={settings.defaultBuyIn / settings.chipsPerBuyIn} cur={cur} /></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sheets */
function AddPlayerSheet({ open, state, dispatch, onClose }) {
  const game = state.activeGame;
  const cur = state.settings.currency;
  const usedAvatars = new Set(game?.seats.map((s) => s.avatar));
  // Prefer an avatar nobody has used yet, then one nobody at the table has.
  const knownAvatars = new Set(Object.values(state.players).map((p) => p.avatar));
  const firstFree = [...Array(AVATAR_COUNT).keys()].find((a) => !usedAvatars.has(a) && !knownAvatars.has(a))
    ?? [...Array(AVATAR_COUNT).keys()].find((a) => !usedAvatars.has(a)) ?? 0;
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [amount, setAmount] = useState(state.settings.defaultBuyIn);
  const [phone, setPhone] = useState('');
  if (!game) return null;
  const chosenAvatar = avatar ?? firstFree;
  const seatedIds = new Set(game.seats.map((s) => s.playerId));
  const known = Object.values(state.players).filter((p) => !seatedIds.has(p.id));
  const nameTaken = game.seats.some((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  const e164 = phone.trim() ? normalizePhone(phone) : null;
  const phoneBad = !!phone.trim() && !e164;
  const valid = name.trim() && amount > 0 && !nameTaken && !phoneBad;
  const close = () => { setName(''); setAvatar(null); setPhone(''); setAmount(state.settings.defaultBuyIn); onClose(); };
  const submit = () => {
    if (!valid) return;
    dispatch({ type: 'ADD_PLAYER', name, amount, avatar: chosenAvatar, phone: e164 || undefined });
    track('player_added', { seated: game.seats.length + 1, known_player: known.some((p) => p.name === name.trim()) });
    close();
  };

  return (
    <BottomSheet open={open} onClose={close} title="שחקן חדש">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <motion.div key={chosenAvatar} initial={{ scale: 0.6, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} className="rounded-full bg-gradient-to-br from-amber-200 to-amber-500 p-[3px] shadow-glow-amber">
            <Avatar avatar={chosenAvatar} size={64} />
          </motion.div>
          <div className="flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="שם השחקן" className="text-input" />
            {nameTaken && <p className="mt-1 text-xs text-rose-300">השחקן כבר יושב בשולחן.</p>}
          </div>
        </div>
        {known.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {known.map((p) => (
              <button key={p.id} onClick={() => { setName(p.name); setAvatar(p.avatar); setPhone(p.phone ? prettyPhone(p.phone) : ''); }}
                className="glass-pill flex shrink-0 items-center gap-1.5 py-1 pl-3 pr-1 text-xs text-slate-200">
                <Avatar avatar={p.avatar} size={22} /> {p.name}
              </button>
            ))}
          </div>
        )}
        <div>
          <div className="label flex items-center gap-1.5"><Phone size={13} /> טלפון (לא חובה)</div>
          <div className="flex gap-2">
            <input dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-123-4567" className="text-input flex-1 text-center" />
            {contactsSupported() && (
              <button type="button" aria-label="בחירה מאנשי הקשר" onClick={async () => { try { const [c] = await pickContacts(false); if (c) { if (!name.trim()) setName(c.name); if (c.phone) setPhone(prettyPhone(c.phone)); } } catch { /* cancelled */ } }}
                className="glass-pill shrink-0 px-3 text-cyan-200"><Contact size={20} /></button>
            )}
          </div>
          <p className={`mt-1 text-[11px] ${phoneBad ? 'text-rose-300' : 'text-slate-500'}`}>{phoneBad ? 'המספר לא נראה תקין' : 'אם הוא רשום באפליקציה, הדמות והסטטיסטיקה שלו יתחברו והוא יקבל הזמנה לשידור.'}</p>
        </div>
        <div>
          <div className="label">בחרו דמות</div>
          <AvatarGrid value={chosenAvatar} onPick={setAvatar} taken={usedAvatars} size={42} />
        </div>
        <div>
          <WheelOrType label="סכום כניסה" suffix={cur} items={amountItems(cur, [state.settings.defaultBuyIn, amount])} value={amount} onChange={setAmount} visible={3} />
          <p className="mt-1 text-center text-xs text-slate-400">= <Chips v={amount * game.chipsPerUnit} /> צ'יפים</p>
        </div>
        <button onClick={submit} disabled={!valid} className="btn-primary w-full text-lg"><Plus size={20} /> הושב שחקן</button>
        {!valid && !nameTaken && <p className="-mt-3 text-center text-xs text-slate-500">הזינו שם כדי להושיב את השחקן.</p>}
      </div>
    </BottomSheet>
  );
}

function SeatSheet({ seat, game, settings, dispatch, onClose, players }) {
  const open = !!seat;
  return (
    <BottomSheet open={open} onClose={onClose} title={seat?.name || ''}>
      {seat && <SeatSheetBody key={seat.id} seat={seat} game={game} settings={settings} dispatch={dispatch} onClose={onClose} players={players} />}
    </BottomSheet>
  );
}

/** Couples mode: link seats that share a wallet. They still play, buy in and cash out separately. */
/** The player's phone (kept on this device) and whether the seat is linked to an account. */
function SeatPhone({ seat, player, dispatch }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState('');
  if (!player) return null;
  const e164 = normalizePhone(val);
  const save = () => { dispatch({ type: 'SET_PLAYER_PHONE', playerId: player.id, phone: val.trim() ? e164 : null }); dispatch({ type: 'SET_SEAT_USER', seatId: seat.id, userId: null, linkState: null }); setEdit(false); };
  return (
    <div className="border-t border-white/10 pt-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone size={13} /> טלפון וחשבון</div>
      {edit ? (
        <div className="flex gap-2">
          <input autoFocus dir="ltr" type="tel" inputMode="tel" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e164 || !val.trim()) && save()} placeholder="050-123-4567" className="text-input flex-1 py-2 text-center" />
          <button disabled={!!val.trim() && !e164} onClick={save} className="btn-primary px-3 py-2"><Check size={18} /></button>
        </div>
      ) : (
        <button onClick={() => { setVal(player.phone ? prettyPhone(player.phone) : ''); setEdit(true); }} className="flex w-full items-center gap-2 text-right text-sm">
          <span dir="ltr" className="text-slate-200">{player.phone ? prettyPhone(player.phone) : <span className="text-slate-500">אין מספר · הוספה</span>}</span>
          <span className="mr-auto text-xs">
            {seat.linkState === 'linked' ? <span className="text-emerald-300">✓ מקושר ל{seat.userName || 'משתמש'}{seat.invited ? ' · הוזמן לשידור' : ''}</span>
              : seat.linkState === 'none' ? <span className="text-slate-500">לא רשום · שתפו קישור ידנית</span>
              : player.phone ? <span className="text-slate-500">בודק…</span> : null}
          </span>
          <Pencil size={13} className="text-cyan-300" />
        </button>
      )}
    </div>
  );
}

function WalletLink({ seat, game, dispatch }) {
  const partners = seat.link ? game.seats.filter((x) => x.id !== seat.id && x.link === seat.link) : [];
  const candidates = game.seats.filter((x) => x.id !== seat.id && !(seat.link && x.link === seat.link));
  return (
    <div className="border-t border-white/10 pt-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Link2 size={14} /> חשבון משותף (זוג / שותפים)</div>
      {partners.length > 0 ? (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: `${linkColor(seat.link)}66`, background: `${linkColor(seat.link)}14` }}>
          <span className="min-w-0 flex-1 text-sm text-slate-200">
            <b className="text-white">{[seat, ...partners].map((x) => x.name).join(' & ')}</b> משלמים ומקבלים כאחד. כל אחד עדיין עם קניות וסטטיסטיקה משלו.
          </span>
          <button onClick={() => dispatch({ type: 'UNLINK_SEAT', seatId: seat.id })} className="shrink-0 rounded-full px-2 py-1 text-xs font-bold text-rose-300"><Unlink size={14} className="inline" /> נתק</button>
        </div>
      ) : (
        <p className="mb-2 text-[11px] text-slate-500">מי חולק כיס עם {seat.name}? בסליקה הם יחושבו כגוף אחד, בלי העברות ביניהם.</p>
      )}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {candidates.map((o) => (
          <button key={o.id} onClick={() => dispatch({ type: 'LINK_SEATS', seatId: seat.id, withId: o.id })}
            className="glass-pill flex shrink-0 items-center gap-1.5 py-1 pl-3 pr-1 text-xs text-slate-200">
            <Avatar avatar={o.avatar} size={24} /> <Link2 size={12} className="text-cyan-300" /> {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SeatSheetBody({ seat, game, settings, dispatch, onClose, players }) {
  const cur = settings.currency;
  const ratio = game.chipsPerUnit;
  const s = seatInfo(seat, ratio);
  const [mode, setMode] = useState(seat.leftEarly ? 'leave' : 'rebuy');
  const [rebuy, setRebuy] = useState(settings.defaultBuyIn);
  const [stack, setStack] = useState(seat.stackChips);
  const [leave, setLeave] = useState(seat.cashOutChips ?? seat.stackChips);
  const myIndex = game.seats.findIndex((x) => x.id === seat.id);
  const others = game.seats.map((x, i) => ({ ...x, i })).filter((x) => x.id !== seat.id);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pickAvatar, setPickAvatar] = useState(false);
  const done = (action) => { dispatch(action); onClose(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setPickAvatar((v) => !v)} aria-label="החלף דמות" className="relative rounded-full bg-gradient-to-br from-amber-200 to-amber-500 p-[3px] shadow-glow-amber">
          <ChipAvatar avatar={seat.avatar} chip={seat.chip ?? myIndex} size={52} />
          <span className="absolute -bottom-1 -left-1 rounded-full bg-night-900 p-1 text-cyan-300"><Pencil size={12} /></span>
        </button>
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          <StatTile label="קנה ב"><M v={s.buyIn} cur={cur} /></StatTile>
          <StatTile label="צ'יפים"><Chips v={s.shownChips} /></StatTile>
          <StatTile label="נטו" tone={(seat.leftEarly ? s.netC : (s.stackChips ?? s.boughtChips) - s.boughtChips) > 0 ? 'win' : (seat.leftEarly ? s.netC : (s.stackChips ?? s.boughtChips) - s.boughtChips) < 0 ? 'loss' : undefined}>
            {seat.leftEarly ? <M v={fromCents(s.netC)} signed cur={cur} /> : s.stackChips !== null ? <M v={(s.stackChips - s.boughtChips) / ratio} signed cur={cur} /> : '—'}
          </StatTile>
        </div>
      </div>

      {pickAvatar && (
        <div className="rounded-3xl border border-cyan-300/30 bg-cyan-400/[0.06] p-3">
          <div className="mb-2 text-xs text-slate-400">בחרו דמות ל{seat.name}</div>
          <AvatarGrid value={seat.avatar} taken={new Set(game.seats.filter((x) => x.id !== seat.id).map((x) => x.avatar))} size={40}
            onPick={(a) => { dispatch({ type: 'SET_AVATAR', seatId: seat.id, avatar: a }); setPickAvatar(false); }} />
        </div>
      )}

      <Segmented value={mode} onChange={setMode} options={[
        { id: 'rebuy', label: 'קנייה', icon: Plus, disabled: seat.leftEarly },
        { id: 'stack', label: 'ערימה', icon: Layers, disabled: seat.leftEarly },
        { id: 'leave', label: 'יציאה', icon: LogOut },
        { id: 'remove', label: 'הסרה', icon: Trash2 },
      ]} />

        <motion.div key={mode} initial={false} className="space-y-3">
          {mode === 'rebuy' && !seat.leftEarly && (<>
            <WheelOrType label="סכום הקנייה" suffix={cur} items={amountItems(cur, [settings.defaultBuyIn, rebuy])} value={rebuy} onChange={setRebuy} />
            <p className="text-center text-xs text-slate-400">= <Chips v={rebuy * ratio} /> צ'יפים</p>
            <button onClick={() => done({ type: 'ADD_BUYIN', seatId: seat.id, amount: rebuy })} className="btn-primary w-full text-lg">
              <Plus size={20} /> הוסף קנייה של <M v={rebuy} cur={cur} />
            </button>
          </>)}

          {mode === 'stack' && !seat.leftEarly && (<>
            <p className="text-sm text-slate-400">כמה צ'יפים יש לשחקן עכשיו? לא חובה, זה רק למעקב. הסליקה מחושבת לפי הספירה בסוף.</p>
            <ChipsInput value={stack} onChange={setStack} />
            {stack !== null && <p className="text-center text-sm text-slate-300">שווי <M v={stack / ratio} cur={cur} /> · <span className={netTone(stack - s.boughtChips)}><M v={(stack - s.boughtChips) / ratio} signed cur={cur} /></span></p>}
            <div className="flex gap-2">
              <button disabled={stack === null} onClick={() => done({ type: 'SET_STACK', seatId: seat.id, chips: stack })} className="btn-primary flex-1"><Layers size={18} /> עדכן ערימה</button>
              {seat.stackChips !== null && <button onClick={() => done({ type: 'SET_STACK', seatId: seat.id, chips: null })} className="btn-ghost">נקה</button>}
            </div>
          </>)}

          {mode === 'leave' && (<>
            <p className="text-sm text-slate-400">השחקן עוזב לפני סוף המשחק? בחרו כמה צ'יפים הוא מחזיר.</p>
            <ChipsInput value={leave} onChange={setLeave} quick={[{ label: 'כמו שקנה', value: Math.round(s.boughtChips) }, { label: '0', value: 0 }]} />
            {leave !== null && (
              <p className="text-center text-sm text-slate-300">
                שווי <M v={leave / ratio} cur={cur} /> · נטו <span className={netTone(toCents(leave / ratio) - s.buyInC)}><M v={leave / ratio - s.buyIn} signed cur={cur} /></span>
              </p>
            )}
            <button disabled={leave === null} onClick={() => done({ type: 'LEAVE_EARLY', seatId: seat.id, chips: leave })} className="btn-primary w-full"><LogOut size={18} /> {seat.leftEarly ? 'עדכן יציאה' : 'אשר יציאה'}</button>
            {seat.leftEarly && <button onClick={() => done({ type: 'UNDO_LEAVE', seatId: seat.id })} className="btn-ghost w-full"><RotateCcw size={16} /> החזר לשולחן</button>}
          </>)}

          {mode === 'remove' && (<>
            <p className="text-sm text-slate-400">מוחק את {seat.name} ואת כל הקניות שלו, כאילו לא ישב בכלל. מיועד לתיקון טעויות. אם הוא שיחק ועזב, השתמשו ב<b className="text-slate-200">יציאה</b>.</p>
            {!confirmRemove
              ? <button onClick={() => setConfirmRemove(true)} className="btn-ghost w-full"><Trash2 size={16} /> הסר את {seat.name}</button>
              : <button onClick={() => done({ type: 'REMOVE_PLAYER', seatId: seat.id })} className="btn-danger w-full"><AlertTriangle size={16} /> כן, להסיר</button>}
          </>)}
        </motion.div>

      <SeatPhone seat={seat} player={players?.[seat.playerId]} dispatch={dispatch} />
      {others.length > 0 && <WalletLink seat={seat} game={game} dispatch={dispatch} />}

      <div className="border-t border-white/10 pt-3">
        <div className="mb-1.5 text-xs text-slate-500">היסטוריית קניות</div>
        <ul className="space-y-1">
          {seat.transactions.map((t, i) => (
            <li key={t.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{t.type === 'buyin' ? 'כניסה' : 'קנייה נוספת'} · {new Date(t.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="flex items-center gap-2 text-slate-200">
                <M v={t.amount} cur={cur} />
                {i > 0 && !seat.leftEarly && (
                  <button aria-label="מחק קנייה" onClick={() => dispatch({ type: 'REMOVE_TXN', seatId: seat.id, txnId: t.id })} className="text-slate-600 hover:text-rose-300"><X size={14} /></button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- view-only link */
function LiveShareCard({ game, settings }) {
  const [live, setLive] = useState(() => { const l = getLiveSession(); return l?.gameId === game.id ? l : null; });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const base = appBaseUrl();
  const liveUrl = live ? `${base}?view=${live.token}` : '';

  const send = async (url, frozen) => {
    const text = frozen
      ? `מצב השולחן עכשיו (צפייה בלבד) 🃏\n${url}`
      : `עקבו אחרי המשחק בזמן אמת (צפייה בלבד) 🃏\n${url}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const create = async () => {
    setNote('');
    if (cloudConfigured && navigator.onLine !== false) {
      setBusy(true);
      try {
        const s = await startLive(game.id, makeSnapshot(game, settings), game.groupId);
        setLive(s); track('live_link_created', { mode: 'live' });
        await send(`${base}?view=${s.token}`, false);
        return;
      } catch { setNote('לא הצלחנו ליצור קישור חי, אז נשלחה תמונת מצב.'); } finally { setBusy(false); }
    }
    // No server (or offline): the state travels inside the link itself.
    track('live_link_created', { mode: 'snapshot' });
    await send(`${base}#snap=${encodeSnap(makeSnapshot(game, settings))}`, true);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(liveUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ } };

  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 font-bold text-white"><Eye size={18} className="text-cyan-300" /> צפייה לחברים</div>
      {!live ? (
        <>
          <p className="mt-1 text-xs text-slate-400">
            {cloudConfigured ? 'קישור שמראה את השולחן ומתעדכן לבד. אף אחד לא יכול לשנות כלום.' : 'קישור שמראה את מצב השולחן ברגע השליחה. אף אחד לא יכול לשנות כלום.'}
          </p>
          <button disabled={busy || game.seats.length === 0} onClick={create} className="btn-ghost mt-3 w-full border-cyan-300/40 text-cyan-100">
            <Share2 size={16} /> {busy ? 'יוצר קישור…' : cloudConfigured ? 'שיתוף קישור צפייה חי' : 'שיתוף מצב השולחן'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-200"><Radio size={13} className="animate-pulse" /> הקישור פעיל ומתעדכן אוטומטית</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => send(liveUrl, false)} className="btn-ghost flex-1 border-cyan-300/40 py-2.5 text-cyan-100"><Share2 size={16} /> שליחה</button>
            <button onClick={copy} className="btn-ghost px-3 py-2.5" aria-label="העתק קישור">{copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}</button>
            <button onClick={() => { clearLiveSession(); setLive(null); }} className="btn-ghost px-3 py-2.5 text-xs text-slate-400">הפסקה</button>
          </div>
        </>
      )}
      {note && <p className="mt-2 text-xs text-amber-200">{note}</p>}
    </div>
  );
}

/** The table's name: tap to rename (shown in the middle of the felt). */
function TableNameEdit({ game, dispatch }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(game.name || '');
  if (edit) {
    const save = () => { dispatch({ type: 'SET_GAME_NAME', name: val }); setEdit(false); };
    return (
      <div className="flex flex-1 gap-1.5">
        <input autoFocus value={val} maxLength={30} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="שם השולחן" className="text-input flex-1 py-1.5 text-sm" />
        <button onClick={save} className="btn-primary px-3 py-1.5" aria-label="שמור שם"><Check size={16} /></button>
      </div>
    );
  }
  return (
    <button onClick={() => { setVal(game.name || ''); setEdit(true); }} className="flex min-w-0 items-center gap-2 text-right font-bold text-white">
      <Users size={18} className="shrink-0" /> <span className="truncate">{game.name || 'המשחק'}</span> <Pencil size={13} className="shrink-0 text-cyan-300" />
    </button>
  );
}

/** Signed-in players show up with their own character + glow colour, for everyone at the table. */
/* ---------------------------------------------------------------- phone → account linking
 * A seat whose player has a phone is checked against registered users (hash only). A match the admin
 * already confirmed before links silently; a new match asks "is this them?". Once linked, the seat shows
 * their character + glow, the night joins their stats, and they get an invite (pop-up + push) to the live view. */
function useAutoLink(game, state, cloud, dispatch) {
  const busy = useRef(new Set());
  useEffect(() => {
    if (!cloud.signedIn || !cloud.online || cloud.user?.cached) return;
    game.seats.forEach(async (st) => {
      const pl = state.players[st.playerId];
      if (!pl?.phone || st.linkState || busy.current.has(st.id)) return;
      busy.current.add(st.id);
      try {
        const { hash, match } = await cloud.findUserByPhone(pl.phone);
        if (!match) { dispatch({ type: 'SET_SEAT_USER', seatId: st.id, userId: null, phoneHash: hash, linkState: 'none' }); return; }
        const pending = { userId: match.user_id, name: match.display_name, avatar: match.avatar, color: match.color };
        if (pl.userId && pl.userId === match.user_id) await completeLink(st, pending, hash, game, state, cloud, dispatch);
        else dispatch({ type: 'SET_SEAT_USER', seatId: st.id, userId: null, phoneHash: hash, linkState: 'confirm', pending });
      } catch { /* offline or rate limited: try again later */ } finally { busy.current.delete(st.id); }
    });
  }, [game.seats.map((x) => `${x.id}:${x.linkState || ''}:${state.players[x.playerId]?.phone || ''}`).join(','), cloud.signedIn, cloud.online]); // eslint-disable-line react-hooks/exhaustive-deps
}

async function completeLink(st, m, hash, game, state, cloud, dispatch) {
  dispatch({ type: 'SET_SEAT_USER', seatId: st.id, userId: m.userId, phoneHash: hash, avatar: m.avatar, glow: m.color, userName: m.name, linkState: 'linked' });
  if (game.groupId) cloud.linkPlayer(game.groupId, st.name, hash, m.userId).catch(() => {});
  // invite them to the live view (start the live link if it isn't on yet)
  try {
    let live = getLiveSession();
    if (!live || live.gameId !== game.id) live = await startLive(game.id, makeSnapshot(game, state.settings), game.groupId);
    await cloud.inviteToGame(m.userId, live.token, game.name || '');
    dispatch({ type: 'SET_SEAT_USER', seatId: st.id, userId: m.userId, phoneHash: hash, linkState: 'linked', invited: true });
  } catch { /* the in-app invite needs migration 003; linking still worked */ }
}

/** "Is this them?" cards above the table for new phone matches. */
function LinkPrompts({ game, state, cloud, dispatch }) {
  const asks = game.seats.filter((x) => x.linkState === 'confirm' && x.pending);
  if (!asks.length) return null;
  return (
    <div className="mb-3 space-y-2">
      {asks.map((st) => (
        <div key={st.id} className="flex items-center gap-3 rounded-3xl border border-cyan-300/40 bg-cyan-400/10 p-3">
          <ChipAvatar avatar={st.pending.avatar ?? 0} color={st.pending.color || '#22d3ee'} size={44} />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold text-white">{st.name} רשום באפליקציה</div>
            <div className="text-slate-300">המספר שייך ל<b className="text-white">{st.pending.name || 'משתמש'}</b>. לקשר? הדמות והסטטיסטיקה שלו יתחברו, והוא יקבל הזמנה לשידור.</div>
          </div>
          <div className="flex flex-col gap-1">
            <button onClick={() => completeLink(st, st.pending, st.phoneHash, game, state, cloud, dispatch)} className="btn-primary px-3 py-1.5 text-sm">כן, זה הוא</button>
            <button onClick={() => dispatch({ type: 'SET_SEAT_USER', seatId: st.id, userId: null, phoneHash: st.phoneHash, linkState: 'none' })} className="text-xs text-slate-400">לא הוא</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function useSeatLooks(game, settings, cloud, dispatch) {
  useEffect(() => {
    if (!cloud.signedIn) return;
    const looks = new Map();
    (cloud.tableProfiles || []).filter((p) => p.group_id && p.group_id === game.groupId)
      .forEach((p) => looks.set(p.name.trim().toLowerCase(), { avatar: p.avatar, glow: p.color || '' }));
    const prof = cloud.profile;
    if (prof) (settings.me || []).forEach((n) => looks.set(n.trim().toLowerCase(), { avatar: prof.avatar, glow: prof.color || '' }));
    game.seats.forEach((st) => {
      const l = looks.get(st.name.trim().toLowerCase());
      if (l && !st.lookFrom && (l.glow || typeof l.avatar === 'number')) {
        dispatch({ type: 'SET_SEAT_LOOK', seatId: st.id, avatar: typeof l.avatar === 'number' ? l.avatar : undefined, glow: l.glow });
      }
    });
  }, [game.seats.length, cloud.signedIn, cloud.profile, cloud.tableProfiles, settings.me]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Quick tools above the table: shot clock, average buy-in, felt colour. */
function TableToolbar({ game, settings, v, dispatch, cloud }) {
  const [clock, setClock] = useState(false);
  const [avgMode, setAvgMode] = useState('money');
  const [felts, setFelts] = useState(false);
  const cur = settings.currency;
  const n = game.seats.length;
  const avg = n ? v.totalBuyIn / n : 0;
  const entry = gameEntry(game, settings);
  const changeFelt = (f) => {
    buzz(10);
    dispatch({ type: 'SET_FELT', felt: f });
    if (game.tableId) dispatch({ type: 'TABLE_UPSERT', table: { id: game.tableId, felt: f } });
    if (game.groupId && cloud.signedIn) cloud.setTableFelt(game.groupId, f).catch(() => {});
    setFelts(false);
  };
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button onClick={() => { buzz(10); setClock(true); }} className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-amber-100">
        <Timer size={15} /> שעון
      </button>
      {n > 0 && (
        <button onClick={() => { buzz(8); setAvgMode((m) => (m === 'money' ? 'entries' : 'money')); }}
          className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-200" aria-label="ממוצע לשחקן">
          <span className="text-slate-400">ממוצע</span>
          {avgMode === 'money' || !entry ? <M v={Math.round(avg)} cur={cur} className="font-bold text-white" />
            : <span className="font-bold text-white">×{Math.round((avg / entry) * 10) / 10} כניסות</span>}
        </button>
      )}
      <div className="mr-auto flex items-center gap-1.5">
        {felts && Object.entries(FELTS).map(([k, f]) => (
          <button key={k} onClick={() => changeFelt(k)} aria-label={`לבד ${f.name}`}
            className={`h-7 w-7 rounded-full border-2 ${game.felt === k ? 'border-white' : 'border-white/20'}`} style={{ background: f.swatch }} />
        ))}
        <button onClick={() => setFelts((x) => !x)} aria-label="צבע השולחן" className="glass-pill p-2 text-slate-200"><Palette size={15} /></button>
      </div>
      {clock && <ShotClock onClose={() => setClock(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------------- table */
/** A night that's been open for 8+ hours was probably forgotten: offer to close it. */
function LongNightNudge({ game, dispatch }) {
  const [hidden, setHidden] = useState(false);
  const hours = (Date.now() - Date.parse(game.startedAt)) / 3600e3;
  if (hidden || hours < 8 || game.seats.length === 0) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-3xl border border-amber-300/40 bg-amber-400/10 p-3">
      <span className="text-2xl">🌙</span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-bold text-white">המשחק פתוח כבר {Math.floor(hours)} שעות</div>
        <div className="text-slate-300">נגמר הערב? אפשר לעבור לספירה ולסגור חשבון.</div>
      </div>
      <div className="flex flex-col gap-1">
        <button onClick={() => dispatch({ type: 'SET_PHASE', phase: 'cashout' })} className="btn-primary px-3 py-1.5 text-sm">לספירה</button>
        <button onClick={() => setHidden(true)} className="text-xs text-slate-400">עוד משחקים</button>
      </div>
    </div>
  );
}

function TableView({ state, dispatch }) {
  const game = state.activeGame;
  const { settings } = state;
  const cur = settings.currency;
  const [sheet, setSheet] = useState(null); // 'add' | seatId
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const v = validateZeroSum(game);
  const seat = sheet && sheet !== 'add' ? game.seats.find((s) => s.id === sheet) : null;
  const cloud = useCloud();
  useSeatLooks(game, settings, cloud, dispatch);
  useAutoLink(game, state, cloud, dispatch);

  return (
    <motion.div {...fade} className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <LongNightNudge game={game} dispatch={dispatch} />
        <LinkPrompts game={game} state={state} cloud={cloud} dispatch={dispatch} />
        <TableToolbar game={game} settings={settings} v={v} dispatch={dispatch} cloud={cloud} />
        <PokerTable game={game} cur={cur} maxSeats={settings.maxSeats} entry={gameEntry(game, settings)}
          onSeatTap={(id) => setSheet(id)} onAddPlayer={() => setSheet('add')}
          onArrange={(positions) => dispatch({ type: 'SET_POSITIONS', positions })} />
        {game.seats.length === 0 && <p className="mt-3 text-center text-sm text-slate-400">לחצו על <b className="text-white">הוסף שחקן</b> במרכז השולחן.</p>}
      </div>

      <aside className="space-y-3">
        <div className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <TableNameEdit game={game} dispatch={dispatch} />
            <span className="text-xs text-slate-500">התחיל ב-{new Date(game.startedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="סה״כ קניות"><M v={v.totalBuyIn} cur={cur} /></StatTile>
            <StatTile label="צ'יפים בשולחן"><Chips v={v.boughtChips} /></StatTile>
          </div>
          <p className="mt-2 text-xs text-slate-500">כניסה של <M v={settings.defaultBuyIn} cur={cur} /> = <Chips v={settings.defaultBuyIn * game.chipsPerUnit} /> צ'יפים</p>
          <ul className="mt-2 divide-y divide-white/5">
            {byInvested(v.rows).map((r) => (
              <li key={r.seat.id}>
                <button onClick={() => setSheet(r.seat.id)} className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm hover:bg-white/5">
                  <span className="flex items-center gap-2 text-slate-200"><ChipAvatar avatar={r.seat.avatar} chip={seatChip(r.seat, r.i)} size={24} dim={r.seat.leftEarly} />{r.seat.name}{entriesOf(r.buyIn, gameEntry(game, settings)) > 1 && <span className="text-[11px] text-slate-500">×{entriesOf(r.buyIn, gameEntry(game, settings))}</span>}</span>
                  <span className="flex items-center gap-2 text-slate-400">
                    <M v={r.buyIn} cur={cur} />
                    {r.seat.leftEarly && <M v={fromCents(r.netC)} signed cur={cur} className={`font-bold ${netTone(r.netC)}`} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <ExpensesCard game={game} settings={settings} dispatch={dispatch} />
        <NightLog game={game} settings={settings} />
        <LiveShareCard game={game} settings={settings} />
        <button disabled={game.seats.length === 0} onClick={() => dispatch({ type: 'SET_PHASE', phase: 'cashout' })} className="btn-primary w-full text-lg">
          <Wallet size={20} /> סיום משחק וספירת צ'יפים
        </button>
        {!confirmDiscard
          ? <button onClick={() => setConfirmDiscard(true)} className="w-full py-1 text-sm text-slate-500 hover:text-rose-300">בטל משחק בלי לשמור</button>
          : <div className="flex gap-2">
              <button onClick={() => setConfirmDiscard(false)} className="btn-ghost flex-1">השאר</button>
              <button onClick={() => { dispatch({ type: 'DISCARD' }); setConfirmDiscard(false); }} className="btn-danger flex-1">כן, לבטל</button>
            </div>}
      </aside>

      <AddPlayerSheet open={sheet === 'add'} state={state} dispatch={dispatch} onClose={() => setSheet(null)} />
      <SeatSheet seat={seat} game={game} settings={settings} dispatch={dispatch} onClose={() => setSheet(null)} players={state.players} />
    </motion.div>
  );
}

/* ---------------------------------------------------------------- cash-out */
function ZeroSumBanner({ v, cur }) {
  const word = CURRENCY_WORD[cur] || cur;
  if (v.missing.length > 0) {
    return <GlowAlert tone="warn" title={v.missing.length === 1 ? 'עוד שחקן אחד בלי ספירה' : `עוד ${v.missing.length} שחקנים בלי ספירה`}>לחצו על: {v.missing.join(', ')}</GlowAlert>;
  }
  if (v.diffChips < 0) {
    return (
      <GlowAlert tone="error" title={`חסרים ${numFmt(-v.diffMoney)} ${word} בצ'יפים`}>
        נקנו <Chips v={v.boughtChips} /> צ'יפים, ונספרו רק <Chips v={v.countedChips} /> (חסרים <Chips v={-v.diffChips} />). אולי שחקן ספר פחות מדי, או שקנייה נרשמה פעמיים.
      </GlowAlert>
    );
  }
  if (v.diffChips > 0) {
    return (
      <GlowAlert tone="error" title={`יש ${numFmt(v.diffMoney)} ${word} עודפים בצ'יפים`}>
        נקנו <Chips v={v.boughtChips} /> צ'יפים, אבל נספרו <Chips v={v.countedChips} /> (עודף של <Chips v={v.diffChips} />). אולי קנייה נוספת לא נרשמה, או שחקן ספר יותר מדי.
      </GlowAlert>
    );
  }
  return <GlowAlert tone="ok" title="הספירה מאוזנת">קניות <M v={v.totalBuyIn} cur={cur} /> = <Chips v={v.countedChips} /> צ'יפים שנספרו</GlowAlert>;
}

/** Live "what's left to count" row: bought chips minus chips counted so far. */
function RemainderBar({ v, cur, ratio, dispatch }) {
  const remaining = Math.round((v.boughtChips - v.countedChips) * 1000) / 1000;
  const pct = v.boughtChips > 0 ? Math.min(100, (v.countedChips / v.boughtChips) * 100) : 0;
  const lastOne = v.missing.length === 1 ? v.rows.find((r) => !r.counted) : null;
  const tone = remaining < 0 ? 'rose' : remaining === 0 && v.missing.length === 0 ? 'emerald' : 'amber';
  const styles = {
    amber: 'border-amber-300/40 bg-amber-400/10 text-amber-50 shadow-glow-amber',
    emerald: 'border-emerald-300/40 bg-emerald-400/10 text-emerald-50 shadow-glow-emerald',
    rose: 'border-rose-400/60 bg-rose-500/15 text-rose-50 shadow-glow-rose',
  }[tone];
  const bar = { amber: 'from-amber-200 to-amber-400', emerald: 'from-emerald-300 to-emerald-500', rose: 'from-rose-300 to-rose-500' }[tone];
  return (
    <div className={`rounded-3xl border px-4 py-3 backdrop-blur-xl ${styles}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{remaining < 0 ? 'נספרו יותר מדי' : 'שארית לספירה'}</span>
        <span className="text-2xl font-black tabular">
          <Chips v={Math.abs(remaining)} /> <span className="text-sm font-medium opacity-80">צ'יפים</span>
          <span className="mr-2 text-sm font-semibold opacity-80">(<M v={Math.abs(remaining) / ratio} cur={cur} />)</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className={`h-full rounded-full bg-gradient-to-l ${bar}`} animate={{ width: `${pct}%` }} transition={{ type: 'spring', damping: 22 }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs opacity-80">
        <span>נספרו <Chips v={v.countedChips} /> מתוך <Chips v={v.boughtChips} /></span>
        {lastOne && remaining >= 0 && (
          <button onClick={() => dispatch({ type: 'SET_COUNT', seatId: lastOne.seat.id, chips: remaining })}
            className="rounded-full border border-current px-2.5 py-0.5 font-semibold opacity-100">
            תן את השארית ל{lastOne.seat.name}
          </button>
        )}
        {tone === 'emerald' && <span className="font-semibold">הכל נספר ✓</span>}
      </div>
    </div>
  );
}

function CashoutView({ game, settings, dispatch }) {
  const cur = settings.currency;
  const v = validateZeroSum(game);
  const countedN = v.rows.filter((r) => r.counted).length;
  const [openId, setOpenId] = useState(null);
  const openSeat = openId ? game.seats.find((x) => x.id === openId) : null;
  // All the chips are already on the counted players: the rest must have 0. Fill it in (after a short
  // pause, so a number still being typed doesn't trigger it) and jump straight to the settlement.
  const allIn = countedN > 0 && v.missing.length > 0 && Math.abs(v.diffChips) < 1e-6;
  const countSig = game.seats.map((x) => x.cashOutChips ?? '').join('|');
  const filledAt = useRef(null); // don't refill after the user pressed "undo" on the same counts
  useEffect(() => {
    if (!allIn || filledAt.current === countSig) return undefined;
    const t = setTimeout(() => { filledAt.current = countSig; dispatch({ type: 'FILL_ZERO', names: v.missing }); }, 900);
    return () => clearTimeout(t);
  }, [allIn, countSig]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div {...fade} className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-white">ספירת צ'יפים</h2>
          <p className="text-sm text-slate-400">הקלידו כמה צ'יפים יש לכל שחקן. כשכל הצ'יפים נספרו, השאר מקבלים 0 אוטומטית.</p>
        </div>
        <div className="text-sm text-slate-400"><span className="font-bold text-white">{countedN}</span>/{v.rows.length}</div>
      </div>
      <div className="sticky top-[68px] z-20 rounded-3xl bg-night-950/90 backdrop-blur-xl"><RemainderBar v={v} cur={cur} ratio={game.chipsPerUnit} dispatch={dispatch} /></div>
      {(v.missing.length === 0 || v.diffChips > 0) && <ZeroSumBanner v={v} cur={cur} />}

      <ul className="space-y-2">
        {v.rows.map((r, i) => (
          <motion.li key={r.seat.id} initial={false}>
            <div className="glass flex items-center gap-3 p-3">
              <button onClick={() => setOpenId(r.seat.id)} aria-label={`פעולות ל${r.seat.name}`} className="shrink-0 rounded-full transition active:scale-90">
                <ChipAvatar avatar={r.seat.avatar} chip={seatChip(r.seat, r.i)} size={38} dim={r.seat.leftEarly} />
              </button>
              <div className="min-w-0 flex-1" onClick={() => setOpenId(r.seat.id)}>
                <div className="truncate font-bold text-white">{r.seat.name}{r.seat.leftEarly && <span className="text-xs font-normal text-slate-500"> (יצא מוקדם)</span>}</div>
                <div className="text-xs text-slate-400">קנה ב-<M v={r.buyIn} cur={cur} /> · <Chips v={r.boughtChips} /> צ'יפים</div>
                {r.counted && (
                  <div className="text-xs">
                    <span className="text-slate-300">שווי <M v={r.cashOut} cur={cur} /></span> · <span className={`font-bold ${netTone(r.netC)}`}><M v={fromCents(r.netC)} signed cur={cur} /></span>
                  </div>
                )}
              </div>
              <input type="number" inputMode="numeric" min="0" dir="ltr" placeholder="צ'יפים" aria-label={`צ'יפים של ${r.seat.name}`}
                value={r.seat.cashOutChips ?? ''} onFocus={(e) => e.target.select()}
                onChange={(e) => dispatch({ type: 'SET_COUNT', seatId: r.seat.id, chips: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) })}
                className={`w-28 shrink-0 rounded-2xl border bg-white/[0.06] px-3 py-3 text-center text-xl font-black tabular text-amber-200 outline-none placeholder:text-sm placeholder:font-normal placeholder:text-slate-500 focus:border-emerald-300/60 focus:shadow-glow-emerald ${r.counted ? 'border-white/10' : 'border-amber-300/40'}`} />
            </div>
          </motion.li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button onClick={() => dispatch({ type: 'SET_PHASE', phase: 'playing' })} className="btn-ghost"><ArrowRight size={18} /> לשולחן</button>
        <button disabled={!v.balanced} onClick={() => dispatch({ type: 'SET_PHASE', phase: 'settle' })} className="btn-primary flex-1 text-lg"><Calculator size={20} /> חשב מי חייב למי</button>
      </div>
      <p className="text-center text-[11px] text-slate-500">שכחתם לרשום קנייה? לחצו על הדמות של השחקן.</p>
      <SeatSheet seat={openSeat} game={game} settings={settings} dispatch={dispatch} onClose={() => setOpenId(null)} />
    </motion.div>
  );
}

/* ---------------------------------------------------------------- settlement */
function SettleView({ game, settings, dispatch, players }) {
  const cloud = useCloud();
  const cur = settings.currency;
  const v = validateZeroSum(game);
  const nets = useMemo(() => computeNets(v), [game]); // eslint-disable-line react-hooks/exhaustive-deps
  const settlements = useMemo(() => computeSettlements(withExpenses(nets, game)), [nets, game.expenses]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shareMsg, setShareMsg] = useState('');

  if (!v.balanced) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <ZeroSumBanner v={v} cur={cur} />
        <button onClick={() => dispatch({ type: 'SET_PHASE', phase: 'cashout' })} className="btn-primary w-full">חזרה לספירה</button>
      </div>
    );
  }

  const sorted = [...nets].sort((a, b) => b.netC - a.netC);
  // Viral share: the transfers + a link where everyone sees tonight's settlement and is invited
  // to join the table and follow their all-time stats.
  const settleLink = async () => {
    const snap = makeSnapshot(game, settings, { ph: 'settle' });
    if (cloudConfigured && navigator.onLine !== false) {
      try {
        const live = getLiveSession();
        const sess = live?.gameId === game.id ? live : await startLive(game.id, snap, game.groupId);
        await pushLive(sess, snap).catch(() => {});
        return `${appBaseUrl()}?view=${sess.token}`;
      } catch { /* fall back to a link that carries the result itself */ }
    }
    return `${appBaseUrl()}#snap=${encodeSnap(snap)}`;
  };
  // phone numbers of whoever receives money (a shared wallet: its first member's phone)
  const winnerPhones = () => {
    const seen = new Set();
    const lines = settlements.filter((p) => !seen.has(p.toId) && seen.add(p.toId)).map((p) => {
      const ph = players?.[p.toId]?.phone;
      return ph ? `${p.toMembers ? p.toMembers[0] : p.to} ${ph.startsWith('+972') ? `0${ph.slice(4)}` : ph}` : null;
    }).filter(Boolean);
    return lines.length ? ['📱 מספרי טלפון להעברות:', ...lines, ''] : [];
  };
  const share = async () => {
    setShareMsg('מכין קישור…');
    try {
      const url = await settleLink();
      const text = [
        `🃏 הסליקה של הערב${game.name ? ` ב"${game.name}"` : ''} · ${new Date().toLocaleDateString('he-IL')}`, '',
        ...settlements.map((p) => `• ${p.from} ← ${p.fromMembers ? 'מעבירים' : 'מעביר'} ל${p.to} ${numFmt(p.amount)}${cur}`), '',
        ...winnerPhones(), // only the people receiving money, so everyone knows where to send it
        '👀 צפו בסליקה, הצטרפו לשולחן שלנו ועקבו אחרי הסטטיסטיקה שלכם לאורך זמן:', url,
      ].join('\n');
      track('settlement_shared', { transfers: settlements.length, native: !!navigator.share });
      if (navigator.share) { await navigator.share({ text }); setShareMsg(''); return; }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      setShareMsg('');
    } catch { setShareMsg(''); }
  };
  const record = () => ({
    id: game.id, type: 'cash', startedAt: game.startedAt, endedAt: new Date().toISOString(), chipsPerUnit: game.chipsPerUnit,
    results: v.rows.map((r) => {
      const n = nets.find((x) => x.playerId === r.seat.playerId);
      const phone = players?.[r.seat.playerId]?.phone;
      return {
        playerId: r.seat.playerId, name: r.seat.name, avatar: r.seat.avatar, buyIn: r.buyIn, cashOutChips: r.seat.cashOutChips, cashOut: fromCents(r.buyInC + n.netC), net: fromCents(n.netC),
        ...(r.seat.userId ? { userId: r.seat.userId } : {}), ...(r.seat.phoneHash ? { phoneHash: r.seat.phoneHash } : phone ? { phone } : {}),
      };
    }),
    settlements: settlements.map((p) => (game.paid?.[paidKey(p)] ? { ...p, paid: true } : p)),
    tableId: game.tableId, name: game.name || '', felt: game.felt || 'green',
    ...(game.expenses?.length ? { expenses: game.expenses.map((e) => ({ ...e, paidByName: game.seats.find((x) => x.id === e.paidBy)?.name || '' })) } : {}),
    ...(game.groupId ? { groupId: game.groupId } : {}),
    cloud: !!cloud.signedIn, // signed-in players get every night saved to their table + stats automatically
  });

  return (
    <motion.div {...fade} className="mx-auto max-w-xl space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl font-black text-white">סליקה</h2>
        {settlements.length > 0 && (
          <button onClick={share} className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-200 shadow-glow-emerald">
            <Share2 size={15} /> {shareMsg || 'שיתוף הסליקה'}
          </button>
        )}
      </div>
      <ZeroSumBanner v={v} cur={cur} />

      <div className="space-y-2.5">
        <div className="text-sm text-slate-400">{settlements.length === 0 ? 'כולם יצאו באפס, אין תשלומים.' : `${settlements.length} העברות סוגרות את הערב:`}</div>
        {settlements.map((p, i) => {
          const pk = paidKey(p);
          const paid = !!game.paid?.[pk];
          return (
          <motion.div key={i} initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.12, type: 'spring', damping: 18 }}
            className={`glass relative overflow-hidden p-4 transition ${paid ? 'opacity-60' : ''}`}>
            <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <ChipAvatar avatar={p.fromAvatar} chip={p.fromChip} size={38} />
                <span className="max-w-[80px] truncate text-xs font-bold text-rose-200">{p.from}</span>
                {p.fromMembers && <span className="flex items-center gap-0.5 text-[10px] text-cyan-300"><Link2 size={10} /> כיס משותף</span>}
              </div>
              <div className="flex flex-1 flex-col items-center">
                <div className="text-sm text-slate-300">{p.from} {p.fromMembers ? 'מעבירים' : 'מעביר'} ל{p.to}</div>
                <div className="text-2xl font-black text-white drop-shadow-[0_0_12px_rgba(52,211,153,.6)]"><M v={p.amount} cur={cur} /></div>
                <motion.div animate={{ x: [6, -6, 6] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }} className="text-emerald-300">
                  <ArrowLeft size={20} />
                </motion.div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ChipAvatar avatar={p.toAvatar} chip={p.toChip} size={38} />
                <span className="max-w-[80px] truncate text-xs font-bold text-emerald-200">{p.to}</span>
                {p.toMembers && <span className="flex items-center gap-0.5 text-[10px] text-cyan-300"><Link2 size={10} /> כיס משותף</span>}
              </div>
            </div>
            <button onClick={() => { buzz(paid ? 6 : [10, 30, 10]); dispatch({ type: 'SET_PAID', key: pk, on: !paid }); }}
              className={`relative mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border py-2 text-sm font-bold transition ${paid ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
              {paid ? <><Check size={16} /> שולם</> : 'סמנו כששולם'}
            </button>
          </motion.div>
          );
        })}
        {settlements.length > 0 && (
          <div className="text-center text-xs text-slate-500">
            {settlements.filter((p) => game.paid?.[paidKey(p)]).length}/{settlements.length} העברות שולמו · הצופים בקישור רואים את זה
          </div>
        )}
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400"><tr className="border-b border-white/10">
            <th className="px-3 py-2 text-right font-medium">שחקן</th><th className="px-3 py-2 font-medium">קנה</th><th className="px-3 py-2 font-medium">צ'יפים</th><th className="px-3 py-2 font-medium">נטו</th>
          </tr></thead>
          <tbody>
            {sorted.map((n) => {
              const r = v.rows.find((x) => x.seat.playerId === n.playerId);
              return (
                <tr key={n.playerId} className="border-t border-white/5 text-center">
                  <td className="px-3 py-2 text-right"><span className="flex items-center gap-2 font-medium text-white"><ChipAvatar avatar={n.avatar} chip={n.chip} size={20} />{n.name}</span></td>
                  <td className="px-3 py-2 text-slate-300"><M v={r.buyIn} cur={cur} /></td>
                  <td className="px-3 py-2 text-slate-300"><Chips v={r.seat.cashOutChips} /></td>
                  <td className={`px-3 py-2 font-bold ${netTone(n.netC)}`}><M v={fromCents(n.netC)} signed cur={cur} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ExpensesCard game={game} settings={settings} dispatch={dispatch} compact />

      <div className="flex gap-2">
        <button onClick={() => dispatch({ type: 'SET_PHASE', phase: 'cashout' })} className="btn-ghost"><ArrowRight size={18} /> לספירה</button>
        <button onClick={() => { const rec = record(); track('game_saved', { players: rec.results.length, transfers: rec.settlements.length, rebuys: game.seats.reduce((a, s) => a + s.transactions.length - 1, 0), duration_min: Math.round((Date.parse(rec.endedAt) - Date.parse(rec.startedAt)) / 60000) }); dispatch({ type: 'FINISH', record: rec }); }} className="btn-primary flex-1 text-lg"><Save size={20} /> שמור וסגור משחק</button>
      </div>
    </motion.div>
  );
}

export const paidKey = (p) => `${p.from}>${p.to}`;

/* ---------------------------------------------------------------- screen */
export function GameScreen({ state, dispatch, onNavigate, playTable, onPlayTableUsed }) {
  const game = state.activeGame;
  const key = !game ? 'start' : game.phase;
  return (
    <motion.div key={key}>
        {!game && <HomeScreen state={state} dispatch={dispatch} onNavigate={onNavigate} playTable={playTable} onPlayTableUsed={onPlayTableUsed} />}
        {game?.phase === 'playing' && <TableView state={state} dispatch={dispatch} />}
        {game?.phase === 'cashout' && <CashoutView game={game} settings={state.settings} dispatch={dispatch} />}
        {game?.phase === 'settle' && <SettleView game={game} settings={state.settings} dispatch={dispatch} players={state.players} />}
    </motion.div>
  );
}
