import { expect, test } from "../fixtures"

const sample = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"
const dataset = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
const project = "01J6Y8N4Q2R7M9K3T5V0W1X2Z3"
const instrument = "01J6Y8N4Q2R7M9K3T5V0W1X2Z4"
const origin = `/hub/samples/${sample}`

function isResourceRequest(url: string, resourceMfid?: string) {
  const decoded = decodeURIComponent(url)
  return (
    url.includes("/hub/_serverFn/") &&
    decoded.includes("resourceMfid") &&
    (!resourceMfid || decoded.includes(resourceMfid))
  )
}

function isDatasetFilesRequest(url: string, datasetMfid: string) {
  const decoded = decodeURIComponent(url)
  return (
    url.includes("/hub/_serverFn/") &&
    decoded.includes("datasetMfid") &&
    decoded.includes(datasetMfid)
  )
}

function isContextCollectionRequest(url: string) {
  const decoded = decodeURIComponent(url)
  return (
    url.includes("/hub/_serverFn/") &&
    ["projectMfid", "instrumentMfid", "datasetMfid", "fileMfid"].some((field) =>
      decoded.includes(field)
    )
  )
}

test("preview follows native history without replacing the main page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin)
  await page.waitForLoadState("networkidle")
  const heading = page.locator("main h1")
  const handle = await heading.elementHandle()
  await page
    .getByRole("link", { name: "Preview NiFe K-edge operando series" })
    .click()
  const panel = page.getByRole("dialog")
  await expect(panel).toBeVisible()
  await expect(
    panel.getByRole("button", { name: /Add relationship to/ })
  ).toHaveCount(0)
  await expect(
    panel.getByRole("button", { name: /Manage relationships for/ })
  ).toHaveCount(0)
  await expect(panel.getByRole("button", { name: /^Unlink / })).toHaveCount(0)
  await expect(page).toHaveURL(`${origin}?preview=${dataset}`)
  await expect(
    panel.getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeFocused()
  await panel
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await expect(page).toHaveURL(`${origin}?preview=${sample}`)
  await panel.getByRole("link", { name: "Back in preview" }).click()
  await expect(page).toHaveURL(`${origin}?preview=${dataset}`)
  expect(await handle.evaluate((element) => element.isConnected)).toBe(true)
  await page.goBack()
  await expect(page).toHaveURL(origin)
  await expect(panel).toHaveCount(0)
  await page.goForward()
  await expect(panel).toBeVisible()
  await panel
    .getByRole("link", {
      name: "Open full page: NiFe K-edge operando series",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(`/hub/datasets/${dataset}`)
  await expect(heading).toHaveText("NiFe K-edge operando series")
  await page.goBack()
  await expect(page).toHaveURL(`${origin}?preview=${dataset}`)
  await expect(panel).toBeVisible()
})

test("previews dataset project and instrument context without collection reads", async ({
  page,
}) => {
  await page.goto(origin)
  await page.waitForLoadState("networkidle")
  const detailResponses: string[] = []
  const contextCollectionRequests: string[] = []
  page.on("response", (response) => {
    if (response.ok() && isResourceRequest(response.url())) {
      detailResponses.push(response.url())
    }
  })
  page.on("request", (request) => {
    if (isContextCollectionRequest(request.url())) {
      contextCollectionRequests.push(request.url())
    }
  })

  await page
    .getByRole("link", { name: "Preview NiFe K-edge operando series" })
    .click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeVisible()
  await expect(page).toHaveURL(`${origin}?preview=${dataset}`)
  await expect
    .poll(
      () =>
        detailResponses.filter((url) => isResourceRequest(url, dataset)).length
    )
    .toBe(1)

  await panel
    .getByRole("link", {
      name: "Preview project: Operando Catalyst Mapping",
      exact: true,
    })
    .click()
  await expect(
    panel.getByRole("heading", { name: "Operando Catalyst Mapping" })
  ).toBeVisible()
  await expect(panel.locator('[data-slot="badge"]')).toHaveText("Project")
  await expect(page).toHaveURL(`${origin}?preview=${project}`)
  const projectContext = panel.getByRole("region", { name: "Context" })
  await expect(projectContext.locator("dt")).toHaveText([
    "Project ID",
    "Organization",
    "Status",
    "Lead",
  ])
  await expect(projectContext.locator("dd")).toHaveText([
    "operando-catalyst-mapping",
    "Example National Laboratory",
    "active",
    "Avery Chen",
  ])
  await expect(
    panel.getByRole("heading", { name: "Relationships" })
  ).toHaveCount(0)
  await expect(panel.getByText(/^Scientific metadata/)).toHaveCount(0)
  const projectOpen = panel
    .locator('[data-slot="sheet-footer"]')
    .getByRole("link", {
      name: "Open full page: Operando Catalyst Mapping",
      exact: true,
    })
  await expect(projectOpen).toHaveText("Open")
  expect(
    new URL((await projectOpen.getAttribute("href")) ?? "", page.url()).pathname
  ).toBe(`/hub/projects/${project}`)
  await expect
    .poll(
      () =>
        detailResponses.filter((url) => isResourceRequest(url, project)).length
    )
    .toBe(1)

  await panel.getByRole("link", { name: "Back in preview" }).click()
  await expect(
    panel.getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeVisible()
  await expect(page).toHaveURL(`${origin}?preview=${dataset}`)
  await panel
    .getByRole("link", {
      name: "Preview instrument: Hard X-ray Microprobe",
      exact: true,
    })
    .click()
  await expect(
    panel.getByRole("heading", { name: "Hard X-ray Microprobe" })
  ).toBeVisible()
  await expect(panel.locator('[data-slot="badge"]')).toHaveText("Instrument")
  await expect(page).toHaveURL(`${origin}?preview=${instrument}`)
  const instrumentContext = panel.getByRole("region", { name: "Context" })
  await expect(instrumentContext.locator("dt")).toHaveText([
    "Instrument ID",
    "Type",
    "Status",
    "Location",
    "Manufacturer",
    "Model",
    "Owner",
  ])
  await expect(instrumentContext.locator("dd")).toHaveText([
    "hard-xray-microprobe",
    "X-ray microscope",
    "active",
    "Beamline 5.3.2",
    "Example Instruments",
    "XRM-5000",
    "Avery Chen",
  ])
  const instrumentOpen = panel
    .locator('[data-slot="sheet-footer"]')
    .getByRole("link", {
      name: "Open full page: Hard X-ray Microprobe",
      exact: true,
    })
  await expect(instrumentOpen).toHaveText("Open")
  expect(
    new URL((await instrumentOpen.getAttribute("href")) ?? "", page.url())
      .pathname
  ).toBe(`/hub/instruments/${instrument}`)
  await expect
    .poll(
      () =>
        detailResponses.filter((url) => isResourceRequest(url, instrument))
          .length
    )
    .toBe(1)

  expect(detailResponses).toHaveLength(3)
  expect(contextCollectionRequests).toHaveLength(0)
  await page.goBack()
  await expect(page).toHaveURL(origin)
  await expect(panel).toHaveCount(0)
})

test("direct entry and reload close safely without trusting restored trails", async ({
  page,
}) => {
  await page.goto(`${origin}?preview=${dataset}`)
  await page.waitForLoadState("networkidle")
  const panel = page.getByRole("dialog")
  await expect(panel).toBeVisible()
  await expect(
    panel.getByRole("link", { name: "Back in preview" })
  ).toHaveCount(0)
  await panel
    .getByRole("link", { name: "Preview NiFe oxide catalyst A" })
    .click()
  await expect(
    panel.getByRole("link", { name: "Back in preview" })
  ).toBeVisible()
  await page.reload()
  await expect(panel).toBeVisible()
  await expect(
    panel.getByRole("link", { name: "Back in preview" })
  ).toHaveCount(0)
  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page).toHaveURL(origin)
  await expect(panel).toHaveCount(0)
})

test("desktop outside interaction and compact focus containment survive resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin)
  await page.waitForLoadState("networkidle")
  const heading = page.locator("main h1")
  const resourceHeader = heading.locator("xpath=../..")
  const layoutBefore = await resourceHeader.boundingBox()
  if (!layoutBefore) throw new Error("Resource header was not rendered")
  const trigger = page.getByRole("link", {
    name: "Preview NiFe K-edge operando series",
  })
  await trigger.click()
  const panel = page.getByRole("dialog")
  await expect(panel).toBeVisible()
  const overlay = page.locator('[data-slot="sheet-overlay"]')
  await expect(overlay).toBeVisible()
  expect(await resourceHeader.boundingBox()).toMatchObject({
    height: layoutBefore.height,
    width: layoutBefore.width,
    x: layoutBefore.x,
  })
  await overlay.click({ position: { x: 1, y: 1 } })
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await panel
    .getByRole("heading", { name: "NiFe K-edge operando series" })
    .waitFor()
  await expect(
    panel.getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(overlay).toBeVisible()
  await panel.getByRole("button", { name: "Close", exact: true }).focus()
  await page.keyboard.press("Tab")
  const openFullPage = panel.getByRole("link", {
    name: "Open full page: NiFe K-edge operando series",
    exact: true,
  })
  await expect
    .poll(() =>
      panel.evaluate((element) => element.contains(document.activeElement))
    )
    .toBe(true)
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true)
  await openFullPage.focus()
  await expect(openFullPage).toBeFocused()
  await expect(openFullPage).toHaveText("Open")
  await page.keyboard.press("Escape")
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("loads only the selected detail and reuses it during full-page promotion", async ({
  page,
}) => {
  await page.goto(origin)
  await page.waitForLoadState("networkidle")
  const resourceRequests: string[] = []
  const fileRequests: string[] = []
  page.on("request", (request) => {
    const url = request.url()
    if (isResourceRequest(url)) resourceRequests.push(url)
    if (isDatasetFilesRequest(url, dataset)) fileRequests.push(url)
  })

  await page
    .getByRole("link", { name: "Preview NiFe K-edge operando series" })
    .click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "NiFe K-edge operando series" })
  ).toBeVisible()
  await expect
    .poll(
      () =>
        resourceRequests.filter((url) => isResourceRequest(url, dataset)).length
    )
    .toBe(1)
  expect(resourceRequests).toHaveLength(1)
  expect(fileRequests).toHaveLength(0)

  await panel
    .getByRole("link", {
      name: "Open full page: NiFe K-edge operando series",
      exact: true,
    })
    .first()
    .click()
  await expect(page).toHaveURL(`/hub/datasets/${dataset}`)
  await expect(page.locator("main h1")).toHaveText(
    "NiFe K-edge operando series"
  )
  await page.waitForLoadState("networkidle")
  expect(resourceRequests).toHaveLength(1)
  expect(fileRequests.length).toBeGreaterThan(0)
})

test("keeps the main resource through a delayed inspector failure and retry", async ({
  page,
}) => {
  const denseOrigin = "/hub/samples/fixture-sample-1?scenario=dense"
  await page.goto(denseOrigin)
  await page.waitForLoadState("networkidle")
  const heading = page.locator("main h1")
  await expect(heading).toHaveText(
    "Nickel iron oxide catalyst with a deliberately long preparation identifier"
  )
  await heading.evaluate((element) => {
    element.setAttribute("data-test-retained", "true")
  })

  let releaseRequest = () => {}
  const heldRequest = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  let failRequests = true
  let targetRequests = 0
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (!isResourceRequest(route.request().url(), "fixture-dataset-1")) {
      await route.continue()
      return
    }
    targetRequests += 1
    if (!failRequests) {
      await route.continue()
      return
    }
    await heldRequest
    await route.abort("failed")
  })

  await page
    .getByRole("link", { name: "Preview Operando spectroscopy acquisition" })
    .click()
  const panel = page.getByRole("dialog")
  await expect(panel.getByLabel("Loading resource details")).toBeVisible()
  await expect(heading).toHaveAttribute("data-test-retained", "true")
  releaseRequest()

  await expect(
    panel.getByText("Resource details could not be loaded.")
  ).toBeVisible({ timeout: 15_000 })
  await expect(heading).toHaveAttribute("data-test-retained", "true")
  expect(targetRequests).toBeGreaterThan(0)
  failRequests = false
  await panel.getByRole("button", { name: "Try again" }).click()
  await expect(
    panel.getByRole("heading", {
      name: "Operando spectroscopy acquisition with a deliberately long descriptive name",
    })
  ).toBeVisible()
  await expect(heading).toHaveAttribute("data-test-retained", "true")
})

test("aborts a delayed preview before a newer target is selected", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const browser = globalThis as typeof globalThis & {
      hubPreviewAborted?: boolean
      hubPreviewIntercepted?: boolean
    }
    const browserFetch = globalThis.fetch.bind(globalThis)
    browser.hubPreviewAborted = false
    browser.hubPreviewIntercepted = false
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      const decoded = decodeURIComponent(url)
      if (
        url.includes("/hub/_serverFn/") &&
        decoded.includes("resourceMfid") &&
        decoded.includes("fixture-dataset-1")
      ) {
        browser.hubPreviewIntercepted = true
        const signal =
          init?.signal ?? (input instanceof Request ? input.signal : undefined)
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => {
              browser.hubPreviewAborted = true
              reject(signal.reason)
            },
            { once: true }
          )
        })
      }
      return browserFetch(input, init)
    }
  })

  await page.goto("/hub/samples/fixture-sample-1?scenario=dense")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("link", { name: "Preview Operando spectroscopy acquisition" })
    .click()
  const panel = page.getByRole("dialog")
  await expect(panel.getByLabel("Loading resource details")).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              hubPreviewIntercepted?: boolean
            }
          ).hubPreviewIntercepted
      )
    )
    .toBe(true)

  await panel.getByRole("button", { name: "Close", exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              hubPreviewAborted?: boolean
            }
          ).hubPreviewAborted
      )
    )
    .toBe(true)

  await page.getByRole("link", { name: "Preview Catalyst sample 2" }).click()
  await expect(
    panel.getByRole("heading", { name: "Catalyst sample 2" })
  ).toBeVisible()
  await expect(
    panel.getByRole("heading", {
      name: "Operando spectroscopy acquisition with a deliberately long descriptive name",
    })
  ).toHaveCount(0)
})

test("rejects a malformed preview locally without requesting a resource", async ({
  page,
}) => {
  const resourceRequests: string[] = []
  page.on("request", (request) => {
    if (isResourceRequest(request.url())) resourceRequests.push(request.url())
  })

  await page.goto(`${origin}?preview=${encodeURIComponent("../private")}`)
  await page.waitForLoadState("networkidle")

  await expect(page.locator("main h1")).toHaveText("NiFe oxide catalyst A")
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Invalid resource preview" })
  ).toBeVisible()
  await expect(panel.getByRole("alert")).toHaveText(
    "The preview identifier is not valid."
  )
  expect(resourceRequests).toHaveLength(0)
})

test("clears preview state during primary navigation", async ({ page }) => {
  await page.goto(origin)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("link", { name: "Preview NiFe K-edge operando series" })
    .click()
  const panel = page.getByRole("dialog")
  await expect(panel).toBeVisible()
  await page
    .locator('[data-slot="sheet-overlay"]')
    .click({ position: { x: 1, y: 1 } })
  await expect(panel).toHaveCount(0)

  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Data" })
    .click()

  await expect(page).toHaveURL("/hub/data")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Samples and datasets"
  )
})
