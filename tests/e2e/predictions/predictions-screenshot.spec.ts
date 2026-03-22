import { test, expect } from "@playwright/test";
import { forceClickText, forceClickByTestId } from "../helpers/tamagui";

const EMAIL = "test@test.com";
const PASSWORD = "TestPass123!";
const SS = "screenshots";

test.use({
  viewport: { width: 390, height: 844 },
});

test.setTimeout(90_000); // AI generation takes time

/**
 * Scroll an element into view by its text content.
 */
async function scrollToText(page: any, text: RegExp) {
  const el = page.getByText(text).first();
  if (await el.isVisible().catch(() => false)) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
}

test("predictions feature — full UI screenshot flow", async ({ page }) => {
  // 1. Login
  await page.goto("/");
  await page.waitForTimeout(3000);

  const loginInput = page.locator('[data-testid="email-input"]');
  if (await loginInput.isVisible().catch(() => false)) {
    await loginInput.fill(EMAIL);
    await page.locator('[data-testid="password-input"]').fill(PASSWORD);
    await forceClickByTestId(page, "submit-button");
    await page.waitForTimeout(5000);
  }

  // 2. Home screen
  await page.screenshot({ path: `${SS}/pred-01-home.png` });
  await forceClickText(page, /view match/i);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SS}/pred-02-match-center.png` });

  // 3. Navigate to duel contest
  const duelLink = page.locator('a[href*="/contest/"]').first();
  if (await duelLink.isVisible().catch(() => false)) {
    await duelLink.click();
  } else {
    await forceClickText(page, /h2h duel/i);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SS}/pred-03-contest-top.png` });

  // 4. Scroll through contest sections
  await scrollToText(page, /captain\/vc impact/i);
  await page.screenshot({ path: `${SS}/pred-04-captain-impact.png` });

  await scrollToText(page, /prize distribution/i);
  await page.screenshot({ path: `${SS}/pred-05-prize-dist.png` });

  await scrollToText(page, /head to head/i);
  await page.screenshot({ path: `${SS}/pred-06-head-to-head.png` });

  // 5. Scroll to predictions section
  await scrollToText(page, /predictions/i);
  await page.screenshot({ path: `${SS}/pred-07-predictions-section.png` });

  // 6. Click create prediction using testID
  const createBtn = page.locator('[data-testid="create-prediction-btn"]');
  const createVisible = await createBtn.isVisible().catch(() => false);
  console.log("=== Create prediction btn visible:", createVisible);

  if (createVisible) {
    await createBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await forceClickByTestId(page, "create-prediction-btn");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/pred-08-create-form.png` });

    // 7. Check for AI generate button
    const aiBtn = page.locator('[data-testid="ai-generate-btn"]');
    const aiBtnVisible = await aiBtn.isVisible().catch(() => false);
    console.log("=== AI generate btn visible:", aiBtnVisible);

    if (aiBtnVisible) {
      await aiBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SS}/pred-09-ai-btn.png` });

      // Click AI generate
      await forceClickByTestId(page, "ai-generate-btn");
      await page.waitForTimeout(10000); // AI takes time
      await page.screenshot({ path: `${SS}/pred-10-ai-suggestions.png` });

      // Check for generated suggestion cards
      const firstSuggestion = page.locator('[data-testid="suggestion-card-0"]');
      if (await firstSuggestion.isVisible().catch(() => false)) {
        await firstSuggestion.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SS}/pred-11-suggestion-cards.png` });

        // Click first suggestion to populate form
        await forceClickByTestId(page, "suggestion-card-0");
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SS}/pred-12-suggestion-selected.png` });
      }
    } else {
      // Try looking for the form text to confirm it opened
      const formText = page.getByText(/ask your league/i).first();
      const formOpen = await formText.isVisible().catch(() => false);
      console.log("=== Form opened (ask your league):", formOpen);
      if (formOpen) {
        await formText.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SS}/pred-08-form-opened.png` });
      }
    }
  }

  // 8. Scroll to existing prediction card
  const existingPred = page.getByText(/will west indies/i).first();
  if (await existingPred.isVisible().catch(() => false)) {
    await existingPred.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SS}/pred-13-existing-prediction.png` });
  }

  // Final
  await page.screenshot({ path: `${SS}/pred-14-final.png` });
});
