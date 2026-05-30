export function formatPrice(value: number, symbol = ''): string {
  if (!Number.isFinite(value)) return '—';
  const s = symbol.toUpperCase();
  let decimals = 5;
  if (s.includes('JPY')) decimals = 3;
  else if (s.includes('BTC') || s.includes('ETH')) decimals = 2;
  else if (s.includes('XAU') || s.includes('GOLD')) decimals = 2;
  else if (s.length <= 6 && !s.includes('USD')) decimals = 4;
  return value.toFixed(decimals);
}
