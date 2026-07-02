import { Menu, Submenu, CheckMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow, type Theme } from "@tauri-apps/api/window";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "kens-editor-theme";
const LIGHT_BG: [number, number, number] = [255, 255, 255];
const DARK_BG: [number, number, number] = [30, 30, 30];

let lightItem: CheckMenuItem | null = null;
let darkItem: CheckMenuItem | null = null;
let systemItem: CheckMenuItem | null = null;

function storedTheme(): ThemeMode {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
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

async function syncMenuChecks(mode: ThemeMode): Promise<void> {
  await lightItem?.setChecked(mode === "light");
  await darkItem?.setChecked(mode === "dark");
  await systemItem?.setChecked(mode === "system");
}

export async function applyTheme(mode: ThemeMode): Promise<void> {
  document.documentElement.dataset.theme = mode;

  const windowTheme: Theme | null = mode === "system" ? null : mode;
  const background =
    effectiveAppearance(mode) === "dark" ? DARK_BG : LIGHT_BG;

  const window = getCurrentWindow();
  await window.setTheme(windowTheme);
  await window.setBackgroundColor(background);
  await getCurrentWebview().setBackgroundColor(background);
}

async function selectTheme(mode: ThemeMode): Promise<void> {
  localStorage.setItem(STORAGE_KEY, mode);
  await applyTheme(mode);
  await syncMenuChecks(mode);
}

async function setupMenu(initialMode: ThemeMode): Promise<void> {
  lightItem = await CheckMenuItem.new({
    id: "theme-light",
    text: "Light",
    checked: initialMode === "light",
    action: () => {
      void selectTheme("light");
    },
  });

  darkItem = await CheckMenuItem.new({
    id: "theme-dark",
    text: "Dark",
    checked: initialMode === "dark",
    action: () => {
      void selectTheme("dark");
    },
  });

  systemItem = await CheckMenuItem.new({
    id: "theme-system",
    text: "System",
    checked: initialMode === "system",
    action: () => {
      void selectTheme("system");
    },
  });

  const appearance = await Submenu.new({
    text: "Appearance",
    items: [lightItem, darkItem, systemItem],
  });

  const menu = await Menu.default();
  await menu.append(appearance);
  await menu.setAsAppMenu();
}

function onSystemPreferenceChange(): void {
  if (storedTheme() === "system") {
    void applyTheme("system");
  }
}

export async function initTheme(): Promise<void> {
  const mode = storedTheme();
  await applyTheme(mode);
  await setupMenu(mode);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", onSystemPreferenceChange);

  void getCurrentWindow().onThemeChanged(() => {
    onSystemPreferenceChange();
  });

  window.dispatchEvent(new Event("kens-editor-ready"));
}
