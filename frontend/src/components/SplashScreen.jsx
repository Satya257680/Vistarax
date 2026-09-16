// VistaraX - Boot / transition splash screen. Shown for a moment before
// the Landing page on every fresh load (see App.jsx) and again after a
// successful sign-in, before the Dashboard mounts (see pages/Login.jsx) -
// same visual language as the rest of the app (dark glass + glow), with a
// progress bar and the brand name spelling itself out letter by letter as
// the percentage climbs, e.g. 10% -> "V", 20% -> "VI", 30% -> "VIS" ...
import React, { useEffect, useRef, useState } from 'react';

const BRAND = 'VISTARAX';
const TAGLINE = 'Visitor Intelligence Platform';

export default function SplashScreen({ duration = 2400, onComplete }) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    function tick(ts) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        setTimeout(() => onComplete?.(), 220);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // Reveal one more letter of the brand name every ~1/8th of the way
  // through, so "V" lands around 10-12%, "VI" around 20-25%, and so on
  // until the full name is spelled out just before 100%.
  const lettersShown = Math.max(1, Math.min(BRAND.length, Math.ceil((progress / 100) * BRAND.length)));
  const visible = BRAND.slice(0, lettersShown);
  const hidden = BRAND.slice(lettersShown);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-base-950 bg-grid-glow overflow-hidden">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent-blue/20 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-violet/20 blur-[120px]" />

      <div className="relative flex flex-col items-center px-6 animate-fade-in">
        <img
          src="/vistarax-logo.png"
          alt="VistaraX"
          className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl shadow-glow mb-6"
        />

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[0.15em] sm:tracking-[0.2em]">
          <span className="text-gradient">{visible}</span>
          <span className="text-white/10">{hidden}</span>
        </h1>
        <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-slate-500 mt-3">{TAGLINE}</p>

        <div className="w-56 sm:w-80 h-1 rounded-full bg-white/10 mt-9 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-violet transition-[width] duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="w-56 sm:w-80 flex items-center justify-between mt-2.5 text-[10px] tracking-widest uppercase text-slate-600">
          <span>Initialising</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
}
