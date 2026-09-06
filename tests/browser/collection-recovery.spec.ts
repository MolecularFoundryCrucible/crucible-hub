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

test("queries only samples and keeps them visible after a failed refresh", async ({
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

  const nextPageResponse = page.waitForResponse((response) =>
    response.url().includes("/hub/_serverFn/")
  )
  await page.getByRole("link", { name: "Next samples" }).click()
  await nextPageResponse

  await expect(page).toHaveURL(/sampleCursor=fixture%3A50/)
  await expect(page.getByText("Catalyst sample 51")).toBeVisible()
  expect(collectionRequests).toHaveLength(1)

  await page.evaluate(() => {
    const currentTime = Date.now.bind(Date)
    const browserFetch = globalThis.fetch.bind(globalThis)
    Date.now = () => currentTime() + 60_000
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes("/hub/_serverFn/")) {
        return Promise.reject(new TypeError("Controlled refresh failure"))
      }
      return browserFetch(input, init)
    }
  })

  await page.goBack()

  await expect(page).toHaveURL(/kind=samples/)
  await expect(page).not.toHaveURL(/sampleCursor=/)
  await expect(page.getByText("Samples could not be refreshed")).toBeVisible()
  await expect(
    page.getByText(
      "Nickel iron oxide catalyst with a deliberately long preparation identifier"
    )
  ).toBeVisible()
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
