import React from 'react';
import { LogEntry } from '../services/logger';
import { Terminal } from 'lucide-react';

interface AnalysisLogProps {
  logs: LogEntry[];
  maxHeight?: number;
}

const levelColor: Record<string, string> = {
  debug: 'text-zinc-600',
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const AnalysisLog: React.FC<AnalysisLogProps> = ({ logs, maxHeight = 200 }) => (
  <div className="glass-morphism rounded-2xl border border-white/5 overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/40">
      <Terminal className="w-4 h-4 text-blue-500" />
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">System Log</span>
    </div>
    <div className="overflow-y-auto custom-scrollbar p-3 space-y-1 font-mono text-[10px]" style={{ maxHeight }}>
      {logs.length === 0 ? (
        <p className="text-zinc-600 text-center py-4">Sem logs</p>
      ) : (
        logs.slice(0, 40).map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-zinc-700 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
            </span>
            <span className={`uppercase shrink-0 w-10 ${levelColor[log.level]}`}>{log.level}</span>
            <span className="text-zinc-500 truncate">{log.message}</span>
          </div>
        ))
      )}
    </div>
  </div>
);

export default AnalysisLog;
