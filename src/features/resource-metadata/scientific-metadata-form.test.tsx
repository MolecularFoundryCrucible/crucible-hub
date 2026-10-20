import { describe, expect, it } from "vitest"

import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

import {
  mergeScientificMetadataUpdate,
  prettyScientificMetadata,
  scientificMetadataWrite,
} from "./scientific-metadata-form"
import { parseScientificMetadata } from "./scientific-metadata-parse"

const sample: Extract<WorkspaceResourceDetail, { kind: "sample" }> = {
  capabilities: null,
  creation_time: null,
  description: null,
  kind: "sample",
  links: [],
  modification_time: null,
  name: "Metadata sample",
  owner: null,
  project: null,
  project_id: null,
  public: false,
  sample_type: null,
  scientific_metadata: {
    acquisition: { scans: [1, 2], technique: "XAS" },
    complete: false,
    temperature_k: 298.15,
  },
  timestamp: null,
  unique_id: "sample-mfid",
}

describe("scientific metadata editor", () => {
  it("pretty prints a metadata object and accepts its JSON representation", () => {
    const text = prettyScientificMetadata(sample.scientific_metadata)

    expect(text).toBe(`{
  "acquisition": {
    "scans": [
      1,
      2
    ],
    "technique": "XAS"
  },
  "complete": false,
  "temperature_k": 298.15
}`)
    expect(parseScientificMetadata(text)).toEqual({
      metadata: sample.scientific_metadata,
      ok: true,
    })
  })

  it("rejects invalid JSON, non-object roots, and non-finite values", () => {
    expect(parseScientificMetadata("not json")).toEqual({
      message: "Enter valid JSON.",
      ok: false,
    })
    expect(parseScientificMetadata('["not", "an", "object"]')).toEqual({
      message:
        "Scientific metadata must be a JSON object with finite JSON values.",
      ok: false,
    })
    expect(parseScientificMetadata('{"value": 1e400}')).toEqual({
      message:
        "Scientific metadata must be a JSON object with finite JSON values.",
      ok: false,
    })
    expect(parseScientificMetadata('{"  ": true}')).toEqual({
      message: "Metadata keys must not be blank.",
      ok: false,
    })
  })

  it("does not create a write for semantic no-op changes", () => {
    expect(
      scientificMetadataWrite(sample.scientific_metadata, {
        acquisition: { scans: [1, 2], technique: "XAS" },
        complete: false,
        temperature_k: 298.15,
      })
    ).toBeNull()
  })

  it("merges only added or replaced top-level fields", () => {
    expect(
      scientificMetadataWrite(sample.scientific_metadata, {
        acquisition: { scans: [1, 2, 3], technique: "XAS" },
        complete: true,
        temperature_k: 298.15,
        workflow: null,
      })
    ).toEqual({
      kind: "merge",
      metadata: {
        acquisition: { scans: [1, 2, 3], technique: "XAS" },
        complete: true,
        workflow: null,
      },
    })
  })

  it("replaces the complete metadata object when a top-level field is removed", () => {
    expect(
      scientificMetadataWrite(sample.scientific_metadata, {
        complete: false,
        temperature_k: 298.15,
      })
    ).toEqual({
      kind: "replace",
      metadata: {
        complete: false,
        temperature_k: 298.15,
      },
    })
  })

  it("replaces the complete metadata object when it is cleared", () => {
    expect(scientificMetadataWrite(sample.scientific_metadata, {})).toEqual({
      kind: "replace",
      metadata: {},
    })
  })

  it("updates only scientific metadata on rich resource detail", () => {
    expect(
      mergeScientificMetadataUpdate(sample, {
        acquisition: { scans: [3], technique: "XAS" },
      })
    ).toEqual({
      ...sample,
      scientific_metadata: {
        acquisition: { scans: [3], technique: "XAS" },
      },
    })
  })
})
