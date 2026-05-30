import React, { memo } from 'react';
import { BarChart3 } from 'lucide-react';

const ChartSkeleton: React.FC = memo(() => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 z-20">
    <div className="w-full h-full max-w-md px-8 flex flex-col justify-end gap-2 pb-12 opacity-40">
      {[40, 65, 45, 80, 55, 70, 50, 90, 60, 75].map((h, i) => (
        <div
          key={i}
          className="flex-1 max-h-[12%] bg-gradient-to-t from-blue-600/30 to-cyan-500/10 rounded-t animate-pulse"
          style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <BarChart3 className="w-8 h-8 text-blue-500/60 animate-pulse" />
      <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold">
        Carregando gráfico…
      </p>
    </div>
  </div>
));

ChartSkeleton.displayName = 'ChartSkeleton';
export default ChartSkeleton;
