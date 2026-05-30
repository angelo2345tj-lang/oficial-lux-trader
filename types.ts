export type SupportedLanguage = 'pt_BR' | 'en_US';

export type SignalTimingMode = 'CONFIRMED' | 'INSTANT';

export type UserRole = 'admin' | 'user';
export type UserPlan = 'Pro' | 'Enterprise';

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  NEUTRAL = 'NEUTRAL',
}

export enum SignalStrength {
  GOLDEN = 'GOLDEN',
  NORMAL = 'NORMAL',
  ELITE = 'ELITE',
}

export interface Asset {
  symbol: string;
  name: string;
  category: string;
  exchange: string;
}

export interface MTFStatus {
  m5: string;
  m15: string;
  h1: string;
  h4: string;
}

export interface IndicatorCalculations {
  rsi?: string;
  macd?: string;
  ema?: string;
  volume?: string;
  liquidity?: string;
  structure?: string;
  vwap?: string;
  bollinger?: string;
  adx?: string;
  momentum?: string;
  macroTrend?: string;
  candleConfirm?: string;
}

export interface SignalScoreBreakdown {
  positives: string[];
  negatives: string[];
}

export type AnalysisBlockStatus = 'bullish' | 'bearish' | 'neutral' | 'warning';

export interface InstitutionalAnalysisBlock {
  id: string;
  label: string;
  value: string;
  interpretation: string;
  status: AnalysisBlockStatus;
}

export interface InstitutionalAnalysis {
  blocks: InstitutionalAnalysisBlock[];
  summary: string;
  decisionReason: string;
  confluences: string[];
  risks: string[];
}

export interface TradeSignal {
  id: string;

  asset: string;

  type: SignalType;

  strength: SignalStrength;

  score: number;

  /** Confiança orgânica calculada — fonte de verdade para UI. */
  confidence?: number;

  entry: number;

  tp1: number;
  tp2: number;
  tp3: number;

  sl: number;

  slPips: number;

  expectedProfit: number;

  timestamp: Date;

  trend: string;

  riskReward: string;

  recommendedLot: number;

  recommendedLeverage: string;

  realRisk: number;

  mainReason: string;

  confluences: string[];

  risks: string[];

  verdict: string;

  fullRationale: string;

  liquidity: number;

  volatility: number;

  sentiment: number;

  smcStatus: string;

  mtf: MTFStatus;

  invalidation?: number;

  estimatedMinutes?: number;

  timingMode?: SignalTimingMode;

  indicatorCalculations?: IndicatorCalculations;

  scoreBreakdown?: SignalScoreBreakdown;

  aiExplanation?: string;

  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';

  marketCondition?: string;

  spread?: number;

  session?: string;

  volumeDelta?: number;

  orderFlow?: string;

  institutionalBias?: string;

  executionType?: 'SCALP' | 'INTRADAY' | 'SWING';

  confirmationStatus?: string;

  confidenceLabel?: 'FRACA' | 'MODERADA' | 'FORTE' | 'ELITE' | 'EXTREMAMENTE FORTE';

  /** Classificação IA institucional local (display premium). */
  aiStrengthTier?: 'EXTREMAMENTE FORTE' | 'FORTE' | 'MODERADA' | 'FRACA';
  localAiRegime?: string;
  mtfConfirmationPct?: number;
  bosActive?: boolean;
  chochActive?: boolean;
  fakeBreakoutRisk?: boolean;

  signalQuality?: number;

  livePrice?: number;

  institutionalAnalysis?: InstitutionalAnalysis;

  winProbability?: number;

  analysisStatus?: 'OK' | 'NO_DATA' | 'BLOCKED';
}

export type TradeResult = 'WIN' | 'LOSS' | 'PENDING' | 'BE';

export type ExitReason = 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL' | 'PARTIAL' | 'BE';

export type EntryTimingRating = 'PERFEITA' | 'ANTECIPADA' | 'ATRASADA';

export type MarketConditionTag =
  | 'TENDENCIA'
  | 'CONSOLIDACAO'
  | 'ALTA_VOLATILIDADE'
  | 'NOTICIA';

export type LossReasonTag =
  | 'ENTRADA_ANTECIPADA'
  | 'ENTRADA_ATRASADA'
  | 'MERCADO_LATERAL'
  | 'NOTICIA'
  | 'ERRO_OPERACIONAL'
  | 'STOP_CURTO'
  | 'EXCESSO_LOTE'
  | 'OUTRO';

export interface TradeHistoryItem {
  id: string;

  userId?: string;

  userName?: string;

  asset: string;

  type: SignalType;

  result: TradeResult;

  profit: number;

  entryValue?: number;

  timeframe?: string;

  timestamp: string | Date;

  notes?: string;

  confidence?: number;

  entry?: number;

  stop?: number;

  take?: number;

  /** Alias explícito para take profit */
  takeProfit?: number;

  /** Alias explícito para stop loss */
  stopLoss?: number;

  invalidation?: number;

  timingMode?: SignalTimingMode;

  screenshot?: string;

  confluences?: string[];

  risks?: string[];

  aiExplanation?: string;

  score?: number;

  session?: string;

  tp2?: number;
  tp3?: number;
  indicatorSnapshot?: IndicatorCalculations;
  utcLabel?: string;

  roi?: number;

  operationalStrength?: string;

  operationDurationMinutes?: number;

  assertiveness?: number;

  /** Diário operacional premium */
  exitPrice?: number;
  lotSize?: number;
  leverage?: string;
  pips?: number;
  riskReward?: string;
  profitUsd?: number;
  profitBrl?: number;
  exitReason?: ExitReason;
  followedAiSignal?: boolean;
  entryTiming?: EntryTimingRating;
  marketConditionTag?: MarketConditionTag;
  lossReason?: LossReasonTag;
  winProbability?: number;
  marketCondition?: string;
  operationDate?: string;
  operationTime?: string;
  journalNotes?: string;
  usdBrlRate?: number;
}

export interface UserSettings {
  notificationsEnabled: boolean;

  soundEnabled: boolean;

  hapticFeedback: boolean;

  riskPercent: number;

  fixedLotSize: number;

  dailyGoalValue: number;

  dailyGoalType: 'fixed' | 'percent';

  dailyStopLoss: number;

  dailyStopLossType: 'fixed' | 'percent';

  language: SupportedLanguage;

  timezone: string;

  userBanca: number;

  autoAnalyzeOnAssetChange: boolean;

  showEconomicNews: boolean;

  marketSessionAlerts: boolean;

  defaultLotMultiplier: number;

  autoTradeEnabled: boolean;

  displayCurrency: string;

  signalTimingMode?: SignalTimingMode;

  favoriteAssets?: string[];

  favoriteTimeframes?: string[];

  mobileLayout?: boolean;

  premiumMode?: boolean;

  institutionalMode?: boolean;

  utcOffset?: string;

  compactSignals?: boolean;

  /** Busca automática de sinais pela IA */
  autoAIScanEnabled?: boolean;

  /** 0 = conservador · 100 = agressivo */
  aiSensitivity?: number;

  /** Modo operacional conservador ou agressivo */
  tradingStyle?: 'conservative' | 'aggressive';

  /** Animações premium na interface */
  animationsEnabled?: boolean;

  /** Cache de dados de mercado */
  cacheEnabled?: boolean;

  /** Intervalo da IA automática (ms) */
  autoAIScanIntervalMs?: number;

  /** Continuar operando após meta diária (sem pausa automática) */
  continueAfterDailyGoal?: boolean;

  /** Metas semanais e mensais (valor fixo ou % conforme tipo diário) */
  weeklyGoalValue?: number;
  monthlyGoalValue?: number;

  /** Horário operacional (UTC) — opcional */
  tradingHourStart?: number;
  tradingHourEnd?: number;
}

export interface User {
  id: string;

  name: string;

  accessId: string;

  role: UserRole;

  plan: UserPlan | string;

  status: 'active' | 'inactive';

  createdAt: string;

  profilePic?: string;

  phone?: string;

  settings?: UserSettings;
}

export interface MarketSession {
  id: string;

  name: string;

  city: string;

  icon: string;

  timezone: string;

  openUTC: number;

  closeUTC: number;
}

export interface TranslationStrings {
  terminal: string;
  history: string;
  manual: string;
  config: string;
  admin: string;

  setupTitle: string;
  setupSubtitle: string;

  assetLabel: string;
  tfLabel: string;

  analyzeBtn: string;

  balance: string;

  language: string;

  interfaceVisual: string;

  deepSpace: string;
  solarLight: string;

  soundLabel: string;
  soundDesc: string;

  notifLabel: string;
  notifDesc: string;

  currency: string;

  safeLiftTitle: string;
  safeLiftSubtitle: string;

  dailyGoal: string;
  dailyStop: string;

  safeLockDesc: string;

  typeFixed: string;
  typePercent: string;

  saveProtocol: string;

  signalDetails?: string;

  confluences?: string;

  risks?: string;

  aiAnalysis?: string;

  marketStructure?: string;

  liquidity?: string;

  volume?: string;

  institutionalBias?: string;

  shareOperation?: string;

  favoriteAssets?: string;

  favoriteTimeframes?: string;

  instantSignal?: string;

  confirmedSignal?: string;
}