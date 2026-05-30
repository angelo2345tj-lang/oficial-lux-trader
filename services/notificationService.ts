
import { TradeSignal, SignalStrength, SignalType } from '../types';

const NOTIFY_SOUND =
  'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3';

export function isIdealSignal(signal: TradeSignal, winProbability?: number): boolean {
  const wp = winProbability ?? signal.winProbability ?? 0;
  if (signal.strength === SignalStrength.GOLDEN && wp >= 68) return true;
  if (wp >= 72 && signal.confluences && signal.confluences.length >= 3) return true;
  if (signal.confidenceLabel === 'ELITE' || signal.confidenceLabel === 'FORTE') return true;
  return false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Solicita permissão uma vez após login (não repete se negado). */
export function ensureNotificationPermission(): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  try {
    const asked = sessionStorage.getItem('lux_notif_asked');
    if (asked === '1') return;
    sessionStorage.setItem('lux_notif_asked', '1');
    void requestNotificationPermission();
  } catch {
    /* ignore */
  }
}

export function notifyConfirmedSignal(
  signal: TradeSignal,
  winProbability?: number,
  enabled = true
): void {
  sendDeviceNotification(signal, winProbability, enabled, {
    title: '✅ SINAL CONFIRMADO',
    playSound: true,
    soundEnabled: true,
  });
}

function operationalStrengthLabel(signal: TradeSignal): string {
  return (
    signal.confidenceLabel ??
    (signal.strength === SignalStrength.GOLDEN
      ? 'ELITE'
      : signal.strength === SignalStrength.ELITE
        ? 'ELITE'
        : 'FORTE')
  );
}

function pipsBetween(a: number, b: number, asset: string): number {
  const isForex = asset.length === 6 && !asset.includes('BTC');
  const mult = isForex ? 10000 : asset.includes('BTC') ? 100 : 100;
  return Math.abs(Math.round((a - b) * mult));
}

export function buildPremiumNotificationBody(
  signal: TradeSignal,
  winProbability?: number
): { title: string; body: string } {
  const dir =
    signal.type === SignalType.BUY ? 'BUY' : signal.type === SignalType.SELL ? 'SELL' : 'NEUTRO';
  const wp = Math.round(winProbability ?? signal.winProbability ?? signal.score);
  const tpPips = pipsBetween(signal.tp1, signal.entry, signal.asset);
  const slPips = pipsBetween(signal.entry, signal.sl, signal.asset);
  const confluence =
    signal.confluences?.length && signal.confluences[0]
      ? signal.confluences.slice(0, 3).join(' · ')
      : 'Confluência institucional detectada';

  const prob = Math.round(winProbability ?? signal.winProbability ?? wp);

  const body = [
    signal.asset,
    dir,
    '',
    `Score IA: ${wp}%`,
    `Probabilidade: ${prob}%`,
    '',
    `Entrada: ${signal.entry}`,
    `TP: ${signal.tp1}`,
    `SL: ${signal.sl}`,
    '',
    confluence,
  ].join('\n');

  return { title: '🚨 NOVO SINAL IA', body };
}

export function playNotificationSound(enabled = true, volume = 0.22): void {
  if (!enabled) return;
  try {
    const audio = new Audio(NOTIFY_SOUND);
    audio.volume = volume;
    void audio.play();
  } catch {
    /* ignore */
  }
}

export function sendDeviceNotification(
  signal: TradeSignal,
  winProbability?: number,
  enabled = true,
  options?: { playSound?: boolean; soundEnabled?: boolean; title?: string; body?: string }
): void {
  if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

  const premium = buildPremiumNotificationBody(signal, winProbability);
  const title = options?.title ?? premium.title;
  const body = options?.body ?? premium.body;

  try {
    const n = new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: `lux-signal-${signal.id}`,
      requireInteraction: false,
      silent: !(options?.playSound && options?.soundEnabled),
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }

  if (options?.playSound && options?.soundEnabled) {
    playNotificationSound(true);
  }
}

export function notifyPremiumSignal(
  signal: TradeSignal,
  winProbability?: number,
  enabled = true,
  soundEnabled = true
): void {
  sendDeviceNotification(signal, winProbability, enabled, {
    playSound: true,
    soundEnabled,
  });
}

export function notifyDailyGoalReached(goalLabel: string, enabled = true): void {
  if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('🏆 Meta diária atingida', {
      body: `${goalLabel}\nParabéns! Você pode continuar operando ou pausar conforme sua gestão.`,
      icon: '/icons/icon-192x192.png',
      tag: 'lux-daily-goal',
    });
  } catch {
    /* ignore */
  }
}

export function notifyDailyStopReached(stopLabel: string, enabled = true): void {
  if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('🛑 Stop diário atingido', {
      body: `${stopLabel}\nProteção de capital ativada. Revise antes de continuar.`,
      icon: '/icons/icon-192x192.png',
      tag: 'lux-daily-stop',
    });
  } catch {
    /* ignore */
  }
}

export function notifyOperationSaved(asset: string, enabled = true): void {
  if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('💾 Operação salva', {
      body: `${asset} registrada no histórico operacional.`,
      icon: '/icons/icon-192x192.png',
      tag: 'lux-op-saved',
    });
  } catch {
    /* ignore */
  }
}

export function triggerHaptic(enabled = true): void {
  if (!enabled || !navigator.vibrate) return;
  navigator.vibrate([80, 40, 80]);
}
