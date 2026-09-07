import { describe, expect, it } from "vitest"

import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

import { mergeInstrumentLifecycleUpdate } from "./instrument-lifecycle-card"

const instrument = {
  capabilities: demoWorkspace.instruments[0].capabilities,
  creation_time: demoWorkspace.instruments[0].creation_time,
  description: demoWorkspace.instruments[0].description,
  instrument_id: demoWorkspace.instruments[0].instrument_id,
  instrument_type: demoWorkspace.instruments[0].instrument_type,
  kind: "instrument",
  location: demoWorkspace.instruments[0].location,
  manufacturer: demoWorkspace.instruments[0].manufacturer,
  model: demoWorkspace.instruments[0].model,
  modification_time: demoWorkspace.instruments[0].modification_time,
  name: demoWorkspace.instruments[0].instrument_name,
  other_id: null,
  other_id_source: null,
  owner: demoWorkspace.instruments[0].owner,
  scientific_metadata: demoWorkspace.instruments[0].scientific_metadata,
  status: demoWorkspace.instruments[0].status,
  unique_id: demoWorkspace.instruments[0].unique_id,
} satisfies WorkspaceResourceDetail

describe("instrument lifecycle cache merge", () => {
  it("changes only server-confirmed lifecycle fields", () => {
    expect(
      mergeInstrumentLifecycleUpdate(instrument, {
        modification_time: "2026-09-06T18:00:00Z",
        status: "maintenance",
        unique_id: instrument.unique_id,
      })
    ).toEqual({
      ...instrument,
      modification_time: "2026-09-06T18:00:00Z",
      status: "maintenance",
    })
  })

  it("does not merge lifecycle fields into another resource kind", () => {
    const sample = {
      ...instrument,
      description: null,
      kind: "sample",
      links: [],
      project: null,
      project_id: null,
      public: false,
      sample_type: null,
      timestamp: null,
    } as unknown as WorkspaceResourceDetail

    expect(
      mergeInstrumentLifecycleUpdate(sample, {
        modification_time: null,
        status: "decommissioned",
        unique_id: instrument.unique_id,
      })
    ).toBe(sample)
  })
})
