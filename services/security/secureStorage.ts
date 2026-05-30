const STORAGE_PREFIX = 'lux_secure_';

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );
  return material;
}

function getSessionSecret(): string {
  let secret = sessionStorage.getItem('lux_session_key');
  if (!secret) {
    secret = crypto.randomUUID() + crypto.randomUUID();
    sessionStorage.setItem('lux_session_key', secret);
  }
  return secret;
}

export const secureStorage = {
  async set(key: string, value: unknown): Promise<void> {
    if (!crypto.subtle) {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return;
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await deriveKey(getSessionSecret());
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
    const payload = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(cipher)),
    };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
  },

  async get<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    if (!crypto.subtle) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    try {
      const payload = JSON.parse(raw) as { iv: number[]; data: number[] };
      const iv = new Uint8Array(payload.iv);
      const data = new Uint8Array(payload.data);
      const cryptoKey = await deriveKey(getSessionSecret());
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
      return JSON.parse(new TextDecoder().decode(decrypted)) as T;
    } catch {
      return null;
    }
  },

  remove(key: string) {
    localStorage.removeItem(STORAGE_PREFIX + key);
  },
};
