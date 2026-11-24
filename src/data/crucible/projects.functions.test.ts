import { describe, expect, it } from "vitest"

import {
  addProjectMemberInputSchema,
  projectDescriptiveUpdateInputSchema,
  updateProjectMemberRoleInputSchema,
} from "./projects.functions"

describe("project server-function inputs", () => {
  it("rejects no-op and lifecycle project changes", () => {
    expect(() =>
      projectDescriptiveUpdateInputSchema.parse({
        changes: {},
        projectMfid: "project-mfid",
      })
    ).toThrow()
    expect(() =>
      projectDescriptiveUpdateInputSchema.parse({
        changes: { status: "archived" },
        projectMfid: "project-mfid",
      })
    ).toThrow()
  })

  it("normalizes membership inputs and excludes owner grants", () => {
    expect(
      addProjectMemberInputSchema.parse({
        projectMfid: " project-mfid ",
        role: "editor",
        scenario: "dense",
        userId: " user-123 ",
      })
    ).toEqual({
      projectMfid: "project-mfid",
      role: "editor",
      scenario: "dense",
      userId: "user-123",
    })
    expect(
      addProjectMemberInputSchema.safeParse({
        projectMfid: "project-mfid",
        role: "owner",
        userId: "user-123",
      }).success
    ).toBe(false)
    expect(
      updateProjectMemberRoleInputSchema.safeParse({
        projectMfid: "project-mfid",
        role: "owner",
        userId: "user-123",
      }).success
    ).toBe(false)
  })
})
