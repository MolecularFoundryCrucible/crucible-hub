import { describe, expect, it } from "vitest"

import { permittedAccessGrantRoles } from "./access-role-badge"

describe("permittedAccessGrantRoles", () => {
  it("does not include roles above the capability maximum", () => {
    expect(permittedAccessGrantRoles("editor")).toEqual([
      "editor",
      "contributor",
      "viewer",
    ])
    expect(permittedAccessGrantRoles("viewer")).toEqual(["viewer"])
  })
})
