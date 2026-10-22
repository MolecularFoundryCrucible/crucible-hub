import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

type Seen = { duration: number; property: string | null }

/** Every animation seen on `selector` for `ms` after the returned call starts. */
function watchAnimations(page: Page, selector: string, ms: number) {
  return page.evaluate(
    ([target, duration]) =>
      new Promise<Seen[]>((resolve) => {
        const seen: Seen[] = []
        const start = performance.now()
        const tick = () => {
          for (const element of document.querySelectorAll(target)) {
            for (const animation of element.getAnimations()) {
              seen.push({
                duration: Number(animation.effect?.getTiming().duration ?? 0),
                property:
                  "transitionProperty" in animation
                    ? (animation as CSSTransition).transitionProperty
                    : null,
              })
            }
          }
          if (performance.now() - start < duration) requestAnimationFrame(tick)
          else resolve(seen)
        }
        requestAnimationFrame(tick)
      }),
    [selector, ms] as const
  )
}

/** Whether `selector` was ever dimmed and the route progress ever shown. */
function watchIndicators(page: Page, selector: string, ms: number) {
  return page.evaluate(
    ([target, duration]) =>
      new Promise<{ dimmed: boolean; progress: boolean }>((resolve) => {
        const result = { dimmed: false, progress: false }
        const start = performance.now()
        const tick = () => {
          const region = document.querySelector(target)
          if (region && Number(getComputedStyle(region).opacity) < 1)
            result.dimmed = true
          if (
            document
              .querySelector(".route-progress")
              ?.getAttribute("data-phase") === "active"
          )
            result.progress = true
          if (performance.now() - start < duration) requestAnimationFrame(tick)
          else resolve(result)
        }
        requestAnimationFrame(tick)
      }),
    [selector, ms] as const
  )
}

async function refreshData(page: Page) {
  await page.getByRole("button", { name: "Refresh data" }).click()
}

test("slides the inspector in from its edge", async ({ page }) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  const animations = watchAnimations(page, ".motion-sheet", 400)
  await page
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  const properties = (await animations).map((animation) => animation.property)
  expect(properties).toContain("translate")
  expect(properties).toContain("opacity")
})

test("shows no indicator when data returns quickly", async ({ page }) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  const indicators = watchIndicators(
    page,
    "[data-slot=card].pending-region",
    600
  )
  await refreshData(page)
  expect(await indicators).toEqual({ dimmed: false, progress: false })
})

test("dims stale data after the indicator delay when data is slow", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.route("**/_serverFn/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  const region = page.locator("[data-slot=card].pending-region")
  const early = watchIndicators(page, "[data-slot=card].pending-region", 120)
  await refreshData(page)
  expect((await early).dimmed).toBe(false)
  await expect(region).toHaveAttribute("data-pending", "")
  await expect
    .poll(() => region.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("0.6")
})

test("keeps the previous rows dimmed while a slow sort loads", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.route("**/_serverFn/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  const region = page.locator("[data-slot=card].pending-region")
  await page.getByRole("button", { name: /^Sort by name/ }).click()
  await expect(region).toHaveAttribute("aria-busy", "true")
  await expect
    .poll(() => region.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("0.6")
  await expect(region).not.toHaveAttribute("aria-busy")
  await expect(region).toHaveCSS("opacity", "1")
})

test("shows route progress only for a slow navigation", async ({ page }) => {
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await page.route("**/_serverFn/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  const progress = page.locator(".route-progress")
  const early = watchIndicators(page, "main", 400)
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Projects", exact: true })
    .first()
    .click()
  expect((await early).progress).toBe(false)
  await expect(progress).toHaveAttribute("data-phase", "active")
  await expect(progress).toHaveAttribute("data-phase", "idle")
})

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("opens menus without movement", async ({ page }) => {
    await page.goto("/hub/")
    await page.waitForLoadState("networkidle")
    const animations = watchAnimations(page, "[role=menu]", 300)
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByRole("menu")).toBeVisible()
    for (const animation of await animations)
      expect(animation.duration).toBeLessThanOrEqual(1)
  })

  test("reveals sections without height motion", async ({ page }) => {
    await page.goto("/hub/admin/service-accounts")
    await page.waitForLoadState("networkidle")
    const animations = watchAnimations(page, ".reveal-panel", 400)
    await page.getByRole("switch", { name: "Administrator view" }).click()
    await expect(
      page.getByRole("button", { name: "Turn off administrator view" })
    ).toBeVisible()
    expect(await animations).toEqual([])
  })
})
