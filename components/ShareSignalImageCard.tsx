import React, { forwardRef } from 'react';
import { TradeSignal, SignalType } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { LOGO_SRC } from './Logo';

interface Props {
  signal: TradeSignal;
  utcLabel?: string;
}

const ShareSignalImageCard = forwardRef<HTMLDivElement, Props>(
  ({ signal, utcLabel }, ref) => {
    const sym = signal.asset;
    const isBuy = signal.type === SignalType.BUY;
    const isSell = signal.type === SignalType.SELL;
    const dirColor = isBuy
      ? '#34d399'
      : isSell
        ? '#f87171'
        : '#94a3b8';
    const dirBg = isBuy
      ? 'rgba(16,185,129,0.15)'
      : isSell
        ? 'rgba(248,113,113,0.15)'
        : 'rgba(148,163,184,0.12)';
    const time = new Date(signal.timestamp).toLocaleString('pt-BR');
    const conf = signal.confluences?.slice(0, 5) ?? [];

    return (
      <div
        ref={ref}
        data-share-export
        style={{
          width: 420,
          fontFamily: 'Inter, system-ui, sans-serif',
          background: 'linear-gradient(165deg, #020204 0%, #0a1628 45%, #050508 100%)',
          borderRadius: 24,
          border: '1px solid rgba(59,130,246,0.25)',
          padding: 28,
          color: '#fff',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(37,99,235,0.12)',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: -40,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: isBuy
              ? 'rgba(16,185,129,0.08)'
              : 'rgba(239,68,68,0.08)',
            filter: 'blur(35px)',
          }}
        />

        {/* Header brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              src={LOGO_SRC}
              alt="Lux Trader FX"
              crossOrigin="anonymous"
              style={{ width: 44, height: 44, objectFit: 'contain' }}
            />
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              Institutional AI
            </p>
            <h1
              style={{
                margin: '4px 0 0',
                fontSize: 22,
                fontWeight: 900,
                fontStyle: 'italic',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(90deg, #fff 0%, #93c5fd 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              LUX TRADER FX
            </h1>
          </div>
        </div>

        {/* Asset + direction */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 18,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>{signal.asset}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              {signal.marketCondition ?? 'Análise institucional'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 900,
                background: dirBg,
                color: dirColor,
                border: `1px solid ${dirColor}40`,
              }}
            >
              {signal.type}
            </span>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 28,
                fontWeight: 900,
                color:
                  (signal.confidence ?? signal.score) >= 85
                    ? '#34d399'
                    : (signal.confidence ?? signal.score) >= 72
                      ? '#22d3ee'
                      : '#fbbf24',
              }}
            >
              {signal.confidence ?? signal.score}%
            </p>
            <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>
              {signal.confidenceLabel ?? 'Score IA'}
            </p>
          </div>
        </div>

        {/* Levels grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 16,
          }}
        >
          {[
            ['Entrada', formatPrice(signal.entry, sym), '#60a5fa'],
            ['Stop Loss', formatPrice(signal.sl, sym), '#f87171'],
            ['TP1', formatPrice(signal.tp1, sym), '#34d399'],
            ['TP2', formatPrice(signal.tp2, sym), '#34d399'],
            ['TP3', formatPrice(signal.tp3, sym), '#34d399'],
            ['R:R', signal.riskReward, '#22d3ee'],
          ].map(([label, value, color]) => (
            <div
              key={label as string}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <p style={{ margin: 0, fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>
                {label}
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: color as string,
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {conf.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 9,
                color: '#22d3ee',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}
            >
              Confluências
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {conf.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 10,
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: 'rgba(34,211,238,0.1)',
                    border: '1px solid rgba(34,211,238,0.2)',
                    color: '#67e8f9',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 14,
            marginTop: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>
            {time}
            {utcLabel ? ` · ${utcLabel}` : ''}
          </p>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 11,
              fontWeight: 700,
              color: '#3b82f6',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Operação gerada por Lux Trader IA
          </p>
        </div>
      </div>
    );
  }
);

ShareSignalImageCard.displayName = 'ShareSignalImageCard';
export default ShareSignalImageCard;
