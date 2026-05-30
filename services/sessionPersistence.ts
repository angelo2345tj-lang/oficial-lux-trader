const KEYS = {
  splashEver: 'lux_splash_seen_v2',
  splashSession: 'lux_splash_done_session',
  onboarding: 'lux_onboarding_complete',
  lastView: 'lux_last_view',
  settings: 'lux_settings',
  activeUser: 'lux_active_user',
} as const;

/** Splash apenas na primeira abertura do app (persistido). */
export function shouldShowSplash(): boolean {
  try {
    if (localStorage.getItem(KEYS.splashEver) === '1') return false;
    if (sessionStorage.getItem(KEYS.splashSession) === '1') return false;
    return true;
  } catch {
    return false;
  }
}

export function markSplashComplete(): void {
  try {
    localStorage.setItem(KEYS.splashEver, '1');
    sessionStorage.setItem(KEYS.splashSession, '1');
  } catch {
    /* ignore */
  }
}

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(KEYS.onboarding) === '1';
  } catch {
    return true;
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(KEYS.onboarding, '1');
  } catch {
    /* ignore */
  }
}

export function persistLastView(view: string): void {
  try {
    localStorage.setItem(KEYS.lastView, view);
  } catch {
    /* ignore */
  }
}
