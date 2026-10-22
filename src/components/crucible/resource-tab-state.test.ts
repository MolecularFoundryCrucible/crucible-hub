import { describe, expect, it } from "vitest"

import { pendingSections } from "./resource-tab-state"

const labels = (sections: { label: string }[]) =>
  sections.map((section) => section.label)

describe("pendingSections", () => {
  it("includes Manage wherever the loaded tabs always show it", () => {
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
  })

  it("includes Manage on projects only when it is the active tab", () => {
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
