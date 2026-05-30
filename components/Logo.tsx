import React from 'react';

export const LOGO_SRC = '/logo.png';

interface LogoProps {
  className?: string;
  showText?: boolean;
  animate?: boolean;
  variant?: 'full' | 'icon';
}

const Logo: React.FC<LogoProps> = ({
  className = 'w-28 h-28 sm:w-32 sm:h-32',
  showText = false,
  animate = false,
  variant = 'icon',
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        select-none
        ${className}
      `}
    >
      {/* CONTAINER PRINCIPAL */}
      <div
        className={`
          relative
          flex
          items-center
          justify-center
          rounded-full
          overflow-hidden
          aspect-square
          ${animate ? 'animate-pulse-soft' : ''}
        `}
      >
        {/* GLOW EXTERNO */}
        <div className="absolute inset-[-15%] rounded-full bg-cyan-500/15 blur-[45px] pointer-events-none" />

        <div className="absolute inset-[-5%] rounded-full bg-amber-400/10 blur-[25px] pointer-events-none" />

        {/* BORDA PREMIUM */}
        <div
          className="
            absolute
            inset-0
            rounded-full
            border
            border-cyan-400/20
            bg-gradient-to-br
            from-white/[0.04]
            to-white/[0.01]
            backdrop-blur-xl
            shadow-[0_0_30px_rgba(34,211,238,0.12)]
          "
        />

        {/* CÍRCULO INTERNO */}
        <div
          className="
            absolute
            inset-[8%]
            rounded-full
            bg-[#050506]
            border
            border-white/5
          "
        />

        {/* LOGO */}
        <img
          src={LOGO_SRC}
          alt="Lux Trader FX"
          draggable={false}
          className={`
            relative
            z-10
            w-[78%]
            h-[78%]
            object-contain
            transition-all
            duration-500
            drop-shadow-[0_0_25px_rgba(34,211,238,0.25)]
            ${animate ? 'hover:scale-105' : ''}
          `}
        />
      </div>

      {/* TEXTO COMPLETO */}
      {showText && (
        <div className="mt-4 flex flex-col items-center text-center leading-none">
          
          <h1
            className="
              text-lg
              sm:text-xl
              font-black
              uppercase
              italic
              tracking-[0.18em]
              bg-gradient-to-b
              from-amber-200
              via-amber-400
              to-amber-600
              bg-clip-text
              text-transparent
              whitespace-nowrap
            "
          >
            LUX TRADER
          </h1>

          <span
            className="
              mt-2
              text-[8px]
              sm:text-[9px]
              font-black
              uppercase
              tracking-[0.38em]
              text-zinc-400
              whitespace-nowrap
            "
          >
            ELITE AI SYSTEM
          </span>
        </div>
      )}

      {/* FRASE PEQUENA */}
      {variant === 'full' && !showText && (
        <div className="mt-3 text-center leading-none">
          <p
            className="
              text-[7px]
              sm:text-[8px]
              font-bold
              uppercase
              tracking-[0.32em]
              text-zinc-500
              whitespace-nowrap
            "
          >
            A IA DOS TRADERS
          </p>
        </div>
      )}
    </div>
  );
};

export default Logo;