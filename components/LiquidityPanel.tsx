import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { Candle } from '../services/indicators';
import { LiquidityEngine } from '../engines/LiquidityEngine';

interface LiquidityPanelProps {
  candles: Candle[];
}

const LiquidityPanel: React.FC<LiquidityPanelProps> = ({ candles }) => {
  const analysis = useMemo(() => LiquidityEngine.analyze(candles), [candles]);

  return (
    <div className="glass-morphism rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-cyan-400" />
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Liquidez & DOM</h3>
        <span className="ml-auto text-lg font-black text-cyan-400">{analysis.score}%</span>
      </div>

      <div className="space-y-2">
        {analysis.zones.slice(0, 5).map((z, i) => (
          <div key={i} className="relative h-8 rounded-lg bg-black/50 overflow-hidden border border-white/5">
            <div
              className={`absolute inset-y-0 left-0 ${z.type === 'BUY_SIDE' ? 'bg-green-500/30' : 'bg-red-500/30'}`}
              style={{ width: `${Math.min(100, z.strength)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-mono">
              <span className={z.type === 'BUY_SIDE' ? 'text-green-400' : 'text-red-400'}>
                {z.type === 'BUY_SIDE' ? 'BID LIQ' : 'ASK LIQ'}
              </span>
              <span className="text-zinc-400">{z.price.toFixed(5)}</span>
              {z.swept && <span className="text-amber-400 font-black">SWEPT</span>}
            </div>
          </div>
        ))}
      </div>

      {analysis.sweepDetected && (
        <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest animate-pulse">
          Sweep detectado — {analysis.sweepDirection}
        </p>
      )}

      <div className="text-[10px] text-zinc-500 space-y-1">
        {analysis.notes.slice(0, 3).map((n, i) => (
          <p key={i}>• {n}</p>
        ))}
      </div>
    </div>
  );
};

export default LiquidityPanel;
