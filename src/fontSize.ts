export type FontSize = "s" | "m" | "l";

const STORAGE_KEY = "kens-editor-font-size";

const ORDER: FontSize[] = ["s", "m", "l"];

export const DEFAULT_FONT_SIZE: FontSize = "m";

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
  return DEFAULT_FONT_SIZE;
}

export function nextFontSize(current: FontSize): FontSize {
  const index = ORDER.indexOf(current);
  if (index < 0 || index >= ORDER.length - 1) {
    return current;
  }
  return ORDER[index + 1];
}

export function rotateFontSize(current: FontSize): FontSize {
  const index = ORDER.indexOf(current);
  return ORDER[(index + 1) % ORDER.length];
}

export function prevFontSize(current: FontSize): FontSize {
  const index = ORDER.indexOf(current);
  if (index <= 0) {
    return current;
  }
  return ORDER[index - 1];
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem(STORAGE_KEY, size);
}

export function initFontSize(): void {
  applyFontSize(storedFontSize());
}
