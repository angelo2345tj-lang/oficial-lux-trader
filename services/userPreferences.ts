const FAV_ASSETS_KEY = 'lux_fav_assets';
const FAV_TF_KEY = 'lux_fav_timeframes';

export function loadFavoriteAssets(): string[] {
  try {
    const raw = localStorage.getItem(FAV_ASSETS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveFavoriteAssets(symbols: string[]) {
  localStorage.setItem(FAV_ASSETS_KEY, JSON.stringify(symbols));
}

export function toggleFavoriteAsset(symbol: string): string[] {
  const list = loadFavoriteAssets();
  const next = list.includes(symbol)
    ? list.filter((s) => s !== symbol)
    : [...list, symbol];
  saveFavoriteAssets(next);
  return next;
}

export function loadFavoriteTimeframes(): string[] {
  try {
    const raw = localStorage.getItem(FAV_TF_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveFavoriteTimeframes(values: string[]) {
  localStorage.setItem(FAV_TF_KEY, JSON.stringify(values));
}

export function toggleFavoriteTimeframe(value: string): string[] {
  const list = loadFavoriteTimeframes();
  const next = list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
  saveFavoriteTimeframes(next);
  return next;
}
