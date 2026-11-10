import { describe, expect, it } from "vitest"

import { projectSyncSummary } from "./sync-projects-button"

const base = {
  orcid: "0000-0002-1825-0097",
  projectsAdded: [],
  projectsAlreadyMember: [],
  projectsNotFound: [],
}

describe("projectSyncSummary", () => {
  it("names the projects it added and counts proposals without one", () => {
    expect(
      projectSyncSummary({
        ...base,
        projectsAdded: ["10234", "10301"],
        projectsNotFound: ["9999"],
      })
    ).toEqual({
      title: "Added to 2 projects",
      description: "10234, 10301. 1 proposal has no Crucible project yet.",
    })
  })

  it("says when nothing new turned up", () => {
    expect(
      projectSyncSummary({ ...base, projectsAlreadyMember: ["10234"] })
    ).toEqual({
      title: "No new projects",
      description: "You're already in every project from your proposals.",
    })
  })

  it("asks for an ORCID when the account has none", () => {
    expect(projectSyncSummary({ ...base, orcid: null }).title).toBe(
      "No ORCID to look up"
    )
  })
})
