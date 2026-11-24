import { describe, expect, it } from "vitest"

import { entryActions } from "./entry-capabilities"

const grantRoles = ["viewer", "contributor", "editor", "admin"] as const

describe("entry actions", () => {
  it("treats missing capabilities as no actions", () => {
    expect(entryActions(undefined, "viewer", grantRoles)).toEqual({
      canChangeRole: false,
      canRemove: false,
      roleOptions: ["viewer"],
    })
  })

  it("keeps the current role visible among assignable roles", () => {
    expect(
      entryActions(
        {
          assignable_roles: ["viewer", "contributor"],
          can_change_role: true,
          can_remove: true,
        },
        "editor",
        grantRoles
      )
    ).toEqual({
      canChangeRole: true,
      canRemove: true,
      roleOptions: ["viewer", "contributor", "editor"],
    })
  })
})
