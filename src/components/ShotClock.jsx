/* Fullscreen shot clock.
 *  - Looks like a green LED wall clock. Default 30s; a scroll wheel picks the time.
 *  - Tap the running clock to add another full period (26s left at 30s → 56s).
 *  - Silent until the last 5 seconds: one tick per second, then a buzzer at 0.
 * Sounds are synthesised with the Web Audio API (no files to download). */
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import { WheelPicker } from './WheelPicker';
import { buzz } from '../lib/haptics';

const KEY = 'hpm-shotclock';
const WHEEL = Array.from({ length: 60 }, (_, i) => (i + 1) * 5).map((v) => ({ value: v, label: v < 60 ? `${v} שניות` : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} דק׳` }));
const clampSec = (n) => Math.max(5, Math.min(300, Math.round(n / 5) * 5));

function useAudio() {
  const ctx = useRef(null);
  const ensure = () => {
    if (!ctx.current) { try { ctx.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx.current = null; } }
    if (ctx.current?.state === 'suspended') ctx.current.resume();
    return ctx.current;
  };
  const tone = (freq, dur, type = 'square', gain = 0.18, when = 0) => {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  };
  return {
    unlock: ensure,
    tick: (last) => { tone(last ? 1500 : 1150, 0.06, 'square', 0.16); tone(last ? 1500 : 1150, 0.03, 'triangle', 0.08, 0.07); },
    buzzer: () => { tone(155, 0.9, 'sawtooth', 0.32); tone(160, 0.9, 'sawtooth', 0.22); tone(77, 0.9, 'square', 0.12); },
  };
}

/* ---- classic 7-segment LED digits (like a digital wall clock) ---- */
const T = 10;
const hSeg = (y, x1, x2) => `${x1},${y} ${x1 + T / 2},${y - T / 2} ${x2 - T / 2},${y - T / 2} ${x2},${y} ${x2 - T / 2},${y + T / 2} ${x1 + T / 2},${y + T / 2}`;
const vSeg = (x, y1, y2) => `${x},${y1} ${x + T / 2},${y1 + T / 2} ${x + T / 2},${y2 - T / 2} ${x},${y2} ${x - T / 2},${y2 - T / 2} ${x - T / 2},${y1 + T / 2}`;
const SEGS = { a: hSeg(6, 9, 51), b: vSeg(54, 9, 48), c: vSeg(54, 52, 91), d: hSeg(94, 9, 51), e: vSeg(6, 52, 91), f: vSeg(6, 9, 48), g: hSeg(50, 9, 51) };
const ON = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];

function Digit({ d, x, lit, dim }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {Object.entries(SEGS).map(([k, pts]) => (
        <polygon key={k} points={pts} fill={ON[d]?.includes(k) ? lit : dim} />
      ))}
    </g>
  );
}

function LedDisplay({ seconds, blink, lit = '#3dff7f', glow = true }) {
  const mm = Math.min(99, Math.floor(seconds / 60)), ss = seconds % 60;
  const ds = [Math.floor(mm / 10), mm % 10, Math.floor(ss / 10), ss % 10];
  const dim = 'rgba(61,255,127,.07)';
  return (
    <svg viewBox="-6 -4 300 108" className="block w-full overflow-visible" aria-hidden="true"
      style={glow ? { filter: `drop-shadow(0 0 5px ${lit}99) drop-shadow(0 0 14px ${lit}44)` } : undefined}>
      <g transform="skewX(-7) translate(10 0)">
        <Digit d={ds[0]} x={0} lit={lit} dim={dim} />
        <Digit d={ds[1]} x={68} lit={lit} dim={dim} />
        <g opacity={blink ? 0.12 : 1}>
          <rect x="135" y="28" width="11" height="11" rx="2" fill={lit} />
          <rect x="135" y="62" width="11" height="11" rx="2" fill={lit} />
        </g>
        <Digit d={ds[2]} x={158} lit={lit} dim={dim} />
        <Digit d={ds[3]} x={226} lit={lit} dim={dim} />
      </g>
    </svg>
  );
}

export function ShotClock({ onClose }) {
  const [base, setBase] = useState(() => { try { return clampSec(Number(window.localStorage.getItem(KEY)) || 30); } catch { return 30; } });
  const [remaining, setRemaining] = useState(base);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [, setFlash] = useState(0);
  useEffect(() => { if (!done) return undefined; const t = setInterval(() => setFlash((x) => x + 1), 500); return () => clearInterval(t); }, [done]);
  const endAt = useRef(0);
  const lastTick = useRef(null);
  const audio = useAudio();

  useEffect(() => { try { window.localStorage.setItem(KEY, String(base)); } catch { /* blocked */ } }, [base]);

  // keep the screen awake while the clock is open
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release?.().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    let raf;
    const loop = () => {
      const left = Math.max(0, (endAt.current - performance.now()) / 1000);
      setRemaining(left);
      const whole = Math.ceil(left);
      if (whole <= 5 && whole >= 1 && lastTick.current !== whole) { lastTick.current = whole; audio.tick(whole === 1); buzz(15); }
      if (left <= 0) { setRunning(false); setDone(true); audio.buzzer(); buzz([220, 90, 220]); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (secs = remaining > 0 && !done ? remaining : base) => {
    audio.unlock();
    endAt.current = performance.now() + secs * 1000;
    lastTick.current = Math.ceil(secs) <= 5 ? Math.ceil(secs) : null;
    setRemaining(secs); setDone(false); setRunning(true); buzz(10);
  };
  const pause = () => { setRunning(false); buzz(8); };
  const reset = () => { setRunning(false); setDone(false); setRemaining(base); lastTick.current = null; };
  const addPeriod = () => { endAt.current += base * 1000; lastTick.current = null; buzz(10); };
  const setDefault = (n) => { const v = clampSec(n); setBase(v); if (!running) { setRemaining(v); setDone(false); } };

  const tapClock = () => {
    if (running) addPeriod();
    else start(done ? base : remaining);
  };
  const onWheel = (e) => { if (!running) setDefault(base + (e.deltaY < 0 ? 5 : -5)); };

  const whole = Math.ceil(remaining);
  const last5 = running && whole <= 5;
  const blink = running ? remaining % 1 < 0.5 : done ? Math.floor(performance.now() / 500) % 2 === 0 : false;
  const total = Math.max(base, remaining);
  const dots = 30, litDots = Math.ceil((remaining / total) * dots);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-night-950" role="dialog" aria-label="שעון עצר">
      <div className="pt-safe flex items-center justify-between px-4 py-3">
        <span className="text-sm font-bold text-slate-300">שעון החלטה</span>
        <button onClick={onClose} aria-label="סגור" className="rounded-full p-2 text-slate-300 hover:bg-white/10"><X size={24} /></button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        {/* wall-clock housing: tap = start / add another period */}
        <button type="button" onClick={tapClock} onWheel={onWheel} aria-label={running ? 'הוסף זמן' : 'הפעל'}
          className={`w-full max-w-[460px] select-none rounded-[22px] border border-white/10 p-[10px] shadow-[0_20px_50px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.08)] transition active:scale-[0.98] ${last5 ? 'animate-pulse' : ''}`}
          style={{ background: 'linear-gradient(180deg,#26282c,#0d0e10)' }}>
          <div className="relative overflow-hidden rounded-[14px] px-4 pb-3 pt-5" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0b1a10 0%,#030604 70%)', boxShadow: 'inset 0 4px 18px rgba(0,0,0,.9)' }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent" />
            <LedDisplay seconds={whole} blink={blink} />
            <div dir="ltr" className="mt-3 flex items-center justify-between font-mono text-[10px] font-bold tracking-widest text-[#3dff7f]/70">
              <span>SHOT CLOCK</span>
              <span className="flex gap-[3px]">
                {Array.from({ length: dots }, (_, i) => (
                  <span key={i} className="h-[6px] w-[3px] rounded-[1px]" style={{ background: i < litDots ? '#3dff7f' : 'rgba(61,255,127,.1)', boxShadow: i < litDots ? '0 0 4px #3dff7f' : 'none' }} />
                ))}
              </span>
              <span>SEC</span>
            </div>
          </div>
        </button>

        <div className="h-5 text-center text-sm text-slate-400">
          {done ? 'הזמן נגמר! לחצו על השעון להתחלה מחדש' : running ? `לחיצה על השעון מוסיפה עוד ${base} שניות` : 'לחצו על השעון להתחלה'}
        </div>

        {!running && (
          <div className="w-full max-w-[260px]">
            <div className="mb-1 text-center text-xs text-slate-500">גללו לבחירת הזמן</div>
            <WheelPicker items={WHEEL} value={base} onChange={(v) => { buzz(4); setDefault(v); }} visible={3} ariaLabel="זמן לכל החלטה" itemClass="text-lg" />
          </div>
        )}
      </div>

      <div className="pb-safe flex justify-center gap-3 px-6 pb-8">
        <button onClick={reset} className="btn-ghost px-5"><RotateCcw size={18} /> איפוס</button>
        {running
          ? <button onClick={pause} className="btn-primary min-w-[150px] text-lg"><Pause size={20} /> עצירה</button>
          : <button onClick={() => start()} className="btn-primary min-w-[150px] text-lg"><Play size={20} /> {done ? 'שוב' : 'התחל'}</button>}
      </div>
    </div>
  );
}
