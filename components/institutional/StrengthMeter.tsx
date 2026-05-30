import React, { memo } from 'react';
import { AssetStrength } from '../../types/execution';

interface Props {
  assets: AssetStrength[];
}

const StrengthMeter: React.FC<Props> = memo(({ assets }) => (
  <div className="glass-morphism rounded-xl border border-white/5 p-3 h-full">
    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
      Strength Meter
    </span>
    <div className="space-y-2">
      {assets.slice(0, 8).map((a) => (
        <div key={a.symbol}>
          <div className="flex justify-between text-[9px] font-mono mb-0.5">
            <span className="text-zinc-400">{a.symbol}</span>
            <span className={a.strength >= 60 ? 'text-green-400' : 'text-red-400'}>{a.strength}%</span>
          </div>
          <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${a.strength >= 60 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${a.strength}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
));

StrengthMeter.displayName = 'StrengthMeter';
export default StrengthMeter;
