import { TradeSignal } from '../types';
import { formatPrice } from './formatPrice';
import { shareSignalImage } from './shareSignal';

export function buildShareText(signal: TradeSignal, utcLabel?: string): string {
  const sym = signal.asset;
  const time = new Date(signal.timestamp).toLocaleString('pt-BR');
  const conf = signal.confluences?.slice(0, 6).join(', ') || '—';

  return `Operação gerada por Lux Trader IA

🚀 Lux Trader FX
Ativo: ${signal.asset}
Direção: ${signal.type}
Score: ${signal.score}%
Confiança: ${signal.confidenceLabel ?? '—'}

Entrada: ${formatPrice(signal.entry, sym)}
SL: ${formatPrice(signal.sl, sym)}
TP1: ${formatPrice(signal.tp1, sym)}
TP2: ${formatPrice(signal.tp2, sym)}
TP3: ${formatPrice(signal.tp3, sym)}

Horário: ${time}
UTC: ${utcLabel ?? '—'}

Confluências: ${conf}

Gerado por Lux Trader FX`;
}

/** Gera PNG premium e compartilha (arquivo) ou baixa; fallback para texto. */
export async function shareOperation(
  signal: TradeSignal,
  exportElement: HTMLElement | null,
  utcLabel?: string
): Promise<'shared' | 'downloaded' | 'clipboard'> {
  const text = buildShareText(signal, utcLabel);
  const filename = `LuxTrader-${signal.asset}-${signal.type}-${Date.now()}.png`;
  const title = `Lux Trader FX — ${signal.asset} ${signal.type}`;

  if (exportElement) {
    try {
      await new Promise((r) => setTimeout(r, 80));
      const result = await shareSignalImage(exportElement, filename, title);
      return result;
    } catch (err) {
      const cancelled =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('cancel'));
      if (cancelled) throw err;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Lux Trader FX', text });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
    }
  }

  await navigator.clipboard.writeText(text);
  return 'clipboard';
}
