import { describe, expect, it } from "vitest"

import { pendingSections } from "./resource-tab-state"

const labels = (sections: { label: string }[]) =>
  sections.map((section) => section.label)

describe("pendingSections", () => {
  it("includes Manage wherever the loaded tabs show it, and on projects only when active", () => {
    expect(labels(pendingSections("dataset", "overview"))).toEqual([
      "Overview",
      "Processing",
      "Graph",
      "Manage",
    ])
    expect(labels(pendingSections("sample", "graph"))).toEqual([
      "Overview",
      "Graph",
      "Manage",
    ])
    expect(labels(pendingSections("project", "data"))).toEqual([
      "Data",
      "Overview",
    ])
    expect(labels(pendingSections("project", "manage"))).toEqual([
      "Data",
      "Overview",
      "Manage",
    ])
  })
})
