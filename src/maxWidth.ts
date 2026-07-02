export type MaxWidthMode = "full" | "narrow";

const STORAGE_KEY = "kens-editor-max-width";

export const MAX_WIDTH_CH = 72;

export const MAX_WIDTH_LABELS: Record<MaxWidthMode, string> = {
  full: "Full",
  narrow: "Narrow",
};

export function storedMaxWidth(): MaxWidthMode {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "full" || value === "narrow") {
    return value;
  }
  return "narrow";
}

export function toggleMaxWidth(current: MaxWidthMode): MaxWidthMode {
  return current === "full" ? "narrow" : "full";
}

export function applyMaxWidth(mode: MaxWidthMode): void {
  document.documentElement.dataset.maxWidth = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function initMaxWidth(): void {
  applyMaxWidth(storedMaxWidth());
}
