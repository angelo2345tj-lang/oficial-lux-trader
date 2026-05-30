import React, { useState, useEffect, useMemo } from 'react';
import {
  SignalType,
  TradeHistoryItem,
  SignalTimingMode,
  TradeResult,
  ExitReason,
  EntryTimingRating,
  MarketConditionTag,
  LossReasonTag,
} from '../types';
import {
  X,
  Save,
  BookOpen,
  BarChart3,
  Target,
  Brain,
  Wallet,
  LineChart,
} from 'lucide-react';
import {
  calcPips,
  calcRiskReward,
  timeframeLabel,
  DEFAULT_USD_BRL,
} from '../utils/historyFormat';

interface SaveOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: TradeHistoryItem) => void;
  editItem?: TradeHistoryItem | null;
  defaultAsset?: string;
  defaultType?: SignalType;
  defaultTimeframe?: string;
  defaultConfidence?: number;
  defaultScore?: number;
  defaultEntry?: number;
  defaultStop?: number;
  defaultTake?: number;
  defaultTp2?: number;
  defaultTp3?: number;
  defaultInvalidation?: number;
  defaultTimingMode?: SignalTimingMode;
  defaultConfluences?: string[];
  defaultWinProbability?: number;
  defaultMarketCondition?: string;
  userId?: string;
  userName?: string;
  usdBrlRate?: number;
}

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-white/5 bg-black/30 p-4 space-y-3">
    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
      <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{title}</h4>
    </div>
    {children}
  </div>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const inputCls =
  'w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-bold text-sm outline-none focus:border-blue-500/60 transition-colors';

const SaveOperationModal: React.FC<SaveOperationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
  defaultAsset = '',
  defaultType = SignalType.BUY,
  defaultTimeframe = '60',
  defaultConfidence,
  defaultScore,
  defaultEntry,
  defaultStop,
  defaultTake,
  defaultTp2,
  defaultTp3,
  defaultInvalidation,
  defaultTimingMode,
  defaultConfluences = [],
  defaultWinProbability,
  defaultMarketCondition,
  userId = 'local',
  userName = 'Operador',
  usdBrlRate = DEFAULT_USD_BRL,
}) => {
  const now = useMemo(() => new Date(), [isOpen]);
  const [asset, setAsset] = useState(defaultAsset);
  const [type, setType] = useState<SignalType>(defaultType);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [entry, setEntry] = useState(defaultEntry ?? 0);
  const [exitPrice, setExitPrice] = useState<number | ''>('');
  const [lotSize, setLotSize] = useState(0.1);
  const [leverage, setLeverage] = useState('1:100');
  const [result, setResult] = useState<TradeResult>('PENDING');
  const [profitUsd, setProfitUsd] = useState(0);
  const [stopLoss, setStopLoss] = useState(defaultStop ?? 0);
  const [takeProfit, setTakeProfit] = useState(defaultTake ?? 0);
  const [exitReason, setExitReason] = useState<ExitReason | ''>('');
  const [followedAi, setFollowedAi] = useState<boolean | null>(true);
  const [entryTiming, setEntryTiming] = useState<EntryTimingRating | ''>('');
  const [marketTag, setMarketTag] = useState<MarketConditionTag | ''>('');
  const [lossReason, setLossReason] = useState<LossReasonTag | ''>('');
  const [journalNotes, setJournalNotes] = useState('');
  const [score, setScore] = useState(defaultScore ?? defaultConfidence ?? 0);
  const [winProb, setWinProb] = useState(defaultWinProbability ?? 0);

  useEffect(() => {
    if (!isOpen) return;
    if (editItem) {
      setAsset(editItem.asset);
      setType(editItem.type);
      setTimeframe(editItem.timeframe ?? '60');
      setEntry(editItem.entry ?? editItem.entryValue ?? 0);
      setExitPrice(editItem.exitPrice ?? '');
      setLotSize(editItem.lotSize ?? 0.1);
      setLeverage(editItem.leverage ?? '1:100');
      setResult(editItem.result);
      setProfitUsd(editItem.profitUsd ?? editItem.profit);
      setStopLoss(editItem.stopLoss ?? editItem.stop ?? 0);
      setTakeProfit(editItem.takeProfit ?? editItem.take ?? 0);
      setExitReason(editItem.exitReason ?? '');
      setFollowedAi(editItem.followedAiSignal ?? null);
      setEntryTiming(editItem.entryTiming ?? '');
      setMarketTag(editItem.marketConditionTag ?? '');
      setLossReason(editItem.lossReason ?? '');
      setJournalNotes(editItem.journalNotes ?? editItem.notes ?? '');
      setScore(editItem.score ?? editItem.confidence ?? 0);
      setWinProb(editItem.winProbability ?? editItem.assertiveness ?? 0);
      return;
    }
    setAsset(defaultAsset);
    setType(defaultType);
    setTimeframe(defaultTimeframe);
    setEntry(defaultEntry ?? 0);
    setExitPrice('');
    setLotSize(0.1);
    setLeverage('1:100');
    setResult('PENDING');
    setProfitUsd(0);
    setStopLoss(defaultStop ?? 0);
    setTakeProfit(defaultTake ?? 0);
    setExitReason('');
    setFollowedAi(true);
    setEntryTiming('');
    setMarketTag('');
    setLossReason('');
    setJournalNotes('');
    setScore(defaultScore ?? defaultConfidence ?? 0);
    setWinProb(defaultWinProbability ?? 0);
  }, [
    isOpen,
    editItem,
    defaultAsset,
    defaultType,
    defaultTimeframe,
    defaultEntry,
    defaultStop,
    defaultTake,
    defaultScore,
    defaultConfidence,
    defaultWinProbability,
  ]);

  const dir = type === SignalType.BUY ? 'BUY' : 'SELL';
  const pips = useMemo(() => {
    const ex = typeof exitPrice === 'number' ? exitPrice : 0;
    if (!ex || !entry) return 0;
    return calcPips(entry, ex, asset, dir);
  }, [entry, exitPrice, asset, dir]);

  const riskReward = useMemo(
    () => calcRiskReward(entry, stopLoss, takeProfit),
    [entry, stopLoss, takeProfit]
  );

  const profitBrl = useMemo(() => profitUsd * usdBrlRate, [profitUsd, usdBrlRate]);

  const applyResultPreset = (r: TradeResult) => {
    setResult(r);
    if (r === 'WIN' && typeof exitPrice !== 'number') {
      setExitPrice(takeProfit || entry * 1.001);
      setProfitUsd(Math.abs((takeProfit - entry) * 10000 * lotSize * 0.1) || 25);
      setExitReason('TP1');
    } else if (r === 'LOSS') {
      setExitPrice(stopLoss || entry * 0.999);
      setProfitUsd(-Math.abs((entry - stopLoss) * 10000 * lotSize * 0.1) || -12);
      setExitReason('SL');
    } else if (r === 'BE') {
      setExitPrice(entry);
      setProfitUsd(0);
      setExitReason('BE');
    } else {
      setProfitUsd(0);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const ts = editItem?.timestamp ? new Date(editItem.timestamp) : now;
    const ex = typeof exitPrice === 'number' ? exitPrice : undefined;

    const item: TradeHistoryItem = {
      id: editItem?.id ?? `OP-${Date.now()}`,
      userId,
      userName,
      asset: asset.trim().toUpperCase(),
      type,
      result,
      profit: profitUsd,
      profitUsd,
      profitBrl,
      entryValue: entry,
      entry,
      exitPrice: ex,
      stop: stopLoss,
      stopLoss,
      take: takeProfit,
      takeProfit,
      tp2: defaultTp2 ?? editItem?.tp2,
      tp3: defaultTp3 ?? editItem?.tp3,
      invalidation: defaultInvalidation ?? editItem?.invalidation,
      timeframe,
      timestamp: ts.toISOString(),
      operationDate: ts.toLocaleDateString('pt-BR'),
      operationTime: ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      notes: journalNotes || undefined,
      journalNotes: journalNotes || undefined,
      confidence: score,
      score,
      assertiveness: winProb,
      winProbability: winProb,
      timingMode: defaultTimingMode ?? editItem?.timingMode,
      confluences: defaultConfluences.length ? defaultConfluences : editItem?.confluences,
      marketCondition: defaultMarketCondition ?? editItem?.marketCondition,
      lotSize,
      leverage,
      pips: ex ? pips : undefined,
      riskReward,
      exitReason: exitReason || undefined,
      followedAiSignal: followedAi ?? undefined,
      entryTiming: entryTiming || undefined,
      marketConditionTag: marketTag || undefined,
      lossReason: lossReason || undefined,
      usdBrlRate,
      aiExplanation: editItem?.aiExplanation,
      risks: editItem?.risks,
      operationalStrength: editItem?.operationalStrength,
      roi: editItem?.roi,
    };

    onSave(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-3 md:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto custom-scrollbar bg-[#081018] border border-cyan-500/20 rounded-[2rem] p-5 md:p-8 shadow-[0_0_60px_rgba(6,182,212,0.15)] space-y-5 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start sticky top-0 bg-[#081018]/95 backdrop-blur py-1 z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black uppercase italic text-white">
                {editItem ? 'Editar Operação' : 'Diário Operacional'}
              </h3>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">
                Lux Trader FX PRO · Registro institucional
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/5 rounded-full text-zinc-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Section icon={BarChart3} title="Dados da Operação">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ativo">
              <input value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} className={inputCls} />
            </Field>
            <Field label="Timeframe">
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className={inputCls}>
                <option value="1">M1</option>
                <option value="5">M5</option>
                <option value="15">M15</option>
                <option value="30">M30</option>
                <option value="60">H1</option>
                <option value="240">H4</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType(SignalType.BUY)}
              className={`py-3 rounded-xl font-black uppercase text-[10px] ${type === SignalType.BUY ? 'bg-green-600 text-white' : 'bg-black/40 border border-white/10 text-zinc-500'}`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setType(SignalType.SELL)}
              className={`py-3 rounded-xl font-black uppercase text-[10px] ${type === SignalType.SELL ? 'bg-red-600 text-white' : 'bg-black/40 border border-white/10 text-zinc-500'}`}
            >
              SELL
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px] font-mono text-zinc-400">
            <span>Data: {now.toLocaleDateString('pt-BR')}</span>
            <span>Hora: {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>Score IA: {score}%</span>
            <span>Win: {winProb}%</span>
          </div>
          {defaultConfluences.length > 0 && (
            <p className="text-[9px] text-zinc-500 line-clamp-2">
              Confluências: {defaultConfluences.slice(0, 4).join(' · ')}
            </p>
          )}
          {defaultMarketCondition && (
            <p className="text-[9px] text-cyan-500/80">Mercado: {defaultMarketCondition}</p>
          )}
        </Section>

        <Section icon={LineChart} title="Entrada e Saída">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entrada">
              <input type="number" step="any" value={entry} onChange={(e) => setEntry(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Saída">
              <input
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className={inputCls}
                placeholder="Preço de saída"
              />
            </Field>
            <Field label="Lote">
              <input type="number" step="0.01" value={lotSize} onChange={(e) => setLotSize(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Alavancagem">
              <input value={leverage} onChange={(e) => setLeverage(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Pips">
              <input readOnly value={pips ? `${pips > 0 ? '+' : ''}${pips}` : '—'} className={`${inputCls} opacity-80`} />
            </Field>
            <Field label="Risco x Retorno">
              <input readOnly value={riskReward} className={`${inputCls} opacity-80`} />
            </Field>
          </div>
        </Section>

        <Section icon={Wallet} title="Gestão Financeira · Resultado">
          <div className="grid grid-cols-4 gap-2">
            {(['WIN', 'LOSS', 'BE', 'PENDING'] as TradeResult[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => applyResultPreset(r)}
                className={`py-2.5 rounded-xl font-black uppercase text-[9px] ${
                  result === r
                    ? r === 'WIN'
                      ? 'bg-green-600 text-white'
                      : r === 'LOSS'
                        ? 'bg-red-600 text-white'
                        : r === 'BE'
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-600 text-white'
                    : 'bg-black/40 border border-white/10 text-zinc-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lucro / Prejuízo (USD)">
              <input type="number" step="0.01" value={profitUsd} onChange={(e) => setProfitUsd(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Valor (BRL)">
              <input readOnly value={`${profitBrl >= 0 ? '+' : ''}${profitBrl.toFixed(2)}`} className={`${inputCls} text-emerald-400/90`} />
            </Field>
          </div>
        </Section>

        <Section icon={Target} title="Stop Loss · Take Profit">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop Loss">
              <input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Take Profit">
              <input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <Field label="Motivo encerramento">
            <select
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value as ExitReason)}
              className={inputCls}
            >
              <option value="">—</option>
              <option value="TP1">TP1</option>
              <option value="TP2">TP2</option>
              <option value="TP3">TP3</option>
              <option value="SL">SL</option>
              <option value="MANUAL">Manual</option>
              <option value="PARTIAL">Parcial</option>
              <option value="BE">Break Even</option>
            </select>
          </Field>
          {(defaultTp2 || defaultTp3) && (
            <p className="text-[9px] font-mono text-zinc-500">
              TP2: {defaultTp2?.toFixed(5) ?? '—'} · TP3: {defaultTp3?.toFixed(5) ?? '—'}
            </p>
          )}
        </Section>

        <Section icon={Brain} title="Avaliação da Entrada">
          <Field label="Seguiu o sinal da IA?">
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setFollowedAi(v)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase ${
                    followedAi === v ? 'bg-blue-600 text-white' : 'bg-black/40 border border-white/10 text-zinc-500'
                  }`}
                >
                  {v ? 'Sim' : 'Não'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Entrada foi">
            <select value={entryTiming} onChange={(e) => setEntryTiming(e.target.value as EntryTimingRating)} className={inputCls}>
              <option value="">—</option>
              <option value="PERFEITA">Perfeita</option>
              <option value="ANTECIPADA">Antecipada</option>
              <option value="ATRASADA">Atrasada</option>
            </select>
          </Field>
          <Field label="Mercado estava">
            <select value={marketTag} onChange={(e) => setMarketTag(e.target.value as MarketConditionTag)} className={inputCls}>
              <option value="">—</option>
              <option value="TENDENCIA">Tendência</option>
              <option value="CONSOLIDACAO">Consolidação</option>
              <option value="ALTA_VOLATILIDADE">Alta volatilidade</option>
              <option value="NOTICIA">Notícia</option>
            </select>
          </Field>
          {result === 'LOSS' && (
            <Field label="Motivo do loss">
              <select value={lossReason} onChange={(e) => setLossReason(e.target.value as LossReasonTag)} className={inputCls}>
                <option value="">—</option>
                <option value="ENTRADA_ANTECIPADA">Entrada antecipada</option>
                <option value="ENTRADA_ATRASADA">Entrada atrasada</option>
                <option value="MERCADO_LATERAL">Mercado lateral</option>
                <option value="NOTICIA">Notícia</option>
                <option value="ERRO_OPERACIONAL">Erro operacional</option>
                <option value="STOP_CURTO">Stop curto</option>
                <option value="EXCESSO_LOTE">Excesso de lote</option>
                <option value="OUTRO">Outro</option>
              </select>
            </Field>
          )}
        </Section>

        <Section icon={BookOpen} title="Diário Operacional">
          <textarea
            value={journalNotes}
            onChange={(e) => setJournalNotes(e.target.value)}
            rows={4}
            placeholder="Ex: Mercado retraiu antes do movimento principal. TP atingido após 38 minutos."
            className={`${inputCls} resize-none font-normal text-zinc-300`}
          />
        </Section>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-2xl font-black uppercase tracking-[0.25em] text-white transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(6,182,212,0.25)] flex items-center justify-center gap-3"
        >
          <Save className="w-5 h-5" />
          {editItem ? 'ATUALIZAR REGISTRO' : 'SALVAR NO HISTÓRICO'}
        </button>
      </div>
    </div>
  );
};

export default SaveOperationModal;
