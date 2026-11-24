import { expect, test } from "../fixtures"

const sampleMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"

function serverFunctionPost(request: {
  method: () => string
  url: () => string
}) {
  return (
    request.method() === "POST" && request.url().includes("/hub/_serverFn/")
  )
}

test("retains the reason after a failed deletion request and submits it on retry without calling a live API", async ({
  page,
}) => {
  const liveApiRequests: string[] = []
  page.on("request", (request) => {
    if (/crucible\.lbl\.gov|testapi|staging/i.test(request.url())) {
      liveApiRequests.push(request.url())
    }
  })

  await page.goto(`/hub/samples/${sampleMfid}/manage?scenario=populated`)
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", {
      name: "Request deletion of NiFe oxide catalyst A",
      exact: true,
    })
    .click()

  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("heading", { name: "Request deletion?" })
  ).toBeVisible()
  await expect(dialog).toContainText("submits NiFe oxide catalyst A for review")
  const reason = dialog.getByLabel("Reason")
  await reason.fill("Duplicate sample record")
  let failed = false
  const mutationRequests: string[] = []
  await page.route("**/hub/_serverFn/**", async (route) => {
    if (serverFunctionPost(route.request())) {
      if (!failed) {
        failed = true
        await route.abort("failed")
        return
      }
      mutationRequests.push(route.request().url())
    }
    await route.continue()
  })
  const submit = dialog.getByRole("button", {
    name: "Submit deletion request",
    exact: true,
  })
  await submit.click()

  await expect(dialog.getByRole("alert")).toHaveText(
    "The deletion request could not be submitted. Your reason is still here."
  )
  await expect(reason).toHaveValue("Duplicate sample record")

  await submit.click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("button", {
      name: "Deletion request pending",
      exact: true,
    })
  ).toBeVisible()
  expect(mutationRequests).toHaveLength(1)
  expect(liveApiRequests).toEqual([])
})
