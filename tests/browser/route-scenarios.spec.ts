import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "../fixtures"

const scenarioCases = [
  {
    name: "empty-home",
    path: "/hub/?scenario=empty",
    heading: "Welcome back, Avery",
    evidence: "No data is available yet",
  },
  {
    name: "restricted-projects",
    path: "/hub/projects?scenario=restricted",
    heading: "Projects you can access",
    evidence: "Limited details",
  },
  {
    name: "dense-data",
    path: "/hub/data?scenario=dense",
    heading: "Samples and datasets",
    evidence: "Samples (54)",
  },
  {
    name: "partial-home",
    path: "/hub/?scenario=partial",
    heading: "Welcome back, Avery",
    evidence: "Some recent data could not be loaded.",
  },
  {
    name: "degraded-instruments",
    path: "/hub/instruments?scenario=degraded",
    heading: "Instrument directory",
    evidence: "Instruments could not be loaded",
  },
  {
    name: "populated-search",
    path: "/hub/search?q=NiFe",
    heading: "Find anything in Crucible",
    evidence: "4 results for “NiFe”",
  },
  {
    name: "instrument-datasets",
    path: "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/datasets",
    heading: "Hard X-ray Microprobe",
    evidence: "NiFe K-edge operando series",
  },
  {
    name: "instrument-datasets-unavailable",
    path: "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/datasets?scenario=partial",
    heading: "Hard X-ray Microprobe",
    evidence: "Datasets could not be loaded",
  },
] as const

const zoomEquivalentCases = [
  {
    name: "home",
    path: "/hub/",
    heading: "Welcome back, Avery",
  },
  {
    name: "dense-data",
    path: "/hub/data?scenario=dense",
    heading: "Samples and datasets",
  },
  {
    name: "restricted-projects",
    path: "/hub/projects?scenario=restricted",
    heading: "Projects you can access",
  },
  {
    name: "instruments",
    path: "/hub/instruments",
    heading: "Instrument directory",
  },
  {
    name: "populated-search",
    path: "/hub/search?q=NiFe",
    heading: "Find anything in Crucible",
    evidence: "4 results for “NiFe”",
  },
  {
    name: "resource-detail",
    path: "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
    heading: "NiFe K-edge operando series",
    evidence: "operando-cycle-04.h5",
  },
  {
    name: "person-detail",
    path: "/hub/people/0000-0000-0000-0018",
    heading: "Morgan Lee",
  },
  {
    name: "instrument-detail",
    path: "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4",
    heading: "Hard X-ray Microprobe",
  },
  {
    name: "instrument-datasets",
    path: "/hub/instruments/01J6Y8N4Q2R7M9K3T5V0W1X2Z4/datasets",
    heading: "Hard X-ray Microprobe",
    evidence: "NiFe K-edge operando series",
  },
] as const

for (const scenario of scenarioCases) {
  test(`matches the ${scenario.name} route baseline`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
    await page.addInitScript(() => {
      localStorage.setItem("crucible-hub-theme", "light")
    })
    await page.goto(scenario.path)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      scenario.heading
    )
    await expect(page.getByText(scenario.evidence).first()).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Theme" })).toHaveValue(
      "light"
    )

    await expect(page).toHaveScreenshot(`${scenario.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
    })
  })
}

for (const zoomCase of zoomEquivalentCases) {
  test(`matches the ${zoomCase.name} 200 percent layout equivalent`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 720, height: 450 })
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
    await page.addInitScript(() => {
      localStorage.setItem("crucible-hub-theme", "light")
    })
    await page.goto(zoomCase.path)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      zoomCase.heading
    )
    await expect(
      page.getByRole("button", { name: "Toggle primary navigation" })
    ).toBeVisible()
    if ("evidence" in zoomCase) {
      await expect(page.getByText(zoomCase.evidence)).toBeVisible()
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    ).toBe(true)

    await expect(page).toHaveScreenshot(
      `${zoomCase.name}-zoom-200-equivalent.png`,
      {
        animations: "disabled",
        caret: "hide",
        fullPage: true,
      }
    )
  })
}

test("retains the selected scenario during workspace navigation", async ({
  page,
}) => {
  await page.goto("/hub/?scenario=empty")
  await page.getByRole("link", { name: "Data" }).click()
  await expect(page).toHaveURL(/\/hub\/data\?scenario=empty$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Samples and datasets"
  )
})

test("keeps compact data records readable and fully actionable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto("/hub/data?scenario=populated")
  await page.waitForLoadState("networkidle")

  const resourceName = page.getByRole("link", {
    name: "Preview NiFe oxide catalyst A",
  })
  await expect(resourceName).toBeVisible()
  await expect(resourceName).toContainText("NiFe oxide catalyst A")
  await expect(
    page.getByRole("link", {
      name: "Open full page: NiFe oxide catalyst A",
    })
  ).toContainText("Open")
  expect((await resourceName.boundingBox())?.width).toBeGreaterThan(150)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})

test("supports text spacing without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/hub/data?scenario=dense")
  await page.addStyleTag({
    content: `
      * {
        letter-spacing: 0.12em !important;
        line-height: 1.5 !important;
        word-spacing: 0.16em !important;
      }
      p {
        margin-bottom: 2em !important;
      }
    `,
  })

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true)
})

const inspectorVisualCases = [
  {
    name: "resource-inspector-wide-light",
    path: "/hub/samples/fixture-sample-1?scenario=dense&preview=fixture-dataset-1",
    theme: "light",
    viewport: { width: 1440, height: 900 },
    title:
      "Operando spectroscopy acquisition with a deliberately long descriptive name",
    evidence: "Linked samples (1)",
  },
  {
    name: "resource-inspector-compact-dark",
    path: "/hub/samples/fixture-sample-1?scenario=dense&preview=fixture-sample-3",
    theme: "dark",
    viewport: { width: 390, height: 844 },
    title: "Catalyst sample 3",
    evidence: "Relationship data is unavailable for this resource.",
  },
] as const

for (const scenario of inspectorVisualCases) {
  test(`matches the ${scenario.name} visual and accessibility baseline`, async ({
    page,
  }) => {
    await page.setViewportSize(scenario.viewport)
    await page.emulateMedia({
      colorScheme: scenario.theme,
      reducedMotion: "reduce",
    })
    await page.addInitScript((theme) => {
      localStorage.setItem("crucible-hub-theme", theme)
    }, scenario.theme)
    await page.goto(scenario.path)
    await page.waitForLoadState("networkidle")

    const panel = page.getByRole("dialog")
    await expect(
      panel.getByRole("heading", { name: scenario.title })
    ).toBeVisible()
    await expect(panel.getByText(scenario.evidence)).toBeVisible()
    await expect(page.locator("html")).toHaveClass(new RegExp(scenario.theme))
    await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({
      violations: [],
    })
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    ).toBe(true)

    await expect(page).toHaveScreenshot(`${scenario.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
    })
  })
}
