import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "../fixtures"

test("renders the desktop workspace without development chrome", async ({
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
  await expect(page.getByText("NiFe K-edge operando series")).toBeVisible()
  await expect(page.getByText("Activated catalyst morphology")).toBeVisible()
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
})

test("opens dedicated creation routes from the global Create menu", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  const trigger = page.getByRole("button", { name: "Create" })
  await trigger.focus()
  await page.keyboard.press("Enter")

  const menu = page.getByRole("menu")
  await expect(menu.getByRole("menuitem", { name: "Project" })).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: "Sample" })).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: "Dataset" })).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: "Instrument" })).toBeVisible()

  const sample = menu.getByRole("menuitem", { name: "Sample" })
  await sample.focus()
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(/\/hub\/samples\/new$/)
  await expect(page).toHaveTitle("Create sample | Crucible Hub")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Create sample"
  )
})

test("keeps Home useful when one recent data source fails", async ({
  page,
}) => {
  await page.goto("/hub/?scenario=partial")
  await page.waitForLoadState("networkidle")

  await expect(
    page.getByText("Some recent data could not be loaded.")
  ).toBeVisible()
  await expect(page.getByText("NiFe oxide catalyst A")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Your projects" })
  ).toBeVisible()
  await expect(
    page.getByText("Projects and navigation remain available.")
  ).toHaveCount(0)
})

test("toggles recent data between all and mine on Home", async ({ page }) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  const recentDataCard = page.getByRole("region", {
    name: "Recently added data",
  })
  await expect(
    recentDataCard.getByRole("button", { name: "All" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(recentDataCard.getByText("NiFe phase evolution")).toBeVisible()

  await recentDataCard.getByRole("button", { name: "Mine" }).click()
  await expect(
    recentDataCard.getByRole("button", { name: "Mine" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    recentDataCard.getByText("NiFe K-edge operando series")
  ).toBeVisible()
  await expect(recentDataCard.getByText("NiFe phase evolution")).toHaveCount(0)

  await recentDataCard.getByRole("button", { name: "All" }).click()
  await expect(recentDataCard.getByText("NiFe phase evolution")).toBeVisible()
})

test("fits Home within a compact browser viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/hub/")

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  const accessibilityResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityResults.violations).toEqual([])
})

test("opens recent data from Home with the keyboard", async ({ page }) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  const dataset = page.getByRole("link", {
    name: /NiFe K-edge operando series/,
  })
  await dataset.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/hub\/datasets\/01J6Y8N4Q2R7M9K3T5V0W1X2Z7/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NiFe K-edge operando series"
  )
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

test("fits prioritized data columns within a laptop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto("/hub/data")
  await page.waitForLoadState("networkidle")

  await expect(page.getByRole("columnheader", { name: "Type" })).toBeHidden()
  await expect(page.getByRole("columnheader", { name: "Size" })).toHaveCount(0)
  await expect(
    page.getByText("electrocatalyst", { exact: true }).first()
  ).toBeVisible()
  expect(
    await page
      .locator('[data-slot="table-container"]')
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true)
})

test("uses scientific subtypes in the wide data table", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto("/hub/data")
  await page.waitForLoadState("networkidle")

  await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Size" })).toHaveCount(0)
  await expect(
    page.getByRole("cell", { name: "electrocatalyst" }).first()
  ).toBeVisible()
  await page.getByRole("button", { name: /^Datasets/ }).click()
  await expect(
    page.getByRole("cell", { name: "X-ray fluorescence microscopy" })
  ).toBeVisible()
})

test("renders the independently queried instrument directory", async ({
  page,
}) => {
  await page.goto("/hub/instruments")
  await page.waitForLoadState("networkidle")

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Instrument directory"
  )
  await expect(
    page.getByText("Hard X-ray Microprobe", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Beamline 5.3.2")).toBeVisible()

  await page.getByRole("button", { name: /^Filters/ }).click()
  await page.getByLabel("Lifecycle status").selectOption("maintenance")
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page).toHaveURL(/status=maintenance/)
  await expect(
    page.getByText("No maintenance instruments are available to this account.")
  ).toBeVisible()
})

test("opens canonical instrument detail from directory and search", async ({
  page,
}) => {
  await page.goto("/hub/instruments")
  await page
    .getByRole("link", { name: "Open full page: Hard X-ray Microprobe" })
    .first()
    .click()

  await expect(page).toHaveURL(/\/hub\/instruments\/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Hard X-ray Microprobe"
  )
  await expect(page.getByText("hard-xray-microprobe").first()).toBeVisible()
  await page.getByRole("link", { name: "Overview" }).click()
  await expect(page).toHaveURL(
    /\/hub\/instruments\/01J6Y8N4Q2R7M9K3T5V0W1X2Z4\/overview/
  )
  await expect(page.getByText("spatial_resolution_nm")).toBeVisible()
  await expect(page.getByRole("link", { name: "A. Chen" })).toBeVisible()
  await expect(page.locator('main [data-slot="card-title"]')).toHaveText([
    "Summary",
    "Identity",
    "People",
    "Scientific metadata",
  ])

  await page.goto("/hub/search?q=Hard&kind=instrument")
  await page.getByRole("link", { name: "Hard X-ray Microprobe" }).click()
  await expect(page).toHaveURL(/\/hub\/instruments\/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/)

  const accessibilityResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityResults.violations).toEqual([])
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find anything in Crucible"
  )
  await expect(page.getByText("NiFe oxide catalyst A")).toBeVisible()
  await expect(page.getByText("NiFe K-edge operando series")).toBeVisible()

  await page.getByRole("button", { name: "Samples" }).click()
  await expect(page).toHaveURL(/kind=sample/)
  await expect(page.getByText("NiFe oxide catalyst A")).toBeVisible()
  await expect(page.getByText("NiFe K-edge operando series")).toHaveCount(0)

  await page.reload()
  await page.waitForLoadState("networkidle")
  await expect(page.getByText("NiFe oxide catalyst A")).toBeVisible()
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
  const accessibilityResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityResults.violations).toEqual([])
})

test("submits quick search on enter when no suggestion is highlighted", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  const quickSearch = page.getByRole("combobox", { name: "Search Crucible" })
  await quickSearch.fill("NiFe")
  await expect(
    page.getByRole("listbox", { name: "Quick search results" })
  ).toBeVisible()
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(/\/hub\/search\?q=NiFe/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find anything in Crucible"
  )
  await expect(page.getByText("NiFe oxide catalyst A")).toBeVisible()
})

test("navigates to highlighted quick search suggestion on enter and closes search", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  const quickSearch = page.getByRole("combobox", { name: "Search Crucible" })
  await quickSearch.fill("NiFe")
  await expect(
    page.getByRole("listbox", { name: "Quick search results" })
  ).toBeVisible()

  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(/\/hub\/samples\/01J6Y8N4Q2R7M9K3T5V0W1X2Z5/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NiFe oxide catalyst A"
  )
  await expect(
    page.getByRole("listbox", { name: "Quick search results" })
  ).toHaveCount(0)
  await expect(quickSearch).not.toBeFocused()
})

test("keeps successful global search groups when one source fails", async ({
  page,
}) => {
  await page.goto("/hub/search?q=operando&scenario=partial")

  await expect(page.getByText("Operando Catalyst Mapping")).toBeVisible()
  await expect(
    page.getByText(
      "Datasets could not be searched. Other results remain available."
    )
  ).toBeVisible()
})

test("searches public-safe people and opens canonical person detail", async ({
  page,
}) => {
  await page.goto("/hub/search?q=Morgan&kind=person")

  await expect(page.getByText("1 result for “Morgan”")).toBeVisible()
  await page.getByRole("link", { name: "Morgan Lee" }).click()

  await expect(page).toHaveURL(/\/hub\/users\/0000-0000-0000-0018/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Morgan Lee")
  await expect(page.getByText("@morgan.lee")).toBeVisible()
  await expect(page.getByText("0000-0000-0000-0018")).toBeVisible()
  await expect(page.getByText("private@example.invalid")).toHaveCount(0)
})

test("cancels a superseded global search request", async ({ page }) => {
  await page.addInitScript(() => {
    const browser = globalThis as typeof globalThis & {
      hubFirstSearchAborted?: boolean
      hubFirstSearchIntercepted?: boolean
    }
    const browserFetch = globalThis.fetch.bind(globalThis)
    browser.hubFirstSearchAborted = false
    browser.hubFirstSearchIntercepted = false
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (
        url.includes("/hub/_serverFn/") &&
        decodeURIComponent(url).includes('"NiFe"')
      ) {
        browser.hubFirstSearchIntercepted = true
        const signal =
          init?.signal ?? (input instanceof Request ? input.signal : undefined)
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => {
              browser.hubFirstSearchAborted = true
              reject(signal.reason)
            },
            { once: true }
          )
        })
      }
      return browserFetch(input, init)
    }
  })

  await page.goto("/hub/search")
  const searchForm = page.getByRole("search", { name: "Resource search" })
  const searchbox = searchForm.getByRole("searchbox", {
    name: "Search query",
  })
  await searchbox.fill("NiFe")
  await searchForm.getByRole("button", { name: "Search" }).click({
    noWaitAfter: true,
  })
  await expect(page.getByLabel("Loading search results")).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              hubFirstSearchIntercepted?: boolean
            }
          ).hubFirstSearchIntercepted
      )
    )
    .toBe(true)

  await searchbox.fill("operando")
  await searchForm.getByRole("button", { name: "Search" }).click()

  await expect(page).toHaveURL(/q=operando/)
  await expect(page.getByText("Operando Catalyst Mapping")).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              hubFirstSearchAborted?: boolean
            }
          ).hubFirstSearchAborted
      )
    )
    .toBe(true)
})

test("has no detectable accessibility violations in light and dark themes", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  const lightResults = await new AxeBuilder({ page }).analyze()
  expect(lightResults.violations).toEqual([])

  await page.getByRole("button", { name: "Theme" }).click()
  await page.getByRole("menuitemradio", { name: "Dark" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  const darkResults = await new AxeBuilder({ page }).analyze()
  expect(darkResults.violations).toEqual([])
})

test("persists an explicit dark theme without a hydration mismatch", async ({
  page,
}) => {
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))

  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  expect(browserErrors).toEqual([])
  await page.getByRole("button", { name: "Theme" }).click()
  await page.getByRole("menuitemradio", { name: "Dark" }).click()
  await expect
    .poll(() => page.evaluate(() => document.cookie))
    .toContain("crucible_hub_theme=dark")
  await expect(page.locator("html")).toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Theme" }).click()
  await expect(
    page.getByRole("menuitemradio", { name: "Dark" })
  ).toHaveAttribute("aria-checked", "true")
  expect(browserErrors).toEqual([])
})

test("opens shortcut help and navigates with key sequences", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  await page.keyboard.press("?")
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("Ctrl K", { exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  await page.keyboard.press("g")
  await page.keyboard.press("p")
  await expect(page).toHaveURL(/\/hub\/projects$/)
})

test("searches data within the active project and retains return context", async ({
  page,
}) => {
  const projectMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z3"
  await page.goto(`/hub/projects/${projectMfid}`)
  await page.waitForLoadState("networkidle")
  const quickSearch = page.getByRole("combobox", {
    name: "Search Operando Catalyst Mapping",
  })
  await expect(quickSearch).toBeVisible()
  await page.keyboard.press("Control+Shift+k")

  await expect(quickSearch).toBeFocused()
  await expect(
    page.getByRole("button", { name: "This project" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", { name: "All Crucible" })
  ).toHaveAttribute("aria-pressed", "false")
  await quickSearch.fill("NiFe")
  await expect(
    page.getByRole("listbox", { name: "Quick search results" })
  ).toBeVisible()
  await page.getByRole("button", { name: "View all results" }).click()

  await expect(page).toHaveURL(
    new RegExp(`/hub/search\\?.*projectMfid=${projectMfid}`)
  )
  await expect(
    page.getByRole("link", { name: "Back to project" })
  ).toBeVisible()
  const sample = page.getByRole("link", {
    name: "Open full page: NiFe oxide catalyst A",
  })
  await expect(sample).toHaveAttribute(
    "href",
    new RegExp(`fromProject=${projectMfid}`)
  )
  await sample.click()
  await expect(
    page.getByRole("combobox", { name: "Search Operando Catalyst Mapping" })
  ).toBeVisible()
})

test("adapts navigation for a compact browser viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  await expect(
    page.getByLabel("Primary navigation", { exact: true })
  ).toBeHidden()
  await page.getByRole("button", { name: "Expand navigation" }).click()
  await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeVisible()
  await expect(
    page.getByRole("dialog", { name: "Sidebar" }).getByRole("link", {
      name: "Projects",
    })
  ).toBeVisible()
})

test("persists the collapsed desktop navigation preference", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")
  const sidebar = page.locator('[data-slot="sidebar"][data-state]')

  await expect(sidebar).toHaveAttribute("data-state", "expanded")
  await page.keyboard.press("Control+b")
  await expect(sidebar).toHaveAttribute("data-state", "collapsed")
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.cookie.includes("crucible_hub_sidebar=collapsed")
      )
    )
    .toBe(true)

  await page.reload()
  await expect(sidebar).toHaveAttribute("data-state", "collapsed")
})

test("navigates typed project routes and URL-backed data filters", async ({
  page,
}) => {
  await page.goto("/hub/data")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /^Datasets/ }).click()
  await expect(page).toHaveURL(/kind=datasets/)
  await expect(page.getByText("NiFe oxide catalyst A")).toBeHidden()
  await expect(page.getByText("NiFe K-edge operando series")).toBeVisible()

  await page
    .getByRole("link", { name: "Operando Catalyst Mapping" })
    .first()
    .click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Operando Catalyst Mapping"
  )
  await expect(
    page.getByRole("navigation", { name: "Project sections" })
  ).toBeVisible()
  await expect(page.getByLabel("Project data type")).toBeVisible()
})

test("renders exact project detail from a direct canonical link", async ({
  page,
}) => {
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))

  await page.goto("/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Operando Catalyst Mapping"
  )
  await expect(page.getByLabel("Project data type")).toBeVisible()

  await page.getByRole("link", { name: "Overview" }).click()
  await expect(page).toHaveURL(
    /\/hub\/projects\/01J6Y8N4Q2R7M9K3T5V0W1X2Z3\/overview/
  )
  await expect(page.locator('main [data-slot="card-title"]')).toHaveText([
    "Summary",
    "Identity",
    "People",
    "Scientific metadata",
  ])
  const identityCard = page.locator('main [data-slot="card"]').filter({
    has: page.getByText("Identity", { exact: true }),
  })
  await expect(
    identityCard.getByRole("term").filter({ hasText: "Lead" })
  ).toBeVisible()
  await expect(
    identityCard.getByRole("term").filter({ hasText: "Your role" })
  ).toBeVisible()
  expect(browserErrors).toEqual([])
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
  const accessibilityResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityResults.violations).toEqual([])

  await page
    .getByRole("link", { name: "Operando Catalyst Mapping" })
    .last()
    .click()
  await expect(page).toHaveURL(/\/hub\/projects\/01J6Y8N4Q2R7M9K3T5V0W1X2Z3/)

  await page.goBack()
  await page.getByRole("link", { name: "Hard X-ray Microprobe" }).click()
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

test("omits aggregate dataset size from Summary", async ({ page }) => {
  await page.goto("/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7")
  const datasetSummary = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Summary", { exact: true }) })

  await expect(datasetSummary.getByText("Size", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("columnheader", { name: "Size" })).toBeVisible()
})

test("keeps sample description in Summary with a standard empty value", async ({
  page,
}) => {
  const summaryFor = () =>
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Summary", { exact: true }) })

  await page.goto("/hub/samples/01J6Y8N4Q2R7M9K3T5V0W1X2Z5")
  const describedSummary = summaryFor()
  await expect(
    describedSummary.getByText("Description", { exact: true })
  ).toBeVisible()
  await expect(
    describedSummary.getByText(
      "Nickel-iron oxide catalyst on carbon paper after activation.",
      { exact: true }
    )
  ).toBeVisible()
  await expect(
    page.getByText(
      "Nickel-iron oxide catalyst on carbon paper after activation.",
      { exact: true }
    )
  ).toHaveCount(1)

  await page.goto("/hub/samples/01J6Y8N4Q2R7M9K3T5V0W1X2Z6")
  const emptySummary = summaryFor()
  const descriptionField = emptySummary.locator("dl > div").filter({
    has: page.getByText("Description", { exact: true }),
  })
  await expect(descriptionField).toContainText("-")
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

test("renders ordered sidebar navigation with sub-navigation and creation actions", async ({
  page,
}) => {
  await page.goto("/hub/")
  await page.waitForLoadState("networkidle")

  const nav = page.getByLabel("Primary navigation", { exact: true })
  await expect(nav).toBeVisible()

  const navLinks = nav.locator(
    '[data-slot="sidebar-content"] ul[data-slot="sidebar-menu"] > li > [data-slot="sidebar-menu-button"]'
  )
  await expect(navLinks.nth(0)).toHaveText("Home")
  await expect(navLinks.nth(1)).toHaveText("Data")
  await expect(navLinks.nth(2)).toHaveText("Projects")
  await expect(navLinks.nth(3)).toHaveText("Instruments")

  const samplesSubLink = nav.getByRole("link", { name: "Browse samples" })
  const datasetsSubLink = nav.getByRole("link", { name: "Browse datasets" })
  await expect(samplesSubLink).toBeVisible()
  await expect(datasetsSubLink).toBeVisible()

  const createProjectAction = nav.getByRole("link", { name: "Create project" })
  const registerInstrumentAction = nav.getByRole("link", {
    name: "Register instrument",
  })
  const createSampleAction = nav.getByRole("link", { name: "Create sample" })
  const createDatasetAction = nav.getByRole("link", { name: "Create dataset" })
  await expect(createProjectAction).toHaveAttribute("href", "/hub/projects/new")
  await expect(registerInstrumentAction).toHaveAttribute(
    "href",
    "/hub/instruments/new"
  )
  await expect(createSampleAction).toHaveAttribute("href", "/hub/samples/new")
  await expect(createDatasetAction).toHaveAttribute("href", "/hub/datasets/new")

  const dataBox = await navLinks.nth(1).boundingBox()
  const samplesBox = await samplesSubLink.boundingBox()
  expect(dataBox).not.toBeNull()
  expect(samplesBox).not.toBeNull()
  if (dataBox && samplesBox) {
    expect(Math.round(samplesBox.x + samplesBox.width)).toBe(
      Math.round(dataBox.x + dataBox.width)
    )
  }

  await samplesSubLink.click()
  await expect(page).toHaveURL(/\/hub\/data(?![^#]*kind=)/)

  await datasetsSubLink.click()
  await expect(page).toHaveURL(/\/hub\/data\?kind=datasets/)
})
