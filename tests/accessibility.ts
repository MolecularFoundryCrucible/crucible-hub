import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

/**
 * Runs axe once finite animations and transitions have finished, so colour
 * contrast is measured on content at rest rather than mid fade.
 */
export async function analyzeAccessibility(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().endTime === Infinity
      )
  )
  return new AxeBuilder({ page }).analyze()
}
