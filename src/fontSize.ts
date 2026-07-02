export type FontSize = "s" | "m" | "l";

const STORAGE_KEY = "kens-editor-font-size";

const ORDER: FontSize[] = ["s", "m", "l"];

export const FONT_SIZE_PRESETS: Record<FontSize, number> = {
  s: 14,
  m: 18,
  l: 22,
};

export function storedFontSize(): FontSize {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "s" || value === "m" || value === "l") {
    return value;
  }
  return "s";
}

export function nextFontSize(current: FontSize): FontSize {
  const index = ORDER.indexOf(current);
  return ORDER[(index + 1) % ORDER.length];
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem(STORAGE_KEY, size);
}

export function initFontSize(): void {
  applyFontSize(storedFontSize());
}
