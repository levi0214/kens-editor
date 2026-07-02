import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow, type Theme } from "@tauri-apps/api/window";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "kens-editor-theme";
const LIGHT_BG: [number, number, number] = [250, 249, 246];
const DARK_BG: [number, number, number] = [30, 30, 30];

const ORDER: ThemeMode[] = ["light", "dark", "system"];

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function storedTheme(): ThemeMode {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function nextTheme(current: ThemeMode): ThemeMode {
  const index = ORDER.indexOf(current);
  return ORDER[(index + 1) % ORDER.length];
}

function effectiveAppearance(mode: ThemeMode): "light" | "dark" {
  if (mode === "light") {
    return "light";
  }
  if (mode === "dark") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export async function applyTheme(mode: ThemeMode): Promise<void> {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(STORAGE_KEY, mode);

  const windowTheme: Theme | null = mode === "system" ? null : mode;
  const background =
    effectiveAppearance(mode) === "dark" ? DARK_BG : LIGHT_BG;

  const window = getCurrentWindow();
  await window.setTheme(windowTheme);
  await window.setBackgroundColor(background);
  await getCurrentWebview().setBackgroundColor(background);
}

function onSystemPreferenceChange(): void {
  if (storedTheme() === "system") {
    void applyTheme("system");
  }
}

export async function initTheme(): Promise<void> {
  await applyTheme(storedTheme());

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", onSystemPreferenceChange);

  void getCurrentWindow().onThemeChanged(() => {
    onSystemPreferenceChange();
  });

  window.dispatchEvent(new Event("kens-editor-ready"));
}
