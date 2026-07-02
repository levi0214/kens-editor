import { mostRecentVaultDocument } from "./vault";

const STORAGE_KEY = "kens-editor-onboarding-complete";

export type OnboardingStatus = "pending" | "welcome" | "complete";

export function initialOnboardingStatus(): OnboardingStatus {
  return storedOnboardingComplete() ? "complete" : "pending";
}

export function storedOnboardingComplete(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function completeOnboarding(): void {
  localStorage.setItem(STORAGE_KEY, "1");
}

export async function resolveOnboardingStatus(): Promise<OnboardingStatus> {
  if (storedOnboardingComplete()) {
    return "complete";
  }

  const recent = await mostRecentVaultDocument();
  if (recent !== null) {
    completeOnboarding();
    return "complete";
  }

  return "welcome";
}
