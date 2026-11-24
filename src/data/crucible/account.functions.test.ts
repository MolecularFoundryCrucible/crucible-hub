import { describe, expect, it } from "vitest"

import { accountProfileUpdateInputSchema } from "./account.functions"

describe("account profile update input", () => {
  it("rejects empty updates and malformed usernames", () => {
    expect(
      accountProfileUpdateInputSchema.safeParse({ changes: {} }).success
    ).toBe(false)
    expect(
      accountProfileUpdateInputSchema.safeParse({
        changes: { username: "Invalid username" },
      }).success
    ).toBe(false)
  })
})
