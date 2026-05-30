import React, { useMemo, useState, useRef } from 'react';
import { TradeHistoryItem, SignalType, SignalStrength, TradeResult } from '../types';
import {
  History,
  TrendingUp,
  TrendingDown,
  Filter,
  BarChart3,
  Share2,
  CheckCircle2,
  XCircle,
  Download,
  Pencil,
  Activity,
} from 'lucide-react';
import { shareOperation } from '../utils/shareOperation';
import { computeOperationalStats } from '../services/history/operationalStats';
import {
  exportHistoryCsv,
  exportHistoryJson,
  exportFullReport,
  exportStatsSummary,
} from '../services/history/historyExport';
import { resultBadge, timeframeLabel } from '../utils/historyFormat';

interface HistoryPanelProps {
  history: TradeHistoryItem[];
  onDelete?: (id: string) => void;
  onUpdateResult?: (id: string, result: TradeResult, profit: number) => void;
  onEdit?: (item: TradeHistoryItem) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onDelete,
  onUpdateResult,
  onEdit,
}) => {
  const [filter, setFilter] = useState<'ALL' | TradeResult>('ALL');
  const [assetFilter, setAssetFilter] = useState('');
  const [tfFilter, setTfFilter] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => computeOperationalStats(history), [history]);

  const assets = useMemo(
    () => [...new Set(history.map((h) => h.asset))].sort(),
    [history]
  );

  const filtered = useMemo(() => {
    return history.filter((h) => {
      if (filter !== 'ALL' && h.result !== filter) return false;
      if (assetFilter && h.asset !== assetFilter) return false;
      if (tfFilter && h.timeframe !== tfFilter) return false;
      const sc = h.score ?? h.confidence ?? 0;
      if (minScore > 0 && sc < minScore) return false;
      return true;
    });
  }, [history, filter, assetFilter, tfFilter, minScore]);

  const maxEquity = Math.max(...stats.equityCurve.map((e) => Math.abs(e.equity)), 1);

  return (
    <div className="p-4 md:p-10 space-y-6 max-w-5xl mx-auto animate-view-entry pb-40 overflow-x-hidden">
      <div className="flex items-center gap-4 flex-wrap">
        <History className="w-7 h-7 text-blue-500 shrink-0" />
        <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-white">
          Diário Operacional
        </h2>
      </div>

      {/* Dashboard performance */}
      <div className="glass-morphism p-6 rounded-[2rem] border border-cyan-500/15 space-y-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
            Dashboard de Performance
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Win Rate', val: `${stats.winRate.toFixed(1)}%`, c: 'text-green-400' },
            { label: 'Profit Factor', val: stats.profitFactor.toFixed(2), c: 'text-blue-400' },
            { label: 'ROI', val: `${stats.roi.toFixed(1)}%`, c: stats.roi >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Pips Totais', val: String(stats.totalPips), c: 'text-cyan-400' },
            { label: 'Lucro Acum.', val: `$${stats.totalProfit.toFixed(2)}`, c: stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Expectância', val: `$${stats.expectancy.toFixed(2)}`, c: 'text-white' },
            { label: 'Payoff Médio', val: stats.avgPayoff.toFixed(2), c: 'text-white' },
            { label: 'Seq. Win', val: String(stats.currentWinStreak), c: 'text-green-400' },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{s.label}</p>
              <p className={`text-lg font-black italic mono mt-1 ${s.c}`}>{s.val}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-2">Curva de equity</p>
            <div className="flex items-end gap-0.5 h-20">
              {stats.equityCurve.length === 0 ? (
                <p className="text-zinc-600 text-[9px] w-full text-center py-6">Sem dados</p>
              ) : (
                stats.equityCurve.slice(-40).map((p, i) => (
                  <div
                    key={`${p.t}-${i}`}
                    className={`flex-1 rounded-t min-w-[3px] ${p.equity >= 0 ? 'bg-cyan-500/50' : 'bg-red-500/50'}`}
                    style={{ height: `${Math.max(8, (Math.abs(p.equity) / maxEquity) * 100)}%` }}
                    title={`${p.t}: $${p.equity}`}
                  />
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-2">Wins x Losses</p>
            <div className="flex h-20 rounded-2xl overflow-hidden border border-white/5">
              <div
                className="bg-green-500/60 flex items-center justify-center text-[9px] font-black"
                style={{ width: `${stats.totalOps ? (stats.wins / stats.totalOps) * 100 : 0}%` }}
              >
                {stats.wins}W
              </div>
              <div
                className="bg-red-500/60 flex items-center justify-center text-[9px] font-black"
                style={{ width: `${stats.totalOps ? (stats.losses / stats.totalOps) * 100 : 0}%` }}
              >
                {stats.losses}L
              </div>
              {stats.breakEven > 0 && (
                <div
                  className="bg-amber-500/60 flex items-center justify-center text-[9px] font-black"
                  style={{ width: `${(stats.breakEven / stats.totalOps) * 100}%` }}
                >
                  {stats.breakEven}BE
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'WIN RATE', val: `${stats.winRate.toFixed(1)}%`, color: 'text-green-500' },
          { label: 'ROI', val: `${stats.roi.toFixed(1)}%`, color: stats.roi >= 0 ? 'text-green-500' : 'text-red-500' },
          { label: 'LUCRO TOTAL', val: `$${stats.totalProfit.toFixed(2)}`, color: stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500' },
          { label: 'OPERAÇÕES', val: String(stats.totalOps), color: 'text-blue-500' },
        ].map((s) => (
          <div key={s.label} className="glass-morphism p-4 rounded-3xl border border-white/5 text-center">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{s.label}</p>
            <p className={`text-xl font-black italic mono mt-2 ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Lucro diário', val: stats.dailyProfit },
          { label: 'Lucro semanal', val: stats.weeklyProfit },
          { label: 'Lucro mensal', val: stats.monthlyProfit },
        ].map((p) => (
          <div key={p.label} className="glass-morphism p-4 rounded-3xl border border-white/5 text-center">
            <p className="text-[8px] font-black text-zinc-600 uppercase">{p.label}</p>
            <p className={`text-lg font-black mono mt-2 ${p.val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {p.val >= 0 ? '+' : ''}${p.val.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros avançados */}
      <div className="glass-morphism p-4 rounded-2xl border border-white/5 flex flex-wrap gap-3 items-end">
        <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
        <select
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-bold"
        >
          <option value="">Todos ativos</option>
          {assets.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={tfFilter}
          onChange={(e) => setTfFilter(e.target.value)}
          className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-bold"
        >
          <option value="">Todos TF</option>
          {['1', '5', '15', '30', '60', '240'].map((tf) => (
            <option key={tf} value={tf}>
              {timeframeLabel(tf)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={100}
          placeholder="Score IA min"
          value={minScore || ''}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white w-28"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'WIN', 'LOSS', 'BE', 'PENDING'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border ${
              filter === f ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/10 text-zinc-500'
            }`}
          >
            {f === 'ALL' ? 'Todos' : f}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={() => exportHistoryJson(history)} className="export-btn border-blue-500/30 text-blue-400">
          <Download className="w-3.5 h-3.5" /> JSON
        </button>
        <button type="button" onClick={() => exportHistoryCsv(history)} className="export-btn border-emerald-500/30 text-emerald-400">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
        <button type="button" onClick={() => exportFullReport(history)} className="export-btn border-cyan-500/30 text-cyan-400">
          <Download className="w-3.5 h-3.5" /> Relatório
        </button>
        <button type="button" onClick={() => exportStatsSummary(history)} className="export-btn border-amber-500/30 text-amber-400">
          <Download className="w-3.5 h-3.5" /> Resumo
        </button>
      </div>

      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((item) => {
            const badge = resultBadge(item.result);
            const profit = item.profitUsd ?? item.profit;
            return (
              <div
                key={item.id}
                className="glass-morphism p-4 md:p-6 rounded-[2rem] border border-white/5 hover:border-cyan-500/20 hover:shadow-[0_0_24px_rgba(6,182,212,0.08)] transition-all duration-300 flex flex-col md:flex-row gap-5 md:items-center md:justify-between"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div
                    className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border ${badge.className}`}
                  >
                    {item.type === SignalType.BUY ? (
                      <TrendingUp className="w-6 h-6" />
                    ) : (
                      <TrendingDown className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black italic text-white">{item.asset}</h4>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${badge.className}`}>
                        {badge.emoji} {badge.label}
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-500 uppercase mt-1">
                      {item.operationDate ?? new Date(item.timestamp).toLocaleDateString('pt-BR')} ·{' '}
                      {item.operationTime ?? new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                      · {timeframeLabel(item.timeframe)}
                    </p>
                    <p className="text-[9px] font-mono text-zinc-400 mt-1">
                      E {item.entry?.toFixed(5)} → S {item.exitPrice?.toFixed(5) ?? '—'}
                      {item.pips != null && ` · ${item.pips > 0 ? '+' : ''}${item.pips} pips`}
                      {item.riskReward && ` · RR ${item.riskReward}`}
                    </p>
                    {(item.score != null || item.winProbability != null) && (
                      <p className="text-[9px] text-cyan-500/90 mt-1 font-bold">
                        Score {item.score ?? item.confidence}% · Prob. {Math.round(item.winProbability ?? item.assertiveness ?? 0)}%
                      </p>
                    )}
                    {(item.journalNotes ?? item.notes) && (
                      <p className="text-[9px] text-zinc-500 mt-2 italic line-clamp-2">
                        {(item.journalNotes ?? item.notes)?.slice(0, 120)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-left md:text-right shrink-0">
                  <p className={`text-2xl font-black mono italic ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                  </p>
                  {item.profitBrl != null && (
                    <p className="text-[10px] text-zinc-500 mono">
                      {item.profitBrl >= 0 ? '+' : ''}R$ {item.profitBrl.toFixed(2)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3 justify-end">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                    )}
                    {onUpdateResult && item.result === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onUpdateResult(item.id, 'WIN', Math.abs(profit) || 25)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-500 text-[9px] font-black uppercase"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Win
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateResult(item.id, 'LOSS', -Math.abs(item.entryValue || 12))}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-500 text-[9px] font-black uppercase"
                        >
                          <XCircle className="w-3 h-3" /> Loss
                        </button>
                      </>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="text-[8px] text-zinc-600 hover:text-red-500 uppercase"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-24 text-center opacity-30 flex flex-col items-center gap-4">
            <BarChart3 className="w-16 h-16" />
            <p className="text-[12px] font-black uppercase tracking-[0.4em]">Nenhuma operação</p>
          </div>
        )}
      </div>

      <style>{`
        .export-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.75rem;
          border-radius: 0.75rem;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          background: rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};

export default HistoryPanel;
