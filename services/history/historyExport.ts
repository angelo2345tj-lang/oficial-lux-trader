import { TradeHistoryItem } from '../../types';
import { computeOperationalStats } from './operationalStats';

export function exportHistoryJson(history: TradeHistoryItem[]) {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `lux-historico-${dateStamp()}.json`);
}

export function exportHistoryCsv(history: TradeHistoryItem[]) {
  const header = [
    'id',
    'asset',
    'direction',
    'timeframe',
    'date',
    'time',
    'entry',
    'exit',
    'lot',
    'leverage',
    'pips',
    'rr',
    'result',
    'profit_usd',
    'profit_brl',
    'sl',
    'tp',
    'exit_reason',
    'score',
    'win_prob',
    'followed_ai',
    'entry_timing',
    'market',
    'loss_reason',
    'notes',
  ].join(',');

  const rows = history.map((h) => {
    const ts = new Date(h.timestamp);
    const esc = (v: unknown) => String(v ?? '').replace(/,/g, ';');
    return [
      h.id,
      h.asset,
      h.type,
      h.timeframe,
      h.operationDate ?? ts.toLocaleDateString('pt-BR'),
      h.operationTime ?? ts.toLocaleTimeString('pt-BR'),
      h.entry ?? h.entryValue,
      h.exitPrice,
      h.lotSize,
      h.leverage,
      h.pips,
      h.riskReward,
      h.result,
      h.profitUsd ?? h.profit,
      h.profitBrl,
      h.stopLoss ?? h.stop,
      h.takeProfit ?? h.take,
      h.exitReason,
      h.score ?? h.confidence,
      h.winProbability ?? h.assertiveness,
      h.followedAiSignal,
      h.entryTiming,
      h.marketConditionTag ?? h.marketCondition,
      h.lossReason,
      esc(h.journalNotes ?? h.notes),
    ].join(',');
  });

  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `lux-historico-${dateStamp()}.csv`);
}

export function exportFullReport(history: TradeHistoryItem[]) {
  const stats = computeOperationalStats(history);
  const report = {
    generatedAt: new Date().toISOString(),
    summary: stats,
    operations: history,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `lux-relatorio-completo-${dateStamp()}.json`);
}

export function exportStatsSummary(history: TradeHistoryItem[]) {
  const stats = computeOperationalStats(history);
  const lines = [
    'LUX TRADER FX PRO — RESUMO ESTATÍSTICO',
    `Gerado: ${new Date().toLocaleString('pt-BR')}`,
    '',
    `Operações: ${stats.totalOps}`,
    `Win Rate: ${stats.winRate.toFixed(1)}%`,
    `Wins: ${stats.wins} | Losses: ${stats.losses} | BE: ${stats.breakEven}`,
    `Lucro total: $${stats.totalProfit.toFixed(2)}`,
    `Lucro diário: $${stats.dailyProfit.toFixed(2)}`,
    `Lucro semanal: $${stats.weeklyProfit.toFixed(2)}`,
    `Lucro mensal: $${stats.monthlyProfit.toFixed(2)}`,
    `ROI: ${stats.roi.toFixed(1)}%`,
    `Pips totais: ${stats.totalPips}`,
    `Profit Factor: ${stats.profitFactor.toFixed(2)}`,
    `Payoff médio: ${stats.avgPayoff.toFixed(2)}`,
    `Expectância: $${stats.expectancy.toFixed(2)}`,
    `Maior win: $${stats.biggestWin.toFixed(2)}`,
    `Maior loss: $${stats.biggestLoss.toFixed(2)}`,
    `Sequência wins: ${stats.currentWinStreak}`,
    `Sequência losses: ${stats.currentLossStreak}`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `lux-resumo-${dateStamp()}.txt`);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
