import type { Page } from "@playwright/test";

/**
 * Force-click a Tamagui SegmentTab / pressable element by finding its text,
 * walking up to the cursor:pointer ancestor, and dispatching pointer events.
 */
export async function forceClickTab(page: Page, tabLabel: string) {
  await page.evaluate((label: string) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text === label) {
        let target = walker.currentNode.parentElement;
        while (target && target !== document.body) {
          const cs = window.getComputedStyle(target);
          if (cs.cursor === "pointer") break;
          target = target.parentElement;
        }
        if (!target) target = walker.currentNode.parentElement;
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
        target.dispatchEvent(new PointerEvent("pointerdown", opts));
        target.dispatchEvent(new PointerEvent("pointerup", opts));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        return;
      }
    }
  }, tabLabel);
  await page.waitForTimeout(3000);
}

/**
 * Force-click the first element matching a text pattern.
 * Used for filter pills and buttons.
 */
export async function forceClickText(page: Page, pattern: RegExp) {
  await page.evaluate((pat: string) => {
    const regex = new RegExp(pat, "i");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text && regex.test(text)) {
        let target = walker.currentNode.parentElement;
        while (target && target !== document.body) {
          const cs = window.getComputedStyle(target);
          if (cs.cursor === "pointer") break;
          target = target.parentElement;
        }
        if (!target) target = walker.currentNode.parentElement;
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
        target.dispatchEvent(new PointerEvent("pointerdown", opts));
        target.dispatchEvent(new PointerEvent("pointerup", opts));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        return;
      }
    }
  }, pattern.source);
  await page.waitForTimeout(2000);
}

/**
 * Force-click an element by its data-testid attribute.
 * Dispatches pointer events to work with Tamagui's event system.
 */
export async function forceClickByTestId(page: Page, testId: string) {
  await page.evaluate((id: string) => {
    const target = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
  }, testId);
  await page.waitForTimeout(1000);
}
