import React, { memo } from 'react';
import { AggressionTick } from '../../types/execution';
import { Zap } from 'lucide-react';

interface Props {
  ticks: AggressionTick[];
}

const AggressionFlow: React.FC<Props> = memo(({ ticks }) => {
  const buyVol = ticks.filter((t) => t.side === 'BUY').reduce((a, t) => a + t.size, 0);
  const sellVol = ticks.filter((t) => t.side === 'SELL').reduce((a, t) => a + t.size, 0);
  const total = buyVol + sellVol || 1;
  const buyPct = (buyVol / total) * 100;

  return (
    <div className="glass-morphism rounded-xl border border-white/5 p-3 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fluxo Agressor</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex mb-2">
        <div className="bg-green-500 transition-all" style={{ width: `${buyPct}%` }} />
        <div className="bg-red-500 flex-1" />
      </div>
      <div className="flex justify-between text-[9px] font-mono mb-2">
        <span className="text-green-400">BUY {buyPct.toFixed(0)}%</span>
        <span className="text-red-400">SELL {(100 - buyPct).toFixed(0)}%</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5">
        {ticks.slice(0, 30).map((t, i) => (
          <div key={i} className="flex justify-between text-[9px] font-mono py-0.5 border-b border-white/[0.02]">
            <span className={t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>{t.side}</span>
            <span className="text-zinc-400">{t.price.toFixed(2)}</span>
            <span className="text-zinc-600">{t.size.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

AggressionFlow.displayName = 'AggressionFlow';
export default AggressionFlow;
