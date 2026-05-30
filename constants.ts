import { Asset, MarketSession, SupportedLanguage, TranslationStrings } from "./types";

export { DEFAULT_USER_SETTINGS } from "./constants/defaults";

export const ASSETS: Asset[] = [
  { symbol: "EURUSD", name: "EURO / DÓLAR", category: "Forex", exchange: "FX_IDC" },
  { symbol: "GBPUSD", name: "LIBRA / DÓLAR", category: "Forex", exchange: "FX_IDC" },
  { symbol: "USDJPY", name: "DÓLAR / IENE", category: "Forex", exchange: "FX_IDC" },
  { symbol: "AUDUSD", name: "AUD / DÓLAR", category: "Forex", exchange: "FX_IDC" },
  { symbol: "USDCAD", name: "USD / CAD", category: "Forex", exchange: "FX_IDC" },
  { symbol: "USDCHF", name: "USD / CHF", category: "Forex", exchange: "FX_IDC" },
  { symbol: "NZDUSD", name: "NZD / USD", category: "Forex", exchange: "FX_IDC" },
  { symbol: "EURJPY", name: "EURO / IENE", category: "Forex", exchange: "FX_IDC" },
  { symbol: "GBPJPY", name: "LIBRA / IENE", category: "Forex", exchange: "FX_IDC" },
  { symbol: "EURGBP", name: "EURO / LIBRA", category: "Forex", exchange: "FX_IDC" },
  { symbol: "XAUUSD", name: "OURO", category: "Commodities", exchange: "OANDA" },
  { symbol: "XAGUSD", name: "PRATA", category: "Commodities", exchange: "OANDA" },
  { symbol: "USOIL", name: "WTI", category: "Commodities", exchange: "TVC" },
  { symbol: "UKOIL", name: "BRENT", category: "Commodities", exchange: "TVC" },
  { symbol: "BTCUSD", name: "BITCOIN", category: "Crypto", exchange: "BINANCE" },
  { symbol: "ETHUSD", name: "ETHEREUM", category: "Crypto", exchange: "BINANCE" },
  { symbol: "SOLUSD", name: "SOLANA", category: "Crypto", exchange: "BINANCE" },
  { symbol: "XRPUSD", name: "XRP", category: "Crypto", exchange: "BINANCE" },
  { symbol: "BNBUSD", name: "BNB", category: "Crypto", exchange: "BINANCE" },
  { symbol: "DOGEUSD", name: "DOGE", category: "Crypto", exchange: "BINANCE" },
  { symbol: "ADAUSD", name: "CARDANO", category: "Crypto", exchange: "BINANCE" },
  { symbol: "US30", name: "DOW JONES", category: "Indices", exchange: "CURRENCYCOM" },
  { symbol: "NAS100", name: "NASDAQ", category: "Indices", exchange: "CURRENCYCOM" },
  { symbol: "SPX500", name: "S&P 500", category: "Indices", exchange: "CURRENCYCOM" },
  { symbol: "GER40", name: "DAX", category: "Indices", exchange: "CURRENCYCOM" },
  { symbol: "AAPL", name: "APPLE", category: "Stocks", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "TESLA", category: "Stocks", exchange: "NASDAQ" },
  { symbol: "META", name: "META", category: "Stocks", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA", category: "Stocks", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "GOOGLE", category: "Stocks", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "AMAZON", category: "Stocks", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "MICROSOFT", category: "Stocks", exchange: "NASDAQ" },
];

/** Fuso exibido no TradingView (rótulo UTC → IANA). */
export const CHART_TIMEZONES = [
  { label: 'UTC Local (Brasília)', value: 'America/Sao_Paulo', utc: 'UTC-3' },
  { label: 'UTC+0', value: 'Etc/UTC', utc: 'UTC+0' },
  { label: 'UTC+1', value: 'Europe/Paris', utc: 'UTC+1' },
  { label: 'UTC+2', value: 'Europe/Athens', utc: 'UTC+2' },
  { label: 'UTC+3', value: 'Europe/Moscow', utc: 'UTC+3' },
  { label: 'UTC+4', value: 'Asia/Dubai', utc: 'UTC+4' },
  { label: 'UTC+5', value: 'Asia/Karachi', utc: 'UTC+5' },
  { label: 'UTC+8', value: 'Asia/Shanghai', utc: 'UTC+8' },
  { label: 'UTC+9', value: 'Asia/Tokyo', utc: 'UTC+9' },
  { label: 'UTC+10', value: 'Australia/Sydney', utc: 'UTC+10' },
] as const;

export const TIMEFRAMES = [
  { label: "1 Segundo", value: "1S" },
  { label: "5 Segundos", value: "5S" },
  { label: "15 Segundos", value: "15S" },
  { label: "30 Segundos", value: "30S" },
  { label: "1 Min", value: "1" },
  { label: "2 Min", value: "2" },
  { label: "3 Min", value: "3" },
  { label: "5 Min", value: "5" },
  { label: "10 Min", value: "10" },
  { label: "15 Min", value: "15" },
  { label: "30 Min", value: "30" },
  { label: "45 Min", value: "45" },
  { label: "1 Hora", value: "60" },
  { label: "2 Horas", value: "120" },
  { label: "4 Horas", value: "240" },
  { label: "6 Horas", value: "360" },
  { label: "8 Horas", value: "480" },
  { label: "12 Horas", value: "720" },
  { label: "1 Dia", value: "D" },
  { label: "1 Semana", value: "W" },
  { label: "1 Mês", value: "M" },
];

export const CURRENCIES = [
  { code: "USD", name: "DÓLAR" },
  { code: "BRL", name: "REAL" },
  { code: "EUR", name: "EURO" },
  { code: "GBP", name: "LIBRA" },
  { code: "JPY", name: "IENE" },
];

export const LANGUAGES: {
  code: SupportedLanguage;
  name: string;
  icon: string;
}[] = [
  { code: "pt_BR", name: "PORTUGUÊS", icon: "🇧🇷" },
  { code: "en_US", name: "ENGLISH", icon: "🇺🇸" },
];

export interface ExtendedMarketSession extends MarketSession {
  timezone: string;
}

export const MARKET_SESSIONS: ExtendedMarketSession[] = [
  {
    id: "saopaulo",
    name: "São Paulo",
    city: "São Paulo",
    openUTC: 12,
    closeUTC: 20,
    icon: "🇧🇷",
    timezone: "America/Sao_Paulo",
  },
  {
    id: "london",
    name: "London",
    city: "Londres",
    openUTC: 8,
    closeUTC: 17,
    icon: "🇬🇧",
    timezone: "Europe/London",
  },
  {
    id: "newyork",
    name: "New York",
    city: "Nova York",
    openUTC: 13,
    closeUTC: 21,
    icon: "🇺🇸",
    timezone: "America/New_York",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    city: "Tóquio",
    openUTC: 0,
    closeUTC: 9,
    icon: "🇯🇵",
    timezone: "Asia/Tokyo",
  },
];

export const TRANSLATIONS: Record<SupportedLanguage, TranslationStrings> = {
  pt_BR: {
    terminal: "Terminal",
    history: "Histórico",
    manual: "Manual",
    config: "Configurações",
    admin: "Admin",
    setupTitle: "Ajustar Analisador",
    setupSubtitle: "Configure ativo, timeframe e parâmetros",
    assetLabel: "Ativo",
    tfLabel: "Timeframe",
    analyzeBtn: "ANALISAR MERCADO",
    balance: "Banca",
    language: "Idioma",
    interfaceVisual: "Interface Visual",
    deepSpace: "Deep Space",
    solarLight: "Solar Light",
    soundLabel: "Sons",
    soundDesc: "Efeitos sonoros do terminal",
    notifLabel: "Notificações",
    notifDesc: "Alertas de sinais ideais",
    currency: "Moeda",
    safeLiftTitle: "Safe Lift",
    safeLiftSubtitle: "Meta diária e stop loss automático",
    dailyGoal: "Meta Diária",
    dailyStop: "Stop Diário",
    safeLockDesc: "Limite atingido. Pausa recomendada para proteger o capital.",
    typeFixed: "Fixo",
    typePercent: "%",
    saveProtocol: "Salvar Protocolo",
  },
  en_US: {
    terminal: "Terminal",
    history: "History",
    manual: "Manual",
    config: "Settings",
    admin: "Admin",
    setupTitle: "Adjust Analyzer",
    setupSubtitle: "Configure asset, timeframe and parameters",
    assetLabel: "Asset",
    tfLabel: "Timeframe",
    analyzeBtn: "ANALYZE MARKET",
    balance: "Balance",
    language: "Language",
    interfaceVisual: "Visual Interface",
    deepSpace: "Deep Space",
    solarLight: "Solar Light",
    soundLabel: "Sounds",
    soundDesc: "Terminal sound effects",
    notifLabel: "Notifications",
    notifDesc: "Ideal signal alerts",
    currency: "Currency",
    safeLiftTitle: "Safe Lift",
    safeLiftSubtitle: "Daily goal and automatic stop loss",
    dailyGoal: "Daily Goal",
    dailyStop: "Daily Stop",
    safeLockDesc: "Limit reached. Pause recommended to protect capital.",
    typeFixed: "Fixed",
    typePercent: "%",
    saveProtocol: "Save Protocol",
  },
};
