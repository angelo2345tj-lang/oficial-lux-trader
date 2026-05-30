import React, { useEffect, useState, useMemo } from 'react';
import Logo from './Logo';
import { preloadApp, PreloadProgress } from '../utils/preloadApp';

interface Props {
  onComplete: () => void;
  symbol?: string;
  timeframe?: string;
}

const SPLASH_MS = 1500;

export default function PremiumSplash({
  onComplete,
  symbol = 'BTCUSD',
  timeframe = '60',
}: Props) {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('Inicializando');

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: `${(i * 17) % 100}%`,
        top: `${(i * 23) % 100}%`,
        size: 1 + (i % 3),
        delay: `${(i % 5) * 0.4}s`,
      })),
    []
  );

  useEffect(() => {
    let done = false;
    const start = Date.now();

    preloadApp(symbol, timeframe, (p: PreloadProgress) => {
      setProgress(p.pct);
      setStep(p.step);
    }).catch(() => undefined);

    const finishTimer = setTimeout(() => {
      if (done) return;
      done = true;
      setFadeOut(true);
      setTimeout(onComplete, 380);
    }, SPLASH_MS);

    return () => {
      clearTimeout(finishTimer);
      done = true;
    };
  }, [symbol, timeframe, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[3000] flex items-center justify-center overflow-hidden bg-[#020204] transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.12)_0%,transparent_65%)]" />
      <div className="absolute w-[480px] h-[480px] rounded-full bg-blue-600/15 blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />

      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-blue-400/50 animate-pulse"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            animationDelay: p.delay,
            opacity: 0.35,
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-blue-500/25 blur-3xl rounded-full scale-150" />
          <Logo className="w-28 h-28 sm:w-36 sm:h-36 relative" animate showText={false} />
        </div>

        <h1 className="text-2xl sm:text-4xl font-black italic tracking-[0.2em] text-white uppercase">
          Lux Trader FX
        </h1>
        <p className="mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-[0.55em] text-blue-400/90">
          Institutional AI Trading System
        </p>

        <div className="w-56 sm:w-72 h-1 rounded-full bg-zinc-900 border border-white/10 overflow-hidden mt-10">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(progress, 12)}%` }}
          />
        </div>
        <p className="mt-4 text-[9px] uppercase tracking-[0.35em] text-zinc-600 animate-pulse">
          {step}…
        </p>
      </div>
    </div>
  );
}
