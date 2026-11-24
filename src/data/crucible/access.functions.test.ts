import { describe, expect, it } from "vitest"

import {
  revokeResourceAccessGrantInputSchema,
  setResourceAccessGrantInputSchema,
} from "./access.functions"

describe("resource access server function input", () => {
  it("normalizes documented resource access mutations and rejects owner grants", () => {
    expect(
      setResourceAccessGrantInputSchema.parse({
        kind: "users",
        permission: "editor",
        principal: " user-1 ",
        resourceMfid: " resource-1 ",
        scenario: "dense",
      })
    ).toEqual({
      kind: "users",
      permission: "editor",
      principal: "user-1",
      resourceMfid: "resource-1",
      scenario: "dense",
    })
    expect(
      revokeResourceAccessGrantInputSchema.parse({
        kind: "projects",
        principal: "project-1",
        resourceMfid: "resource-1",
      })
    ).toEqual({
      kind: "projects",
      principal: "project-1",
      resourceMfid: "resource-1",
    })
    expect(() =>
      setResourceAccessGrantInputSchema.parse({
        kind: "users",
        permission: "owner",
        principal: "principal-1",
        resourceMfid: "resource-1",
      })
    ).toThrow()
  })
})
