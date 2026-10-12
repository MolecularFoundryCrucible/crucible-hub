import { describe, expect, it } from "vitest"

import { accountNeedsSetup } from "./account-setup"

describe("account setup", () => {
  it("requires setup only when the username is missing", () => {
    expect(accountNeedsSetup({ username: null })).toBe(true)
    expect(accountNeedsSetup({ username: "  " })).toBe(true)
    expect(accountNeedsSetup({ username: "avery.chen" })).toBe(false)
  })
})
