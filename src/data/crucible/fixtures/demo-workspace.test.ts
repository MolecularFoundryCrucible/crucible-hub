import { describe, expect, it } from "vitest"

import { demoWorkspace } from "./demo-workspace"

describe("demoWorkspace", () => {
  it("keeps project and instrument references coherent", () => {
    const projectIds = new Set(
      demoWorkspace.projects.map((project) => project.project_id)
    )
    const instrumentMfids = new Set(
      demoWorkspace.instruments.map((instrument) => instrument.unique_id)
    )

    for (const sample of demoWorkspace.samples) {
      expect(projectIds.has(sample.project_id)).toBe(true)
    }

    for (const dataset of demoWorkspace.datasets) {
      expect(projectIds.has(dataset.project_id)).toBe(true)
      if ("instrument" in dataset && dataset.instrument) {
        expect(instrumentMfids.has(dataset.instrument.unique_id)).toBe(true)
      }
    }
  })

  it("keeps sample and file dataset references coherent", () => {
    const datasetMfids = new Set(
      demoWorkspace.datasets.map((dataset) => dataset.unique_id)
    )

    for (const sample of demoWorkspace.samples) {
      for (const dataset of sample.datasets) {
        expect(datasetMfids.has(dataset.unique_id)).toBe(true)
      }
    }

    for (const file of demoWorkspace.files) {
      expect(datasetMfids.has(file.dataset_mfid)).toBe(true)
    }
  })

  it("keeps immediate resource links resolvable", () => {
    const resourceMfids = new Set(
      [
        ...demoWorkspace.datasets,
        ...demoWorkspace.instruments,
        ...demoWorkspace.projects,
        ...demoWorkspace.samples,
      ].map((resource) => resource.unique_id)
    )

    for (const resource of [
      ...demoWorkspace.datasets,
      ...demoWorkspace.samples,
    ]) {
      for (const link of resource.links) {
        expect(resourceMfids.has(link.unique_id)).toBe(true)
      }
    }
  })
})
