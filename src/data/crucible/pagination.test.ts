import { describe, expect, it } from "vitest"

import { identityScopedPreviousData } from "./pagination"
import { identityScope } from "./query-keys"

describe("identityScopedPreviousData", () => {
  const scope = identityScope("hosted", "account-a")

  it("retains a previous page for the same identity", () => {
    const page = { items: ["project-a"] }

    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: [...scope, "projects", "list", { offset: 0 }],
      })
    ).toBe(page)
  })

  it("does not retain data from another account or server", () => {
    const page = { items: ["private-project"] }

    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: ["crucible", "hosted", "account-b", "normal", "projects"],
      })
    ).toBeUndefined()
    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: [
          "crucible",
          "other-server",
          "account-a",
          "normal",
          "projects",
        ],
      })
    ).toBeUndefined()
  })

  it("does not retain data from another privilege mode", () => {
    const page = { items: ["private-project"] }

    expect(
      identityScopedPreviousData(scope, page, {
        queryKey: ["crucible", "hosted", "account-a", "elevated", "projects"],
      })
    ).toBeUndefined()
  })
})
