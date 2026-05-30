import React, { memo } from 'react';
import { Shield, Power, AlertTriangle } from 'lucide-react';
import { TradingMode } from '../../types/execution';
import { TRADING_MODES } from '../../config/tradingModes';
import { brokerRouter } from '../../services/execution/brokerRouter';

interface Props {
  mode: TradingMode;
  onModeChange: (m: TradingMode) => void;
  autoExecute: boolean;
  onAutoExecuteChange: (v: boolean) => void;
  killSwitch: boolean;
  onKillSwitch: () => void;
  dailyPnl: number;
  openPositions: number;
}

const MODES: TradingMode[] = ['SCALPER', 'SWING', 'SNIPER', 'HFT', 'SMART_MONEY'];

const ExecutionPanel: React.FC<Props> = memo(
  ({ mode, onModeChange, autoExecute, onAutoExecuteChange, killSwitch, onKillSwitch, dailyPnl, openPositions }) => {
    const brokers = brokerRouter.listAll();

    return (
      <div className="glass-morphism rounded-xl border border-white/5 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-black uppercase tracking-widest text-white">Execution Engine</span>
          </div>
          <button
            onClick={onKillSwitch}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 ${
              killSwitch ? 'bg-red-600 text-white animate-pulse' : 'bg-red-600/20 text-red-400 border border-red-500/30'
            }`}
          >
            <Power className="w-3 h-3" /> Kill Switch
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`py-2 rounded-lg text-[8px] font-black uppercase transition-all ${
                mode === m ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-black/40 text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {TRADING_MODES[m].label.split(' ')[0]}
            </button>
          ))}
        </div>

        <p className="text-[9px] text-zinc-500 italic">{TRADING_MODES[mode].description}</p>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-[10px] font-black uppercase text-zinc-400">Auto Execute</span>
          <input type="checkbox" checked={autoExecute} onChange={(e) => onAutoExecuteChange(e.target.checked)} className="accent-blue-600" />
        </label>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="bg-black/40 rounded-lg p-2 border border-white/5">
            <span className="text-zinc-600 block uppercase text-[8px]">PnL Dia</span>
            <span className={dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}>${dailyPnl.toFixed(2)}</span>
          </div>
          <div className="bg-black/40 rounded-lg p-2 border border-white/5">
            <span className="text-zinc-600 block uppercase text-[8px]">Posições</span>
            <span className="text-blue-400">{openPositions}</span>
          </div>
        </div>

        <div className="space-y-1">
          {brokers.map((b) => (
            <div key={b.id} className="flex justify-between text-[9px] font-mono">
              <span className="text-zinc-500">{b.name}</span>
              <span className={b.configured ? 'text-green-400' : 'text-zinc-700'}>
                {b.configured ? 'READY' : 'NO KEY'}
              </span>
            </div>
          ))}
        </div>

        {killSwitch && (
          <div className="flex items-center gap-2 text-red-400 text-[9px] font-black uppercase animate-pulse">
            <AlertTriangle className="w-4 h-4" /> Sistema pausado — kill switch ativo
          </div>
        )}
      </div>
    );
  }
);

ExecutionPanel.displayName = 'ExecutionPanel';
export default ExecutionPanel;
