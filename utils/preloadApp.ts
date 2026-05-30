import { API_ENABLED, checkApiHealth } from '../services/api/signalsApi';

export interface PreloadProgress {
  step: string;
  pct: number;
}

export async function preloadApp(
  symbol: string,
  timeframe: string,
  onProgress?: (p: PreloadProgress) => void
): Promise<void> {
  const steps: { label: string; run: () => Promise<void> }[] = [
    {
      label: 'Market data',
      run: async () => {
        const { fetchCandles } = await import('../services/marketData');
        await fetchCandles(symbol, timeframe, 40).catch(() => undefined);
      },
    },
    {
      label: 'WebSocket',
      run: async () => {
        await new Promise((r) => setTimeout(r, 120));
      },
    },
    {
      label: 'IA engines',
      run: async () => {
        await import('../services/ai/AIEngine');
      },
    },
    {
      label: 'Chart',
      run: async () => {
        await new Promise<void>((resolve) => {
          if ((window as unknown as { TradingView?: unknown }).TradingView) {
            resolve();
            return;
          }
          const t = setInterval(() => {
            if ((window as unknown as { TradingView?: unknown }).TradingView) {
              clearInterval(t);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(t);
            resolve();
          }, 600);
        });
      },
    },
    ...(API_ENABLED
      ? [
          {
            label: 'API',
            run: async () => {
              await checkApiHealth().catch(() => false);
            },
          },
        ]
      : []),
  ];

  for (let i = 0; i < steps.length; i++) {
    onProgress?.({
      step: steps[i].label,
      pct: Math.round(((i + 1) / steps.length) * 100),
    });
    await steps[i].run();
  }
}
