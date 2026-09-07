import { describe, expect, it } from "vitest"

import { accountProfileUpdateInputSchema } from "./account.functions"

describe("account profile update input", () => {
  it("accepts bounded changed profile fields", () => {
    expect(
      accountProfileUpdateInputSchema.parse({
        changes: {
          email: null,
          first_name: "Ada",
          username: "ada_lovelace",
        },
      })
    ).toEqual({
      changes: {
        email: null,
        first_name: "Ada",
        username: "ada_lovelace",
      },
    })
  })

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
