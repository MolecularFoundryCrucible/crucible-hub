import { expect, test } from "../fixtures"

const base = "http://127.0.0.1:4174"

test.use({ timezoneId: "America/Los_Angeles" })

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "crucible_hub_theme", url: base, value: "dark" },
    {
      name: "crucible_hub_time_zone",
      url: base,
      value: encodeURIComponent("America/Los_Angeles"),
    },
    { name: "crucible_hub_sidebar", url: base, value: "collapsed" },
  ])
})

test("renders the viewer's theme, sidebar and local times on the server", async ({
  page,
}) => {
  const response = await page.request.get(
    "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z9"
  )
  const html = await response.text()

  expect(html).toMatch(/<html[^>]*class="[^"]*\bdark\b/)
  expect(html).toMatch(/data-state="collapsed"[^>]*data-slot="sidebar"/)
  expect(html).toContain("Aug 30, 2026, 10:31")
  expect(html).not.toContain("17:31 UTC")
})

test("keeps the server greeting after hydration", async ({ page }) => {
  const response = await page.request.get("/hub/")
  const serverGreeting = /<h1[^>]*>([^<]*)</.exec(await response.text())?.[1]

  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  expect(serverGreeting).toBeTruthy()
  await expect(page.locator("main h1").first()).toHaveText(serverGreeting!)
})
