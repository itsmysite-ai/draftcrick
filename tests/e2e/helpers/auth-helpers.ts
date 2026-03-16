import type { Page } from "@playwright/test";
import { forceClickByTestId } from "./tamagui";

const EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-draftplay";

/**
 * Delete all accounts from the Firebase Auth Emulator.
 */
export async function clearEmulatorAccounts() {
  await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: "DELETE" },
  );
}

/**
 * Create a test account directly via the Firebase Auth Emulator REST API.
 */
export async function createTestAccount(email: string, password: string) {
  const res = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to create test account: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Fill the email and password inputs on an auth form using testIDs.
 */
export async function fillAuthForm(page: Page, email: string, password: string) {
  // Expo web renders testID as data-testid
  const emailInput = page.locator('[data-testid="email-input"]');
  const passwordInput = page.locator('[data-testid="password-input"]');

  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
}

/**
 * Submit the auth form via the submit button testID.
 */
export async function submitAuthForm(page: Page) {
  await forceClickByTestId(page, "submit-button");
}
