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
