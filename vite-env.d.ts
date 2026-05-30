/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_TWELVE_DATA_KEY: string;
  readonly VITE_FINNHUB_KEY: string;
  readonly VITE_EXECUTION_ENABLED: string;
  readonly VITE_BINANCE_API_KEY: string;
  readonly VITE_BINANCE_API_SECRET: string;
  readonly VITE_BYBIT_API_KEY: string;
  readonly VITE_BYBIT_API_SECRET: string;
  readonly VITE_MT5_BRIDGE_URL: string;
  readonly VITE_POCKET_BRIDGE_URL: string;
  readonly VITE_API_URL?: string;
  /** Origem da API (ex.: https://lux-trader-api.onrender.com) — alternativa a VITE_API_URL */
  readonly VITE_API_ORIGIN?: string;
  /** Somente dev local — Vite proxy para backend */
  readonly VITE_API_PROXY?: string;
  /** true = chama API remota; false/off = offline-first (motor local) */
  readonly VITE_ENABLE_REMOTE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
