import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import { Asset, TradeSignal } from '../types';
import ChartSkeleton from './ChartSkeleton';

interface TradingViewWidgetProps {
  asset: Asset;
  currentSignal: TradeSignal | null;
  timeframe: string;
  timezone: string;
  theme: 'dark' | 'light';
}

function mapInterval(tf: string): string {
  if (tf === 'D' || tf === '1D') return 'D';
  if (tf.endsWith('S')) return '1';
  return tf.replace(/\D/g, '') || '60';
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = memo(
  ({ asset, timeframe, timezone, theme }) => {
    const containerId = useMemo(
      () => `tv_${asset.symbol}_${timeframe}`.replace(/[^a-zA-Z0-9_]/g, '_'),
      [asset.symbol, timeframe]
    );
    const wrapperRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<{ remove?: () => void } | null>(null);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    const destroyWidget = useCallback(() => {
      try {
        widgetRef.current?.remove?.();
      } catch {
        /* ignore */
      }
      widgetRef.current = null;
      if (chartRef.current) chartRef.current.innerHTML = '';
    }, []);

    const mountWidget = useCallback(() => {
      const TV = (window as unknown as { TradingView?: { widget: new (o: object) => { remove?: () => void } } })
        .TradingView;
      const el = chartRef.current;
      if (!TV?.widget || !el || !wrapperRef.current) return;

      destroyWidget();
      el.id = containerId;

      const fullSymbol =
        asset.exchange && asset.symbol
          ? `${asset.exchange}:${asset.symbol}`
          : 'BITSTAMP:BTCUSD';

      const bgColor = theme === 'dark' ? '#050506' : '#ffffff';
      const h = wrapperRef.current.clientHeight || 360;

      try {
        widgetRef.current = new TV.widget({
          autosize: true,
          width: '100%',
          height: h,
          symbol: fullSymbol,
          interval: mapInterval(timeframe),
          timezone: timezone || 'America/Sao_Paulo',
          theme,
          style: '1',
          locale: 'br',
          container_id: containerId,
          backgroundColor: bgColor,
          hide_top_toolbar: true,
          hide_side_toolbar: true,
          hide_legend: false,
          save_image: false,
          studies: ['RSI@tv-basicstudies', 'VWAP@tv-basicstudies'],
          disabled_features: [
            'header_symbol_search',
            'header_compare',
            'use_localstorage_for_settings',
          ],
          enabled_features: [],
          overrides: {
            'paneProperties.background': bgColor,
            'mainSeriesProperties.candleStyle.upColor': '#3b82f6',
            'mainSeriesProperties.candleStyle.downColor': '#f7525f',
          },
        });
        setReady(true);
        setFailed(false);
      } catch {
        setFailed(true);
        setReady(false);
      }
    }, [asset, timeframe, timezone, theme, containerId, destroyWidget]);

    useEffect(() => {
      setReady(false);
      setFailed(false);

      let attempts = 0;
      const tryMount = () => {
        attempts += 1;
        if ((window as unknown as { TradingView?: unknown }).TradingView) {
          mountWidget();
          return;
        }
        if (attempts < 40) {
          setTimeout(tryMount, 80);
        } else {
          setFailed(true);
        }
      };

      const t = setTimeout(tryMount, 150);
      return () => {
        clearTimeout(t);
        destroyWidget();
      };
    }, [mountWidget, destroyWidget]);

    useEffect(() => {
      const wrap = wrapperRef.current;
      if (!wrap) return;

      const ro = new ResizeObserver(() => {
        if ((window as unknown as { TradingView?: unknown }).TradingView) {
          mountWidget();
        }
      });
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [mountWidget]);

    return (
      <div
        ref={wrapperRef}
        className="relative w-full bg-[#050506] rounded-2xl overflow-hidden border border-white/10"
        style={{
          minHeight: '320px',
          height: 'clamp(320px, 55dvh, 500px)',
        }}
      >
        {!ready && !failed && <ChartSkeleton />}
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-zinc-950 gap-2">
            <p className="text-xs text-zinc-500 uppercase tracking-widest">
              Gráfico indisponível
            </p>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                mountWidget();
              }}
              className="text-[10px] font-bold text-blue-400 uppercase"
            >
              Tentar novamente
            </button>
          </div>
        )}
        <div ref={chartRef} className="absolute inset-0 w-full h-full" />
      </div>
    );
  }
);

TradingViewWidget.displayName = 'TradingViewWidget';
export default TradingViewWidget;
