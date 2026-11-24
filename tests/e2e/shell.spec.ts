import { expect, test } from "../fixtures"
import { analyzeAccessibility } from "../accessibility"

test("renders the desktop workspace accessibly in light and dark themes", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^(Good (morning|afternoon|evening)|Welcome to (Crucible|the Crux)), Avery$/
  )
  await expect(
    page.getByLabel("Primary navigation", { exact: true })
  ).toBeVisible()
  const primaryNavigation = page.getByLabel("Primary navigation", {
    exact: true,
  })
  await expect(
    primaryNavigation.getByRole("link", { name: "Crucible Hub" })
  ).toBeVisible()
  await expect(
    primaryNavigation.getByRole("link", { name: "Home", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    primaryNavigation.getByRole("button", { name: "Collapse navigation" })
  ).toBeVisible()
  await expect(page.getByText("Local demo", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Fixture", { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Recently added data" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Your projects" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Your instruments" })
  ).toBeVisible()
  const recentlyAdded = page.getByRole("region", {
    name: "Recently added data",
  })
  await expect(
    recentlyAdded.getByText("NiFe K-edge operando series")
  ).toBeVisible()
  await expect(
    recentlyAdded.getByText("Activated catalyst morphology")
  ).toBeVisible()
  await expect(page.getByText(/^Updated Sep 1, 2026$/)).toHaveCount(0)

  const yourProjectsSection = page.getByRole("region", {
    name: "Your projects",
  })
  await expect(
    yourProjectsSection.getByText("Operando Catalyst Mapping")
  ).toBeVisible()
  await expect(
    yourProjectsSection.getByText("Last activity").first()
  ).toBeVisible()

  const lightResults = await analyzeAccessibility(page)
  expect(lightResults.violations).toEqual([])

  await page.getByRole("button", { name: "Theme" }).click()
  await page.getByRole("menuitemradio", { name: "Dark" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  const darkResults = await analyzeAccessibility(page)
  expect(darkResults.violations).toEqual([])
})

test("keeps the origin on a native logout form submission", async ({
  page,
  request,
}) => {
  const documentResponse = await page.goto("/hub/")
  expect(documentResponse?.headers()["referrer-policy"]).toBe("same-origin")

  const callbackResponse = await request.get("/hub/auth/callback", {
    maxRedirects: 0,
  })
  expect(callbackResponse.status()).toBe(303)
  expect(callbackResponse.headers()["referrer-policy"]).toBe("no-referrer")
  expect(callbackResponse.headers()["cache-control"]).toBe("no-store")

  for (const origin of ["null", "https://example.org"]) {
    const rejected = await request.post("/hub/auth/logout", {
      headers: { Origin: origin },
      maxRedirects: 0,
    })
    expect(rejected.status()).toBe(403)
  }

  const expectedOrigin = new URL(page.url()).origin
  await page.route("**/hub/auth/logout", (route) =>
    route.fulfill({ status: 200, body: "Signed out" })
  )
  const logoutRequest = page.waitForRequest(
    (submission) =>
      submission.url().endsWith("/hub/auth/logout") &&
      submission.method() === "POST"
  )

  await page.evaluate(() => {
    const form = document.createElement("form")
    form.action = "/hub/auth/logout"
    form.method = "post"
    document.body.append(form)
    form.requestSubmit()
  })

  expect((await logoutRequest).headers()["origin"]).toBe(expectedOrigin)
  await expect(page.getByText("Signed out")).toBeVisible()
  await page.unrouteAll({ behavior: "ignoreErrors" })
})

test("fits Home within a compact browser viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/hub/")

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  const accessibilityResults = await analyzeAccessibility(page)
  expect(accessibilityResults.violations).toEqual([])
})

test("assigns a new Hub correlation ID to each request", async ({ page }) => {
  const documentResponse = await page.goto("/hub/search")
  const documentCorrelationId = documentResponse?.headers()["x-correlation-id"]
  expect(documentCorrelationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  )

  const serverFunctionResponse = page.waitForResponse((response) =>
    response.url().includes("/hub/_serverFn/")
  )
  const searchForm = page.getByRole("search", { name: "Resource search" })
  await searchForm.getByRole("searchbox", { name: "Search query" }).fill("NiFe")
  await searchForm.getByRole("button", { name: "Search" }).click()
  const functionCorrelationId = (await serverFunctionResponse).headers()[
    "x-correlation-id"
  ]

  expect(functionCorrelationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  )
  expect(functionCorrelationId).not.toBe(documentCorrelationId)
})

test("opens global search from the keyboard and restores URL-backed results", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  await page.keyboard.press("Control+k")

  const quickSearch = page.getByRole("combobox", { name: "Search Crucible" })
  await expect(quickSearch).toBeFocused()
  await quickSearch.fill("NiFe")
  await expect(
    page.getByRole("listbox", { name: "Quick search results" })
  ).toBeVisible()
  await page.getByRole("button", { name: "View all results" }).click()

  await expect(page).toHaveURL(/\/hub\/search\?q=NiFe/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search")
  const main = page.getByRole("main")
  await expect(main.getByText("NiFe oxide catalyst A")).toBeVisible()
  await expect(main.getByText("NiFe K-edge operando series")).toBeVisible()

  await page.getByRole("button", { name: "Samples" }).click()
  await expect(page).toHaveURL(/kind=sample/)
  await expect(main.getByText("NiFe oxide catalyst A")).toBeVisible()
  await expect(main.getByText("NiFe K-edge operando series")).toHaveCount(0)

  await page.reload()
  await page.waitForLoadState("networkidle")
  await expect(main.getByText("NiFe oxide catalyst A")).toBeVisible()
  const searchForm = page.getByRole("search", { name: "Resource search" })
  await searchForm
    .getByRole("searchbox", { name: "Search query" })
    .fill("operando")
  await searchForm.getByRole("button", { name: "Search" }).click()
  await expect(page).toHaveURL(/q=operando/)
  await page.goBack()
  await expect(
    page.getByRole("searchbox", { name: "Search query" })
  ).toHaveValue("NiFe")
  await page.setViewportSize({ width: 720, height: 900 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  const accessibilityResults = await analyzeAccessibility(page)
  expect(accessibilityResults.violations).toEqual([])
})

test("renders exact dataset detail and file metadata from a canonical link", async ({
  page,
}) => {
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))

  await page.goto("/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NiFe K-edge operando series"
  )
  const summary = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Summary", { exact: true }) })
  const projectField = summary.locator("dl > div").filter({
    has: page.getByText("Project", { exact: true }),
  })
  const instrumentField = summary.locator("dl > div").filter({
    has: page.getByText("Instrument", { exact: true }),
  })
  await expect(
    projectField.locator('[data-resource-type="project"]')
  ).toBeVisible()
  await expect(
    instrumentField.locator('[data-resource-type="instrument"]')
  ).toBeVisible()
  await expect(summary.locator("[data-summary-field-icon]")).toHaveCount(5)
  const identity = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Identity", { exact: true }) })
  await expect(identity.locator("[data-identity-field-icon]")).toHaveCount(3)
  await expect(identity.locator('[data-principal-type="user"]')).toBeVisible()
  await expect(page.getByText("operando-cycle-04.h5")).toBeVisible()
  await page.locator('summary[aria-label^="acquisition:"]').click()
  await expect(page.getByText("potential_v_rhe")).toBeVisible()
  const accessibilityResults = await analyzeAccessibility(page)
  expect(accessibilityResults.violations).toEqual([])

  await page
    .getByRole("link", { name: "Operando Catalyst Mapping" })
    .last()
    .click()
  await expect(page).toHaveURL(/\/hub\/projects\/01J6Y8N4Q2R7M9K3T5V0W1X2Z3/)

  await page.goBack()
  await page
    .getByRole("main")
    .getByRole("link", { name: "Hard X-ray Microprobe" })
    .click()
  await expect(page).toHaveURL(/\/hub\/instruments\/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/)

  await page.goBack()
  await page
    .getByRole("link", {
      name: "Open full page: NiFe oxide catalyst A",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/hub\/samples\/01J6Y8N4Q2R7M9K3T5V0W1X2Z5/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NiFe oxide catalyst A"
  )
  expect(browserErrors).toEqual([])
})

test("redirects a generic resource link to its typed canonical page", async ({
  page,
}) => {
  await page.goto(
    "/hub/resources/01J6Y8N4Q2R7M9K3T5V0W1X2Z5?scenario=populated"
  )
  await expect(page).toHaveURL(
    /\/hub\/samples\/01J6Y8N4Q2R7M9K3T5V0W1X2Z5\?scenario=populated/
  )
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NiFe oxide catalyst A"
  )
})

test("keeps the app shell when a page fails to load", async ({ page }) => {
  await page.goto("/hub/projects")
  await page.waitForLoadState("networkidle")
  await page.route("**/_serverFn/**", (route) => route.abort())

  await page
    .getByRole("main")
    .locator('a[href^="/hub/projects/"]:not([href$="/new"])')
    .first()
    .click()

  await expect(
    page.getByRole("alert").getByText("This page could not be loaded")
  ).toBeVisible()
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Projects" })
  ).toBeVisible()
})
