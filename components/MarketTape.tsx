import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

interface TapeTick {
  id: string;
  price: number;
  direction: 'up' | 'down';
  time: string;
}

interface MarketTapeProps {
  symbol: string;
  price: number;
  status: string;
  provider?: string | null;
}

const MarketTape: React.FC<MarketTapeProps> = ({ symbol, price, status, provider }) => {
  const [ticks, setTicks] = useState<TapeTick[]>([]);
  const prevPrice = React.useRef(price);

  useEffect(() => {
    if (price <= 0) return;
    const dir = price >= prevPrice.current ? 'up' : 'down';
    prevPrice.current = price;
    setTicks((prev) => [
      {
        id: `${Date.now()}`,
        price,
        direction: dir,
        time: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
      },
      ...prev.slice(0, 24),
    ]);
  }, [price]);

  return (
    <div className="glass-morphism rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/40">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tape — {symbol}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
            status === 'connected' ? 'bg-green-500/20 text-green-400' :
            status === 'fallback' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {status}
          </span>
          {provider && (
            <span className="text-[9px] font-mono text-zinc-600 uppercase">{provider}</span>
          )}
        </div>
      </div>
      <div className="max-h-[120px] overflow-y-auto custom-scrollbar">
        {ticks.length === 0 ? (
          <p className="text-center text-[10px] text-zinc-600 py-6 uppercase tracking-widest">Aguardando ticks reais...</p>
        ) : (
          ticks.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.02] hover:bg-white/5 font-mono text-xs">
              <span className="text-zinc-600">{t.time}</span>
              <span className={t.direction === 'up' ? 'text-green-400' : 'text-red-400'}>
                {t.price.toFixed(symbol.includes('JPY') ? 3 : 5)}
              </span>
              {t.direction === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MarketTape;
