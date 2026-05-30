/** Detecção de runtime: PWA, Capacitor Android/iOS, desktop. */
export type LuxRuntime = 'web' | 'pwa' | 'android' | 'ios' | 'desktop';

let runtime: LuxRuntime = 'web';
let nativeReady = false;

export function detectRuntime(): LuxRuntime {
  if (typeof window === 'undefined') return 'web';

  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } })
    .Capacitor;

  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.() ?? 'web';
    if (p === 'android') return 'android';
    if (p === 'ios') return 'ios';
    return 'android';
  }

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (standalone) return 'pwa';

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'pwa';
  if (/iphone|ipad|ipod/.test(ua)) return 'pwa';

  if (window.matchMedia('(min-width: 1024px)').matches && !('ontouchstart' in window)) {
    return 'desktop';
  }

  return 'web';
}

export function getRuntime(): LuxRuntime {
  return runtime;
}

export function setRuntimeDetected(): void {
  runtime = detectRuntime();
}

export function isNativeApp(): boolean {
  return runtime === 'android' || runtime === 'ios';
}

export function isMobileSurface(): boolean {
  return runtime === 'android' || runtime === 'ios' || runtime === 'pwa';
}

export function markNativeReady(): void {
  nativeReady = true;
}

export function isNativeReady(): boolean {
  return nativeReady;
}
