import React, { memo } from 'react';

interface Props {
  symbols: string[];
  matrix: number[][];
}

const CorrelationMatrix: React.FC<Props> = memo(({ symbols, matrix }) => (
  <div className="glass-morphism rounded-xl border border-white/5 p-3 overflow-auto">
    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
      Correlação
    </span>
    <table className="w-full text-[8px] font-mono">
      <thead>
        <tr>
          <th />
          {symbols.map((s) => (
            <th key={s} className="text-zinc-600 p-0.5">
              {s.slice(0, 4)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {symbols.map((row, i) => (
          <tr key={row}>
            <td className="text-zinc-600 p-0.5">{row.slice(0, 4)}</td>
            {matrix[i]?.map((v, j) => (
              <td
                key={j}
                className="p-0.5 text-center rounded"
                style={{
                  backgroundColor:
                    v > 0.7
                      ? 'rgba(34,197,94,0.3)'
                      : v < -0.3
                        ? 'rgba(239,68,68,0.3)'
                        : 'rgba(59,130,246,0.1)',
                }}
              >
                {v.toFixed(2)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));

CorrelationMatrix.displayName = 'CorrelationMatrix';
export default CorrelationMatrix;
