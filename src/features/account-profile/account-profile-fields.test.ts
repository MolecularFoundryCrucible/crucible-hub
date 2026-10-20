import { describe, expect, it } from "vitest"

import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"
import {
  accountProfileChanges,
  accountProfileFormSchema,
  accountProfileValues,
} from "./account-profile-fields"

const account = { ...demoWorkspace.account, username: "avery_chen" }

describe("account profile names", () => {
  it("rejects clearing a name the account already has", () => {
    const result = accountProfileFormSchema(account).safeParse({
      ...accountProfileValues(account),
      first_name: "  ",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      message: "Enter a first name.",
      path: ["first_name"],
    })
  })

  it("allows a name that was never set to stay empty", () => {
    const unnamed = { ...account, first_name: "", last_name: "" }
    expect(
      accountProfileFormSchema(unnamed).safeParse(accountProfileValues(unnamed))
        .success
    ).toBe(true)
  })

  it("never sends an empty name", () => {
    expect(
      accountProfileChanges(account, {
        ...accountProfileValues(account),
        first_name: "",
        last_name: "Lovelace",
      })
    ).toEqual({ last_name: "Lovelace" })
  })
})
