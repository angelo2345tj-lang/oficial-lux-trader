import React, { memo, useMemo } from 'react';
import { Candle } from '../../services/indicators';
import { LiquidityEngine } from '../../engines/LiquidityEngine';

interface Props {
  candles: Candle[];
}

const LiquidityHeatmap: React.FC<Props> = memo(({ candles }) => {
  const analysis = useMemo(() => LiquidityEngine.analyze(candles), [candles]);
  const cells = useMemo(() => {
    if (!candles.length) return [];
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const range = max - min || 1;
    return candles.slice(-40).map((c) => {
      const intensity = analysis.zones.some(
        (z) => Math.abs(z.price - c.low) < range * 0.02 || Math.abs(z.price - c.high) < range * 0.02
      )
        ? 0.9
        : c.volume / Math.max(...candles.map((x) => x.volume));
      return { intensity: Math.min(1, intensity), bullish: c.close > c.open };
    });
  }, [candles, analysis]);

  return (
    <div className="glass-morphism rounded-xl border border-white/5 p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Liquidity Heatmap</span>
        <span className="text-[10px] font-mono text-cyan-400">{analysis.score}%</span>
      </div>
      <div className="flex-1 grid grid-cols-20 gap-px content-end">
        {cells.map((cell, i) => (
          <div
            key={i}
            className="rounded-sm min-h-[8px] transition-all"
            style={{
              opacity: 0.3 + cell.intensity * 0.7,
              backgroundColor: cell.bullish
                ? `rgba(34,197,94,${cell.intensity})`
                : `rgba(239,68,68,${cell.intensity})`,
              boxShadow: cell.intensity > 0.7 ? '0 0 8px rgba(59,130,246,0.5)' : 'none',
            }}
          />
        ))}
      </div>
      {analysis.sweepDetected && (
        <p className="text-[9px] text-amber-400 font-black uppercase mt-2 animate-pulse">SWEEP ATIVO</p>
      )}
    </div>
  );
});

LiquidityHeatmap.displayName = 'LiquidityHeatmap';
export default LiquidityHeatmap;
