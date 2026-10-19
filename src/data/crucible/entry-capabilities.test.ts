import { describe, expect, it } from "vitest"

import { entryActions, fixtureEntryCapabilities } from "./entry-capabilities"

const grantRoles = ["viewer", "contributor", "editor", "admin"] as const

describe("fixture entry capabilities", () => {
  it("lets a member manage entries up to their own role", () => {
    expect(
      fixtureEntryCapabilities({ maxGrantRole: "editor", role: "editor" })
    ).toEqual({
      assignable_roles: ["viewer", "contributor", "editor"],
      can_change_role: true,
      can_remove: true,
    })
    expect(
      fixtureEntryCapabilities({ maxGrantRole: "editor", role: "admin" })
    ).toEqual({
      assignable_roles: [],
      can_change_role: false,
      can_remove: false,
    })
  })

  it("keeps owners and fixed grants unchangeable and lets members leave", () => {
    expect(
      fixtureEntryCapabilities({ maxGrantRole: "admin", role: "owner" })
        .can_remove
    ).toBe(false)
    expect(
      fixtureEntryCapabilities({
        fixed: true,
        maxGrantRole: "admin",
        role: "viewer",
      })
    ).toEqual({
      assignable_roles: [],
      can_change_role: false,
      can_remove: false,
    })
    expect(
      fixtureEntryCapabilities({
        maxGrantRole: "viewer",
        role: "admin",
        self: true,
      }).can_remove
    ).toBe(true)
  })

  it("limits service accounts to viewer and contributor", () => {
    expect(
      fixtureEntryCapabilities({
        maxGrantRole: "admin",
        role: "contributor",
        serviceAccount: true,
      }).assignable_roles
    ).toEqual(["viewer", "contributor"])
  })
})

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
