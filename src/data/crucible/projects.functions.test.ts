import { describe, expect, it } from "vitest"

import {
  addProjectMemberInputSchema,
  projectDetailInputSchema,
  projectListInputSchema,
  projectDescriptiveUpdateInputSchema,
  removeProjectMemberInputSchema,
  updateProjectMemberRoleInputSchema,
} from "./projects.functions"

describe("project server-function inputs", () => {
  it("accepts bounded cursor pagination and query parameters", () => {
    expect(
      projectListInputSchema.parse({
        activeSince: "2026-08-01",
        direction: "asc",
        limit: 20,
        memberRef: "user-123",
        memberRole: "viewer",
        sort: "title",
      })
    ).toEqual({
      activeSince: "2026-08-01",
      direction: "asc",
      limit: 20,
      memberRef: "user-123",
      memberRole: "viewer",
      sort: "title",
    })
  })

  it("rejects invalid project sort, role, or activeSince filters", () => {
    expect(
      projectListInputSchema.safeParse({ limit: 20, sort: "invalid" }).success
    ).toBe(false)
    expect(
      projectListInputSchema.safeParse({ limit: 20, memberRole: "invalid" })
        .success
    ).toBe(false)
    expect(
      projectListInputSchema.safeParse({
        activeSince: "2026-13-01",
        limit: 20,
      }).success
    ).toBe(false)
  })

  it("rejects malformed pagination", () => {
    expect(
      projectListInputSchema.safeParse({ cursor: "x".repeat(4097), limit: 101 })
        .success
    ).toBe(false)
  })

  it("rejects empty project identifiers", () => {
    expect(
      projectDetailInputSchema.safeParse({ projectMfid: " " }).success
    ).toBe(false)
  })

  it("accepts only non-empty descriptive project changes", () => {
    expect(
      projectDescriptiveUpdateInputSchema.parse({
        changes: {
          organization: " Example Lab ",
          project_id: " catalyst-mapping ",
          title: " Catalyst Mapping ",
        },
        projectMfid: " project-mfid ",
      })
    ).toEqual({
      changes: {
        organization: "Example Lab",
        project_id: "catalyst-mapping",
        title: "Catalyst Mapping",
      },
      projectMfid: "project-mfid",
    })
  })

  it("accepts an explicit null project title", () => {
    expect(
      projectDescriptiveUpdateInputSchema.parse({
        changes: { title: null },
        projectMfid: "project-mfid",
      })
    ).toEqual({
      changes: { title: null },
      projectMfid: "project-mfid",
    })
  })

  it.each([
    { changes: {}, projectMfid: "project-mfid" },
    { changes: { status: "archived" }, projectMfid: "project-mfid" },
    { changes: { title: " " }, projectMfid: "project-mfid" },
    { changes: { project_id: null }, projectMfid: "project-mfid" },
    { changes: { title: "x".repeat(256) }, projectMfid: "project-mfid" },
    { changes: { title: "Updated" }, projectMfid: " " },
  ])("rejects unsafe or no-op project changes %#", (input) => {
    expect(() => projectDescriptiveUpdateInputSchema.parse(input)).toThrow()
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
      updateProjectMemberRoleInputSchema.safeParse({
        projectMfid: "project-mfid",
        role: "owner",
        userId: "user-123",
      }).success
    ).toBe(false)
  })

  it.each([
    [{ projectMfid: "project-mfid", role: "owner", userId: "user-123" }],
    [{ projectMfid: "project/mfid", role: "viewer", userId: "user-123" }],
    [{ projectMfid: "project-mfid", role: "viewer", userId: "user/123" }],
    [{ projectMfid: "project-mfid", role: "viewer", userId: " " }],
    [
      {
        projectMfid: "project-mfid",
        role: "viewer",
        userId: "user-123",
        extra: true,
      },
    ],
  ])("rejects unsafe membership input %#", (input) => {
    expect(() => addProjectMemberInputSchema.parse(input)).toThrow()
  })

  it("validates removal input without accepting a role or extra fields", () => {
    expect(
      removeProjectMemberInputSchema.safeParse({
        projectMfid: "project-mfid",
        userId: "user-123",
      }).success
    ).toBe(true)
    expect(
      removeProjectMemberInputSchema.safeParse({
        projectMfid: "project-mfid",
        role: "viewer",
        userId: "user-123",
      }).success
    ).toBe(false)
  })
})
