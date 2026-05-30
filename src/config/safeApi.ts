import { isRemoteApiEnabled } from './api';

let lastApiWarnAt = 0;
let remoteDisabledLogged = false;

const WARN_THROTTLE_MS = 30_000;

/** API remota opcional — offline-first por padrão em dev. */
export const API_ENABLED = isRemoteApiEnabled();

export function warnApiOnce(message: string, err?: unknown): void {
  const now = Date.now();
  if (now - lastApiWarnAt < WARN_THROTTLE_MS) return;
  lastApiWarnAt = now;
  if (err !== undefined) {
    console.warn(message, err);
  } else {
    console.warn(message);
  }
}

export function logRemoteApiMode(): void {
  if (remoteDisabledLogged) return;
  remoteDisabledLogged = true;
  if (!API_ENABLED) {
    console.log('[Lux:API] remote disabled — motor local (Binance público) + fallback automático');
  } else {
    console.log('[Lux:API] institutional centralized mode');
  }
}

export async function safeApiCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!API_ENABLED) {
    return fallback;
  }
  try {
    return await fn();
  } catch (err) {
    warnApiOnce('[Lux:API] fallback local', err);
    return fallback;
  }
}

/** Não dispara fetch se API remota desligada. */
export async function safeApiCallOptional<T>(
  fn: () => Promise<T>
): Promise<T | null> {
  if (!API_ENABLED) return null;
  try {
    return await fn();
  } catch (err) {
    warnApiOnce('[Lux:API] request skipped', err);
    return null;
  }
}
