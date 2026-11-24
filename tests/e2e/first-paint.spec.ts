import { gzipSync } from "node:zlib"
import type { Response } from "@playwright/test"
import { expect, test } from "../fixtures"

const base = "http://127.0.0.1:4174"

test.use({ timezoneId: "America/Los_Angeles" })

test("renders the viewer's theme, sidebar and local times on the server", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: "crucible_hub_theme", url: base, value: "dark" },
    {
      name: "crucible_hub_time_zone",
      url: base,
      value: encodeURIComponent("America/Los_Angeles"),
    },
    { name: "crucible_hub_sidebar", url: base, value: "collapsed" },
  ])
  const response = await page.request.get(
    "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z9"
  )
  const html = await response.text()

  expect(html).toMatch(/<html[^>]*class="[^"]*\bdark\b/)
  expect(html).toMatch(/data-state="collapsed"[^>]*data-slot="sidebar"/)
  expect(html).toContain("Aug 30, 2026, 10:31")
  expect(html).not.toContain("17:31 UTC")
})

test("renders the rail on the server once the window class is known", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      domain: "127.0.0.1",
      name: "crucible_hub_window",
      path: "/hub",
      value: "medium",
    },
  ])
  const html = await (await page.request.get("/hub/?scenario=populated")).text()
  const sidebar = /<div(?=[^>]*data-slot="sidebar")[^>]*>/.exec(html)?.[0]
  expect(sidebar).toContain('data-state="collapsed"')
})

const firstLoadBudgetKb = { "/hub/auth/sign-in": 315, "/hub/": 460 }

test("keeps first-load JavaScript and CSS within budget", async ({
  browser,
}) => {
  for (const [path, budget] of Object.entries(firstLoadBudgetKb)) {
    const context = await browser.newContext({ baseURL: base })
    const page = await context.newPage()
    const bodies: Promise<Buffer>[] = []
    page.on("response", (response: Response) => {
      if (["script", "stylesheet"].includes(response.request().resourceType()))
        bodies.push(response.body())
    })
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    const bytes = (await Promise.all(bodies)).reduce(
      (total, body) => total + gzipSync(body).length,
      0
    )
    await context.close()
    expect(Math.round(bytes / 1024), `${path} gzip kB`).toBeLessThanOrEqual(
      budget
    )
  }
})
