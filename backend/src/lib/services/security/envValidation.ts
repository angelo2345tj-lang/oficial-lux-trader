export interface EnvConfig {
  geminiKey: string | null;
  twelveDataKey: string | null;
  finnhubKey: string | null;
  binanceApiKey: string | null;
  binanceSecret: string | null;
  bybitApiKey: string | null;
  bybitSecret: string | null;
  mt5BridgeUrl: string | null;
  pocketBridgeUrl: string | null;
  executionEnabled: boolean;
}

function readEnv(...keys: string[]): string | null {

  for (const key of keys) {

    const value = process.env[key];

    if (value && value.trim() !== '') {
      return value.trim();
    }

  }

  return null;
}

export function validateEnv(): EnvConfig {

  const geminiKey =
    readEnv(
      'GEMINI_API_KEY',
      'VITE_GEMINI_API_KEY',
      'API_KEY'
    );

  const twelveDataKey =
    readEnv(
      'TWELVE_DATA_KEY',
      'VITE_TWELVE_DATA_KEY'
    );

  const finnhubKey =
    readEnv(
      'FINNHUB_KEY',
      'VITE_FINNHUB_KEY'
    );

  const binanceApiKey =
    readEnv(
      'BINANCE_API_KEY',
      'VITE_BINANCE_API_KEY'
    );

  const binanceSecret =
    readEnv(
      'BINANCE_API_SECRET',
      'VITE_BINANCE_API_SECRET'
    );

  const bybitApiKey =
    readEnv(
      'BYBIT_API_KEY',
      'VITE_BYBIT_API_KEY'
    );

  const bybitSecret =
    readEnv(
      'BYBIT_API_SECRET',
      'VITE_BYBIT_API_SECRET'
    );

  const mt5BridgeUrl =
    readEnv(
      'MT5_BRIDGE_URL',
      'VITE_MT5_BRIDGE_URL'
    ) || 'http://127.0.0.1:8080';

  const pocketBridgeUrl =
    readEnv(
      'POCKET_BRIDGE_URL',
      'VITE_POCKET_BRIDGE_URL'
    );

  const execFlag =
    readEnv(
      'EXECUTION_ENABLED',
      'VITE_EXECUTION_ENABLED'
    );

  const executionEnabled =
    execFlag === 'true';

  return {
    geminiKey,
    twelveDataKey,
    finnhubKey,
    binanceApiKey,
    binanceSecret,
    bybitApiKey,
    bybitSecret,
    mt5BridgeUrl,
    pocketBridgeUrl,
    executionEnabled,
  };
}

export function getEnvWarnings(
  cfg: EnvConfig
): string[] {

  const warnings: string[] = [];

  if (
    !cfg.twelveDataKey &&
    !cfg.finnhubKey
  ) {

    warnings.push(
      'Forex: configure TWELVE_DATA_KEY ou FINNHUB_KEY no servidor'
    );

  }

  if (
    cfg.executionEnabled &&
    !cfg.binanceApiKey &&
    !cfg.bybitApiKey &&
    !cfg.mt5BridgeUrl
  ) {

    warnings.push(
      'Execução: configure credenciais de broker no servidor'
    );

  }

  return warnings;
}