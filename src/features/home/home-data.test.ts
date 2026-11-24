import { describe, expect, it } from "vitest"

import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"

import { homeRecentResourceFilters, selectRecentResources } from "./home-data"

describe("Home recent resources", () => {
  it("selects the newest resources across samples and datasets", () => {
    const samples = [
      {
        ...demoWorkspace.samples[0],
        creation_time: "2026-09-14T18:00:00Z",
        unique_id: "0001",
      },
      {
        ...demoWorkspace.samples[1],
        creation_time: "2026-09-12T18:00:00Z",
        unique_id: "0004",
      },
    ]
    const datasets = [
      {
        ...demoWorkspace.datasets[0],
        creation_time: "2026-09-15T18:00:00Z",
        unique_id: "0002",
      },
      {
        ...demoWorkspace.datasets[1],
        creation_time: "2026-09-13T18:00:00Z",
        unique_id: "0003",
      },
    ]

    expect(selectRecentResources(samples, datasets, 3)).toMatchObject([
      { kind: "dataset", resource: { unique_id: "0002" } },
      { kind: "sample", resource: { unique_id: "0001" } },
      { kind: "dataset", resource: { unique_id: "0003" } },
    ])
  })
})

describe("homeRecentResourceFilters", () => {
  it("shows only the viewer's own data for Mine", () => {
    expect(
      homeRecentResourceFilters({
        elevated: false,
        includePublicByDefault: true,
        recentScope: "mine",
      }).affiliation
    ).toBe("owner")
  })
})
