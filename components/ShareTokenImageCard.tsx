import React, { forwardRef } from 'react';
import { LOGO_SRC } from './Logo';

interface Props {
  userName: string;
  token: string;
  welcomeMessage?: string;
}

const ShareTokenImageCard = forwardRef<HTMLDivElement, Props>(
  ({ userName, token, welcomeMessage }, ref) => {
    const msg =
      welcomeMessage ??
      'Bem-vindo ao ecossistema institucional Lux Trader FX. Seu terminal premium está ativo.';

    return (
      <div
        ref={ref}
        data-share-export
        style={{
          width: 420,
          fontFamily: 'Inter, system-ui, sans-serif',
          background: 'linear-gradient(165deg, #020204 0%, #0a1628 42%, #050508 100%)',
          borderRadius: 24,
          border: '1px solid rgba(59,130,246,0.3)',
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
            top: -70,
            right: -50,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'rgba(37,99,235,0.15)',
            filter: 'blur(45px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, position: 'relative' }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: 'rgba(37,99,235,0.15)',
              border: '1px solid rgba(59,130,246,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img src={LOGO_SRC} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} crossOrigin="anonymous" />
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: '0.35em',
                color: '#60a5fa',
                fontWeight: 800,
                textTransform: 'uppercase',
              }}
            >
              Lux Trader FX
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, fontStyle: 'italic' }}>
              Licença Premium
            </p>
          </div>
        </div>

        <p
          style={{
            fontSize: 12,
            lineHeight: 1.55,
            color: '#a1a1aa',
            fontStyle: 'italic',
            marginBottom: 20,
            position: 'relative',
          }}
        >
          {msg}
        </p>

        <div
          style={{
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
            position: 'relative',
          }}
        >
          <p style={{ margin: 0, fontSize: 9, letterSpacing: '0.3em', color: '#71717a', fontWeight: 800 }}>
            OPERADOR
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 900, fontStyle: 'italic' }}>{userName}</p>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(6,182,212,0.08))',
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: 18,
            padding: 18,
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <p style={{ margin: 0, fontSize: 9, letterSpacing: '0.35em', color: '#93c5fd', fontWeight: 800 }}>
            TOKEN DE ACESSO
          </p>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: '0.15em',
              fontFamily: 'ui-monospace, monospace',
              color: '#fff',
            }}
          >
            {token}
          </p>
        </div>

        <p
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 8,
            letterSpacing: '0.4em',
            color: '#52525b',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          Institutional AI · PWA Premium
        </p>
      </div>
    );
  }
);

ShareTokenImageCard.displayName = 'ShareTokenImageCard';
export default ShareTokenImageCard;
