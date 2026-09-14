import { expect, test } from "../fixtures"

test("keeps samples available when the dataset collection fails", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=partial")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Samples and datasets"
  )
  await expect(page.getByText("Datasets could not be loaded")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Preview NiFe oxide catalyst A" })
  ).toBeVisible()
  await expect(page.getByLabel("Data type filter")).toBeVisible()
})

test("keeps loaded samples visible after a failed automatic continuation", async ({
  page,
}) => {
  await page.goto("/hub/data?scenario=dense&kind=samples")
  await page.waitForLoadState("networkidle")

  const collectionRequests: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/hub/_serverFn/")) {
      collectionRequests.push(request.url())
    }
  })

  await page.evaluate(() => {
    const browserFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes("/hub/_serverFn/")) {
        return Promise.reject(new TypeError("Controlled refresh failure"))
      }
      return browserFetch(input, init)
    }
  })

  await page
    .getByRole("button", { name: "Load more samples" })
    .scrollIntoViewIfNeeded()

  await expect(page).toHaveURL(/kind=samples/)
  await expect(page).not.toHaveURL(/sampleCursor=/)
  await expect(
    page.getByText(
      "More samples could not be loaded. The loaded results remain available."
    )
  ).toBeVisible()
  await expect(
    page.getByText(
      "Nickel iron oxide catalyst with a deliberately long preparation identifier"
    )
  ).toBeVisible()
  expect(collectionRequests).toHaveLength(1)
})

test("keeps previous search results visible while the query changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const browser = globalThis as typeof globalThis & {
      hubRetainedSearchAborted?: boolean
      hubRetainedSearchIntercepted?: boolean
    }
    const browserFetch = globalThis.fetch.bind(globalThis)
    browser.hubRetainedSearchAborted = false
    browser.hubRetainedSearchIntercepted = false
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (
        url.includes("/hub/_serverFn/") &&
        decodeURIComponent(url).includes('"operando"')
      ) {
        browser.hubRetainedSearchIntercepted = true
        const signal =
          init?.signal ?? (input instanceof Request ? input.signal : undefined)
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => {
              browser.hubRetainedSearchAborted = true
              reject(signal.reason)
            },
            { once: true }
          )
        })
      }
      return browserFetch(input, init)
    }
  })

  await page.goto("/hub/search?q=NiFe")
  await expect(page.getByText("NiFe oxide catalyst A")).toBeVisible()
  await page.waitForLoadState("networkidle")

  const searchForm = page.getByRole("search")
  const searchbox = searchForm.getByRole("searchbox", {
    name: "Search query",
  })
  await searchbox.fill("operando")
  await searchForm.getByRole("button", { name: "Search" }).click()

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              hubRetainedSearchIntercepted?: boolean
            }
          ).hubRetainedSearchIntercepted
      )
    )
    .toBe(true)
  await expect(page.getByText("Updating search results…")).toBeVisible()
  await expect(page.getByText("NiFe oxide catalyst A")).toBeVisible()
  await expect(page.getByLabel("Loading search results")).toHaveCount(0)

  await searchbox.fill("Morgan")
  await searchForm.getByRole("button", { name: "Search" }).click()
  await expect(page.getByText("Morgan Lee")).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              hubRetainedSearchAborted?: boolean
            }
          ).hubRetainedSearchAborted
      )
    )
    .toBe(true)
})
