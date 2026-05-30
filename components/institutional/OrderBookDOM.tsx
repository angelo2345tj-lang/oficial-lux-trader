import React, { memo } from 'react';
import { OrderBookSnapshot } from '../../types/execution';

interface Props {
  book: OrderBookSnapshot | null;
}

const OrderBookDOM: React.FC<Props> = memo(({ book }) => {
  if (!book) {
    return (
      <div className="glass-morphism rounded-xl p-4 border border-white/5 h-full flex items-center justify-center">
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">DOM — aguardando dados</p>
      </div>
    );
  }

  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 1,
    book.asks[book.asks.length - 1]?.total ?? 1
  );

  return (
    <div className="glass-morphism rounded-xl border border-white/5 overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2 border-b border-white/5 flex justify-between items-center bg-black/50">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">DOM / Order Book</span>
        <span className="text-[10px] font-mono text-amber-400">Spread {book.spread.toFixed(4)}</span>
      </div>
      <div className="flex-1 grid grid-cols-2 text-[10px] font-mono overflow-hidden">
        <div className="border-r border-white/5">
          <div className="px-2 py-1 text-green-500/80 font-black uppercase text-[9px]">Bids</div>
          {book.bids.slice(0, 12).map((l, i) => (
            <div key={i} className="relative px-2 py-0.5 flex justify-between">
              <div
                className="absolute inset-y-0 right-0 bg-green-500/15"
                style={{ width: `${(l.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-green-400">{l.price.toFixed(2)}</span>
              <span className="relative text-zinc-500">{l.size.toFixed(3)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="px-2 py-1 text-red-500/80 font-black uppercase text-[9px]">Asks</div>
          {book.asks.slice(0, 12).map((l, i) => (
            <div key={i} className="relative px-2 py-0.5 flex justify-between">
              <div
                className="absolute inset-y-0 left-0 bg-red-500/15"
                style={{ width: `${(l.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-red-400">{l.price.toFixed(2)}</span>
              <span className="relative text-zinc-500">{l.size.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-white/5 text-center font-mono text-sm text-blue-400 text-glow">
        {book.midPrice.toFixed(2)}
      </div>
    </div>
  );
});

OrderBookDOM.displayName = 'OrderBookDOM';
export default OrderBookDOM;
