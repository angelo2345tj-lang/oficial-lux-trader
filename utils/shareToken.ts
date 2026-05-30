import { shareSignalImage } from './shareSignal';

export async function shareTokenImage(
  exportElement: HTMLElement,
  userName: string,
  token: string
): Promise<'shared' | 'downloaded'> {
  const filename = `LuxTrader-Token-${token.slice(0, 12)}-${Date.now()}.png`;
  const title = `Lux Trader FX — ${userName}`;
  await new Promise((r) => setTimeout(r, 80));
  return shareSignalImage(exportElement, filename, title);
}

export function buildTokenShareText(userName: string, token: string): string {
  return `🚀 Lux Trader FX — Terminal Institucional

Olá! ${userName} compartilhou sua licença premium.

Token: ${token}

Bem-vindo ao ecossistema Lux Trader FX.
Instale como PWA e ative as notificações para sinais em tempo real.`;
}
