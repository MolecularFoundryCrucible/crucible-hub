import { describe, expect, it } from "vitest"

import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { timestampToLocalInput } from "@/lib/format"

import {
  datasetSummaryChanges,
  mergeDatasetSummaryUpdate,
  mergeSampleSummaryUpdate,
  sampleSummaryChanges,
} from "./resource-summary-form"

const sample: Extract<WorkspaceResourceDetail, { kind: "sample" }> = {
  capabilities: {
    can_change_status: false,
    can_delete: false,
    can_request_deletion: false,
    can_edit: true,
    can_manage_access: false,
    can_transfer: false,
    max_grant_role: "editor",
  },
  creation_time: "2026-09-01T12:00:00Z",
  description: "Initial description",
  kind: "sample",
  links: [],
  modification_time: "2026-09-02T12:00:00Z",
  name: "Initial sample",
  owner: null,
  project: null,
  project_id: null,
  public: false,
  sample_type: "catalyst",
  scientific_metadata: null,
  timestamp: null,
  unique_id: "sample-mfid",
}

const dataset: Extract<WorkspaceResourceDetail, { kind: "dataset" }> = {
  capabilities: {
    can_change_status: false,
    can_delete: false,
    can_request_deletion: false,
    can_edit: true,
    can_manage_access: false,
    can_transfer: false,
    max_grant_role: "editor",
  },
  creation_time: "2026-09-01T12:00:00Z",
  data_format: "HDF5",
  data_type: "spectrum series",
  instrument: {
    instrument_id: "xray-microprobe",
    instrument_name: "X-ray Microprobe",
    unique_id: "instrument-mfid",
  },
  instrument_id: "xray-microprobe",
  kind: "dataset",
  links: [
    {
      name: "Initial sample",
      relationship: "associated",
      resource_type: "sample",
      unique_id: "sample-mfid",
    },
  ],
  measurement: "X-ray absorption spectroscopy",
  modification_time: "2026-09-02T12:00:00Z",
  name: "Initial dataset",
  owner: {
    first_name: "Avery",
    is_service_account: false,
    last_name: "Chen",
    unique_id: "owner-mfid",
    username: "avery.chen",
  },
  project: {
    project_id: "catalyst-mapping",
    title: "Catalyst Mapping",
    unique_id: "project-mfid",
  },
  project_id: "catalyst-mapping",
  public: false,
  scientific_metadata: {
    acquisition: { edge: "K", scans: [1, 2, 3] },
  },
  session_name: "operando-cycle-04",
  size: 284_917_312,
  timestamp: "2026-09-01T11:30:00Z",
  unique_id: "dataset-mfid",
}

describe("resource summary editing", () => {
  it("submits only normalized changed sample fields", () => {
    expect(
      sampleSummaryChanges(sample, {
        description: "  Updated description  ",
        sample_name: "Initial sample",
        sample_type: "   ",
        timestamp: "",
      })
    ).toEqual({
      description: "Updated description",
      sample_type: null,
    })
  })

  it("leaves richer sample detail intact after a confirmed update", () => {
    expect(
      mergeSampleSummaryUpdate(sample, {
        description: null,
        modification_time: "2026-09-05T12:00:00Z",
        sample_name: "Updated sample",
        sample_type: null,
        timestamp: "2026-09-05T11:00:00Z",
        unique_id: "sample-mfid",
      })
    ).toEqual({
      ...sample,
      description: null,
      modification_time: "2026-09-05T12:00:00Z",
      name: "Updated sample",
      sample_type: null,
      timestamp: "2026-09-05T11:00:00Z",
    })
  })

  it("submits only normalized changed dataset fields", () => {
    expect(
      datasetSummaryChanges(dataset, {
        data_format: " HDF5 ",
        data_type: " spectrum series ",
        dataset_name: " Updated dataset ",
        measurement: " Updated measurement ",
        session_name: " operando-cycle-04 ",
        timestamp: timestampToLocalInput(dataset.timestamp),
      })
    ).toEqual({
      dataset_name: "Updated dataset",
      measurement: "Updated measurement",
    })
  })

  it("normalizes empty optional dataset fields to null", () => {
    expect(
      datasetSummaryChanges(dataset, {
        data_format: " ",
        data_type: " ",
        dataset_name: "Initial dataset",
        measurement: " ",
        session_name: " ",
        timestamp: timestampToLocalInput(dataset.timestamp),
      })
    ).toEqual({
      data_format: null,
      data_type: null,
      measurement: null,
      session_name: null,
    })
  })

  it("leaves richer dataset detail intact after a confirmed update", () => {
    expect(
      mergeDatasetSummaryUpdate(dataset, {
        data_format: "NeXus",
        data_type: null,
        dataset_name: "Updated dataset",
        measurement: "Updated measurement",
        modification_time: "2026-09-05T12:00:00Z",
        session_name: null,
        timestamp: "2026-09-05T11:00:00Z",
        unique_id: "dataset-mfid",
      })
    ).toEqual({
      ...dataset,
      data_format: "NeXus",
      data_type: null,
      measurement: "Updated measurement",
      modification_time: "2026-09-05T12:00:00Z",
      name: "Updated dataset",
      session_name: null,
      timestamp: "2026-09-05T11:00:00Z",
    })
  })

  it("converts changed local timestamps to UTC", () => {
    const localValue = timestampToLocalInput("2026-09-06T01:02:03.000Z")
    expect(
      datasetSummaryChanges(dataset, {
        data_format: dataset.data_format ?? "",
        data_type: dataset.data_type ?? "",
        dataset_name: dataset.name,
        measurement: dataset.measurement ?? "",
        session_name: dataset.session_name ?? "",
        timestamp: localValue,
      })
    ).toEqual({ timestamp: "2026-09-06T01:02:03.000Z" })
  })

  it("preserves a nonstandard timestamp when another field changes", () => {
    const legacy = { ...sample, timestamp: "beamtime cycle 4" }
    expect(
      sampleSummaryChanges(legacy, {
        description: legacy.description ?? "",
        sample_name: "Updated sample",
        sample_type: legacy.sample_type ?? "",
        timestamp: "",
      })
    ).toEqual({ sample_name: "Updated sample" })
  })
})
