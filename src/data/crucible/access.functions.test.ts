import { describe, expect, it } from "vitest"

import {
  RESOURCE_ACCESS_MFID_MAX_LENGTH,
  resourceAccessInputSchema,
  revokeResourceAccessGrantInputSchema,
  setResourceAccessGrantInputSchema,
} from "./access.functions"

describe("resource access server function input", () => {
  it("normalizes documented resource access mutations", () => {
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
  })

  it.each([
    { resourceMfid: " " },
    { resourceMfid: "resource/mfid" },
    { resourceMfid: "x".repeat(RESOURCE_ACCESS_MFID_MAX_LENGTH + 1) },
    { resourceMfid: "resource-1", extra: true },
  ])("rejects invalid access reads %#", (input) => {
    expect(() => resourceAccessInputSchema.parse(input)).toThrow()
  })

  it.each([
    {
      kind: "service_accounts",
      permission: "viewer",
      principal: "principal-1",
      resourceMfid: "resource-1",
    },
    {
      kind: "users",
      permission: "owner",
      principal: "principal-1",
      resourceMfid: "resource-1",
    },
    {
      kind: "projects",
      permission: "viewer",
      principal: "principal/1",
      resourceMfid: "resource-1",
    },
    {
      kind: "users",
      principal: "principal-1",
      resourceMfid: "resource-1",
      extra: true,
    },
  ])("rejects unsupported access mutations %#", (input) => {
    expect(() => setResourceAccessGrantInputSchema.parse(input)).toThrow()
  })
})
