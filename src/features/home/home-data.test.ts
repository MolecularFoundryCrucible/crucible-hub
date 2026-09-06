import { describe, expect, it } from "vitest"

import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"

import { selectRecentResources } from "./home-data"

describe("Home recent resources", () => {
  it("selects the newest resources across samples and datasets", () => {
    const samples = [
      { ...demoWorkspace.samples[0], unique_id: "0003" },
      { ...demoWorkspace.samples[1], unique_id: "0001" },
    ]
    const datasets = [
      { ...demoWorkspace.datasets[0], unique_id: "0004" },
      { ...demoWorkspace.datasets[1], unique_id: "0002" },
    ]

    expect(selectRecentResources(samples, datasets, 3)).toMatchObject([
      { kind: "dataset", resource: { unique_id: "0004" } },
      { kind: "sample", resource: { unique_id: "0003" } },
      { kind: "dataset", resource: { unique_id: "0002" } },
    ])
  })

  it("does not mutate the source collections", () => {
    const samples = [...demoWorkspace.samples]
    const datasets = [...demoWorkspace.datasets]
    const sampleOrder = samples.map((resource) => resource.unique_id)
    const datasetOrder = datasets.map((resource) => resource.unique_id)

    selectRecentResources(samples, datasets, 3)

    expect(samples.map((resource) => resource.unique_id)).toEqual(sampleOrder)
    expect(datasets.map((resource) => resource.unique_id)).toEqual(datasetOrder)
  })
})
