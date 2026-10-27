import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures"

const dataset = "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7"
const project = "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3"
const sample = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"

/** Whether any child of the element starts below another child's bottom. */
function wraps(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const boxes = [...element.children]
        .map((child) => child.getBoundingClientRect())
        .filter((box) => box.width > 1)
      return boxes.some((a) => boxes.some((b) => a.top >= b.bottom - 1))
    })
}

const sectionRow = 'nav[aria-label$="sections"] >> xpath=..'

for (const width of [900, 1024, 1440]) {
  test(`keeps section actions beside the tabs at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width })
    for (const path of [project, dataset]) {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      expect(await wraps(page, sectionRow)).toBe(false)
    }
    await page.goto("/hub/data?scenario=populated")
    await page.waitForLoadState("networkidle")
    expect(await wraps(page, "main header")).toBe(false)
  })
}

test("lays the overview out by content width, not window width", async ({
  page,
}) => {
  const columns = () =>
    page
      .locator('main [data-slot="card"]')
      .evaluateAll(
        (cards) =>
          new Set(cards.map((card) => card.getBoundingClientRect().left)).size
      )

  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto(dataset)
  await page.waitForLoadState("networkidle")
  expect(await columns()).toBe(2)

  await page.setViewportSize({ height: 900, width: 1440 })
  await expect.poll(columns).toBe(1)
})

test("truncates each breadcrumb segment and keeps room for the page", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 390 })
  await page.goto(dataset)
  await page.waitForLoadState("networkidle")
  const long =
    "Operando Catalyst Mapping of Nickel Iron Oxide Electrocatalysts Under Alkaline Oxygen Evolution Conditions"
  const widths = await page.evaluate((name) => {
    const items = [
      ...document.querySelectorAll('[data-slot="breadcrumb-item"]'),
    ]
    items[1].querySelector("a")!.textContent = name
    return items.map((item) => item.getBoundingClientRect().width)
  }, long)
  const [root, ancestor, current] = widths
  expect(root).toBeGreaterThan(40)
  expect(ancestor).toBeGreaterThan(60)
  expect(current).toBeGreaterThan(ancestor)
  await page.locator('[data-slot="breadcrumb-item"] a').first().focus()
  await page.keyboard.press("Tab")
  await expect(
    page.locator('[data-slot="tooltip-content"]', {
      hasText: "Operando Catalyst Mapping",
    })
  ).toBeVisible()
})

test("keeps the search shortcut hint on one line", async ({ page }) => {
  await page.setViewportSize({ height: 700, width: 820 })
  await page.goto(project)
  await page.waitForLoadState("networkidle")
  const lines = await page
    .locator('header [data-slot="kbd"]')
    .evaluate((hint) => {
      const field = hint.closest('[data-slot="input-group"]') as HTMLElement
      field.style.flex = "none"
      field.style.width = "160px"
      const range = document.createRange()
      range.selectNodeContents(hint)
      return new Set([...range.getClientRects()].map((box) => box.top)).size
    })
  expect(lines).toBe(1)
})

test.describe("window classes", () => {
  const sidebarState = (page: Page) =>
    page
      .locator('[data-slot="sidebar"][data-state]')
      .first()
      .getAttribute("data-state")

  test("shows the icon rail and a modal inspector at medium widths", async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 900 })
    await page.goto(`/hub/data?scenario=populated&preview=${sample}`)
    await page.waitForLoadState("networkidle")
    expect(await sidebarState(page)).toBe("collapsed")
    await expect(page.locator('[data-slot="sheet-overlay"]')).toBeVisible()
    const cookies = await context.cookies()
    expect(
      cookies.find((cookie) => cookie.name === "crucible_hub_window")?.value
    ).toBe("medium")

    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Expand navigation" }).click()
    expect(await sidebarState(page)).toBe("expanded")
    expect(
      (await context.cookies()).find(
        (cookie) => cookie.name === "crucible_hub_sidebar"
      )
    ).toBeUndefined()
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
    const html = await (
      await page.request.get("/hub/?scenario=populated")
    ).text()
    const sidebar = /<div(?=[^>]*data-slot="sidebar")[^>]*>/.exec(html)?.[0]
    expect(sidebar).toContain('data-state="collapsed"')
  })

  test("keeps the saved sidebar and a non-modal inspector at expanded widths", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 1180 })
    await page.goto(`/hub/data?scenario=populated&preview=${sample}`)
    await page.waitForLoadState("networkidle")
    expect(await sidebarState(page)).toBe("expanded")
    await expect(page.locator('[data-slot="sheet-content"]')).toBeVisible()
    await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0)
  })
})

test("names compact actions in a tooltip only while their label is hidden", async ({
  page,
}) => {
  const refresh = page.getByRole("button", { name: "Refresh data" })
  const tooltip = page.locator('[data-slot="tooltip-content"]', {
    hasText: /^Refresh$/,
  })

  await page.setViewportSize({ height: 800, width: 700 })
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  await refresh.hover()
  await expect(tooltip).toBeVisible()

  await page.mouse.move(0, 0)
  await page.setViewportSize({ height: 800, width: 1280 })
  await refresh.hover()
  await page.waitForTimeout(800)
  await expect(tooltip).toHaveCount(0)
})

test("marks pending deletion requests with a dot in the icon rail", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 900 })
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  const badge = page.locator('[data-sidebar="menu-badge"]')
  await expect(badge).toBeVisible()
  const box = (await badge.boundingBox())!
  expect(box.width).toBeLessThanOrEqual(10)
  expect(box.height).toBeLessThanOrEqual(10)
})

test("lays Home out with the shared content grid", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  const columns = await page
    .locator('main [data-slot="card"]')
    .evaluateAll(
      (cards) =>
        new Set(
          cards.map((card) => Math.round(card.getBoundingClientRect().left))
        ).size
    )
  expect(columns).toBe(2)
})

test("moves toasts beside an open inspector", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1180 })
  await page.goto(`/hub/data?scenario=populated&preview=${sample}`)
  await page.waitForLoadState("networkidle")
  const inspector = (await page
    .locator('[data-slot="sheet-content"]')
    .boundingBox())!
  const viewport = (await page
    .locator('[data-slot="toast-viewport"]')
    .boundingBox())!
  expect(viewport.x + viewport.width).toBeLessThanOrEqual(inspector.x)
})

test("switches every top bar control to its compact form at once", async ({
  page,
}) => {
  const shown = () =>
    page
      .locator("header")
      .first()
      .evaluate((header) => {
        const visible = (element: Element | null | undefined) =>
          Boolean(element?.checkVisibility())
        const create = [...header.querySelectorAll("span")].find(
          (span) => span.textContent === "Create"
        )
        const name = [
          ...header.querySelectorAll('[aria-label="Open account menu"] *'),
        ].find((element) => element.textContent === "Avery Chen")
        const hint = header.querySelector('[data-slot="kbd"]')
        return [visible(create), visible(name), visible(hint)]
      })

  await page.setViewportSize({ height: 800, width: 760 })
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  expect(await shown()).toEqual([false, false, false])

  await page.setViewportSize({ height: 800, width: 776 })
  await expect.poll(shown).toEqual([true, true, true])
})

test("steps only the side margin with the window class", async ({ page }) => {
  for (const [width, margin] of [
    [390, "16px"],
    [900, "24px"],
    [1280, "32px"],
  ] as const) {
    await page.setViewportSize({ height: 800, width })
    await page.goto("/hub/?scenario=populated")
    await page.waitForLoadState("networkidle")
    const [header, main] = await page.evaluate(() =>
      [
        getComputedStyle(document.querySelector("header")!),
        getComputedStyle(document.querySelector("main")!),
      ].map((style) => [style.paddingLeft, style.paddingTop])
    )
    expect(header[0]).toBe(margin)
    expect(main[0]).toBe(margin)
    expect(main[1]).toBe("24px")
  }
})

test("keeps Last activity on two lines in Home rows", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 900 })
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  const label = page
    .locator("main")
    .getByText("Last activity", { exact: true })
    .first()
  const [labelBox, timeBox] = await label.evaluate((element) => [
    element.getBoundingClientRect().toJSON() as DOMRect,
    element.nextElementSibling!.getBoundingClientRect().toJSON() as DOMRect,
  ])
  expect(timeBox.top).toBeGreaterThanOrEqual(labelBox.bottom - 1)
})

test("shows the full text of a cut-off cell only while it is cut off", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 1280 })
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")
  const cell = page.locator('td [data-slot="truncated-text"]').first()
  const text = (await cell.textContent())!
  const tooltip = page.locator('[data-slot="tooltip-content"]', {
    hasText: text,
  })

  await cell.hover()
  await page.waitForTimeout(800)
  await expect(tooltip).toHaveCount(0)

  await page.mouse.move(0, 0)
  await cell.evaluate((element) => {
    ;(element as HTMLElement).style.maxWidth = "2rem"
  })
  await cell.hover()
  await expect(tooltip).toBeVisible()
})

test("names the sidebar create actions in a Hub tooltip", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1280 })
  await page.goto("/hub/?scenario=populated")
  await page.waitForLoadState("networkidle")
  const action = page.getByRole("link", { name: "Create project" }).first()
  await page.getByRole("link", { name: "Projects", exact: true }).hover()
  await action.hover()
  await expect(
    page.locator('[data-slot="tooltip-content"]', { hasText: "Create project" })
  ).toBeVisible()
  await expect(action).not.toHaveAttribute("title")
})

test("ends every directory toolbar with Refresh", async ({ page }) => {
  async function expectRefreshLast(path: string) {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    const toolbar = page.locator('[data-slot="collection-toolbar"]')
    await expect(toolbar, path).toHaveCount(1)
    await expect(toolbar.locator("button").last(), path).toHaveAccessibleName(
      /^Refresh/
    )
  }

  await page.setViewportSize({ height: 800, width: 1280 })
  for (const path of [
    "/hub/projects",
    "/hub/instruments",
    "/hub/data",
    "/hub/deletion-requests",
  ]) {
    await expectRefreshLast(path)
  }
  await page.getByRole("switch", { name: "Administrator view" }).click()
  await expect(
    page.getByRole("switch", { name: "Administrator view" })
  ).toBeChecked()
  for (const path of ["/hub/admin/users", "/hub/admin/service-accounts"]) {
    await expectRefreshLast(path)
  }
  const search = page
    .locator('[data-slot="collection-toolbar"]')
    .getByRole("searchbox")
  await expect(search).toBeVisible()
  expect((await search.boundingBox())!.width).toBeGreaterThan(240)

  await page.setViewportSize({ height: 800, width: 390 })
  expect((await search.boundingBox())!.width).toBeGreaterThan(240)
})

test("sorts stacked directory rows from the table", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 390 })
  for (const path of ["/hub/projects", "/hub/instruments"]) {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    const select = page.getByRole("combobox", { name: "Sort by" })
    await expect(select, path).toBeVisible()
    await select.selectOption({ label: "Created, newest first" })
    await expect(page, path).toHaveURL(/sort=created/)
  }
})

test("keeps ordering out of the Filters sheet and keeps it when filters clear", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 1280 })
  for (const path of [
    "/hub/projects?sort=name&direction=desc&activeSince=2026-01-01",
    "/hub/data?scenario=populated&sort=name&direction=desc&createdFrom=2026-01-01",
  ]) {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/^Order:/), path).toHaveCount(0)
    await page.getByRole("button", { name: /^Filters/ }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet, path).toBeVisible()
    await expect(sheet.getByLabel("Order by"), path).toHaveCount(0)
    await sheet.getByRole("button", { name: "Reset" }).click()
    await sheet.getByRole("button", { name: /^Show \d+ \w+$/ }).click()
    await expect(page, path).not.toHaveURL(/activeSince|createdFrom/)
    await expect(page, path).toHaveURL(/sort=name/)
    await expect(page, path).toHaveURL(/direction=desc/)
  }
})

test("spaces every directory's toolbar and list the same way", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  const measured: Record<string, { gap: number; height: number }> = {}
  for (const path of [
    "/hub/projects",
    "/hub/instruments",
    "/hub/data",
    "/hub/data?kind=datasets",
    "/hub/deletion-requests",
    "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
  ]) {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    measured[path] = await page
      .locator('[data-slot="collection-toolbar"]')
      .first()
      .evaluate((toolbar) => {
        const box = toolbar.getBoundingClientRect()
        let next = toolbar.nextElementSibling
        while (next && next.getBoundingClientRect().height <= 1) {
          next = next.nextElementSibling
        }
        return {
          gap: Math.round(next!.getBoundingClientRect().top - box.bottom),
          height: Math.round(box.height),
        }
      })
  }
  const values = Object.values(measured)
  expect(
    new Set(values.map((value) => value.gap)),
    JSON.stringify(measured)
  ).toEqual(new Set([16]))
  expect(
    new Set(values.map((value) => value.height)),
    JSON.stringify(measured)
  ).toHaveProperty("size", 1)
})

test("keeps Filters on the left of every directory toolbar", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  for (const path of [
    "/hub/projects",
    "/hub/instruments",
    "/hub/data",
    "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
  ]) {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    const toolbar = page.locator('[data-slot="collection-toolbar"]').first()
    const toolbarBox = (await toolbar.boundingBox())!
    const filtersBox = (await toolbar
      .getByRole("button", { name: /^Filters/ })
      .boundingBox())!
    expect(filtersBox.x + filtersBox.width / 2, path).toBeLessThan(
      toolbarBox.x + toolbarBox.width / 2
    )
  }
})

test("bolds only the record name in a data table row", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/data?kind=datasets")
  await page.waitForLoadState("networkidle")
  const row = page.locator("tbody tr").first()
  const weight = (cell: string) =>
    row
      .locator(`td[data-label="${cell}"] a`)
      .first()
      .evaluate((link) => getComputedStyle(link).fontWeight)
  expect(
    await row
      .locator("[data-directory-name]")
      .first()
      .evaluate((name) => getComputedStyle(name).fontWeight)
  ).toBe("600")
  expect(await weight("Project")).toBe("400")
  expect(await weight("Owner")).toBe("400")
})

test("previews a linked project from its hover card", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/data?kind=datasets")
  await page.waitForLoadState("networkidle")
  await page.locator('tbody td[data-label="Project"] a').first().hover()
  await page.getByRole("link", { name: "Preview", exact: true }).click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Operando Catalyst Mapping" })
  ).toBeVisible()
  const data = panel.getByRole("region", { name: "Data" })
  await expect(data.getByText("Samples").locator("..")).toContainText("2")
  await expect(data.getByText("Datasets").locator("..")).toContainText("3")
  const members = panel.getByRole("region", { name: "Members (3)" })
  await expect(members.getByRole("listitem")).toHaveCount(3)
  await expect(members.getByRole("listitem").nth(1)).toContainText("Editor")
})

test("previews an instrument with its datasets and people", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/hub/data?kind=datasets&preview=01J6Y8N4Q2R7M9K3T5V0W1X2Z4")
  await page.waitForLoadState("networkidle")
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Hard X-ray Microprobe" })
  ).toBeVisible()
  const data = panel.getByRole("region", { name: "Data" })
  await expect(data.getByText("Datasets").locator("..")).toContainText("3")
  const people = panel.getByRole("region", { name: "People (2)" })
  await expect(people.getByRole("listitem").first()).toContainText("Manager")
})
