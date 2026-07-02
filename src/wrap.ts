export type WrapMode = "wrap" | "nowrap";

const STORAGE_KEY = "kens-editor-wrap";

export const DEFAULT_WRAP: WrapMode = "wrap";

export const WRAP_LABELS: Record<WrapMode, string> = {
  wrap: "Wrap",
  nowrap: "No wrap",
};

export function storedWrap(): WrapMode {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "wrap" || value === "nowrap") {
    return value;
  }
  return DEFAULT_WRAP;
}

export function toggleWrap(current: WrapMode): WrapMode {
  return current === "wrap" ? "nowrap" : "wrap";
}

export function applyWrap(mode: WrapMode): void {
  document.documentElement.dataset.wrap = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function initWrap(): void {
  applyWrap(storedWrap());
}
