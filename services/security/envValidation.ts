/**
 * Validação de ambiente no FRONTEND (Vite + navegador).
 * Não usa process.env — apenas import.meta.env para flags públicas opcionais.
 * Chaves secretas (Gemini, TwelveData, Finnhub, JWT, DB) pertencem ao backend Render.
 */

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

export interface EnvValidationResult {
  valid: boolean;
  warnings: string[];
  config: EnvConfig;
}

const EMPTY_CONFIG: EnvConfig = {
  geminiKey: null,
  twelveDataKey: null,
  finnhubKey: null,
  binanceApiKey: null,
  binanceSecret: null,
  bybitApiKey: null,
  bybitSecret: null,
  mt5BridgeUrl: 'http://127.0.0.1:8080',
  pocketBridgeUrl: null,
  executionEnabled: false,
};

/** Lê variável pública Vite (VITE_*) — nunca process.env no browser. */
function readViteEnv(...keys: string[]): string | null {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env) return null;
    const env = import.meta.env as Record<string, string | undefined>;
    for (const key of keys) {
      const value = env[key];
      if (value && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Configuração segura para o cliente React.
 * Não exige nem valida chaves de API privadas — análise via backend /api.
 */
export function validateEnv(): EnvConfig {
  try {
    const executionEnabled = readViteEnv('VITE_EXECUTION_ENABLED') === 'true';
    const mt5BridgeUrl =
      readViteEnv('VITE_MT5_BRIDGE_URL') || EMPTY_CONFIG.mt5BridgeUrl;

    return {
      ...EMPTY_CONFIG,
      mt5BridgeUrl,
      pocketBridgeUrl: readViteEnv('VITE_POCKET_BRIDGE_URL'),
      executionEnabled,
    };
  } catch {
    return { ...EMPTY_CONFIG };
  }
}

/** Resultado amigável — nunca lança exceção. */
export function validateEnvSafe(): EnvValidationResult {
  try {
    const config = validateEnv();
    return {
      valid: true,
      warnings: [],
      config,
    };
  } catch (error) {
    console.warn('Env validation skipped:', error);
    return {
      valid: true,
      warnings: [],
      config: { ...EMPTY_CONFIG },
    };
  }
}

/**
 * Avisos não bloqueantes no frontend.
 * Credenciais de mercado/IA devem estar no servidor (Render).
 */
export function getEnvWarnings(_cfg?: EnvConfig): string[] {
  try {
    return [];
  } catch {
    return [];
  }
}
