import { describe, expect, it } from "vitest"

import {
  DATASET_DATA_FORMAT_MAX_LENGTH,
  DATASET_DATA_TYPE_MAX_LENGTH,
  DATASET_MEASUREMENT_MAX_LENGTH,
  DATASET_NAME_MAX_LENGTH,
  DATASET_SESSION_NAME_MAX_LENGTH,
  resourceScientificMetadataUpdateInputSchema,
  datasetDescriptiveUpdateInputSchema,
  datasetFilesInputSchema,
  fileDownloadInputSchema,
  resourceMfidInputSchema,
  workspaceRelationshipOperationInputSchema,
  SAMPLE_DESCRIPTION_MAX_LENGTH,
  SAMPLE_NAME_MAX_LENGTH,
  SAMPLE_TYPE_MAX_LENGTH,
  SCIENTIFIC_METADATA_KEY_MAX_LENGTH,
  SCIENTIFIC_METADATA_MAX_DEPTH,
  SCIENTIFIC_METADATA_MAX_FIELDS,
  SCIENTIFIC_METADATA_MAX_SERIALIZED_BYTES,
  sampleDescriptiveUpdateInputSchema,
} from "./resources.functions"

describe("resource server function input", () => {
  it("accepts bounded canonical identifiers", () => {
    expect(
      resourceMfidInputSchema.parse({ resourceMfid: "resource-mfid" })
    ).toEqual({ resourceMfid: "resource-mfid" })
    expect(
      datasetFilesInputSchema.parse({ datasetMfid: "dataset-mfid" })
    ).toEqual({ datasetMfid: "dataset-mfid" })
    expect(
      fileDownloadInputSchema.parse({
        fileMfid: " file-mfid ",
        scenario: "dense",
      })
    ).toEqual({ fileMfid: "file-mfid", scenario: "dense" })
  })

  it("rejects empty and oversized identifiers", () => {
    expect(() => resourceMfidInputSchema.parse({ resourceMfid: " " })).toThrow()
    expect(() =>
      datasetFilesInputSchema.parse({ datasetMfid: "x".repeat(256) })
    ).toThrow()
    expect(() => fileDownloadInputSchema.parse({ fileMfid: " " })).toThrow()
    expect(() =>
      fileDownloadInputSchema.parse({ fileMfid: "file/mfid" })
    ).toThrow()
    expect(() =>
      fileDownloadInputSchema.parse({ fileMfid: "x".repeat(256) })
    ).toThrow()
    expect(() =>
      fileDownloadInputSchema.parse({
        fileMfid: "file-mfid",
        scenario: "unknown",
      })
    ).toThrow()
    expect(() =>
      fileDownloadInputSchema.parse({ fileMfid: "file-mfid", extra: true })
    ).toThrow()
  })

  it("normalizes bounded sample descriptive changes", () => {
    expect(
      sampleDescriptiveUpdateInputSchema.parse({
        changes: {
          description: " Updated description ",
          sample_name: " Updated sample ",
          sample_type: " catalyst ",
          timestamp: "2026-09-01T11:30:00Z",
        },
        resourceMfid: " sample-mfid ",
        scenario: "dense",
      })
    ).toEqual({
      changes: {
        description: "Updated description",
        sample_name: "Updated sample",
        sample_type: "catalyst",
        timestamp: "2026-09-01T11:30:00Z",
      },
      resourceMfid: "sample-mfid",
      scenario: "dense",
    })
    expect(
      sampleDescriptiveUpdateInputSchema.parse({
        changes: { description: null, sample_type: null },
        resourceMfid: "sample-mfid",
      })
    ).toEqual({
      changes: { description: null, sample_type: null },
      resourceMfid: "sample-mfid",
    })
  })

  it.each([
    { changes: {}, resourceMfid: "sample-mfid" },
    { changes: { sample_name: undefined }, resourceMfid: "sample-mfid" },
    { changes: { sample_name: " " }, resourceMfid: "sample-mfid" },
    { changes: { sample_name: null }, resourceMfid: "sample-mfid" },
    { changes: { sample_type: " " }, resourceMfid: "sample-mfid" },
    { changes: { timestamp: "2026-09-01" }, resourceMfid: "sample-mfid" },
    { changes: { description: " " }, resourceMfid: "sample-mfid" },
    { changes: { extra: "value" }, resourceMfid: "sample-mfid" },
    { changes: { description: "x" }, resourceMfid: "sample/mfid" },
    {
      changes: { sample_name: "x".repeat(SAMPLE_NAME_MAX_LENGTH + 1) },
      resourceMfid: "sample-mfid",
    },
    {
      changes: { sample_type: "x".repeat(SAMPLE_TYPE_MAX_LENGTH + 1) },
      resourceMfid: "sample-mfid",
    },
    {
      changes: { description: "x".repeat(SAMPLE_DESCRIPTION_MAX_LENGTH + 1) },
      resourceMfid: "sample-mfid",
    },
    {
      changes: { description: null },
      extra: true,
      resourceMfid: "sample-mfid",
    },
    {
      changes: { description: null },
      resourceMfid: "sample-mfid",
      scenario: "unknown",
    },
  ])("rejects invalid or no-op sample changes %#", (input) => {
    expect(() => sampleDescriptiveUpdateInputSchema.parse(input)).toThrow()
  })

  it("normalizes bounded dataset descriptive changes", () => {
    expect(
      datasetDescriptiveUpdateInputSchema.parse({
        changes: {
          data_format: " HDF5 ",
          data_type: " spectrum series ",
          dataset_name: " Updated dataset ",
          measurement: " X-ray absorption spectroscopy ",
          session_name: null,
          timestamp: "2026-09-01T11:30:00+00:00",
        },
        resourceMfid: " dataset-mfid ",
        scenario: "dense",
      })
    ).toEqual({
      changes: {
        data_format: "HDF5",
        data_type: "spectrum series",
        dataset_name: "Updated dataset",
        measurement: "X-ray absorption spectroscopy",
        session_name: null,
        timestamp: "2026-09-01T11:30:00+00:00",
      },
      resourceMfid: "dataset-mfid",
      scenario: "dense",
    })
  })

  it.each([
    { changes: {}, resourceMfid: "dataset-mfid" },
    { changes: { dataset_name: undefined }, resourceMfid: "dataset-mfid" },
    { changes: { dataset_name: " " }, resourceMfid: "dataset-mfid" },
    { changes: { dataset_name: null }, resourceMfid: "dataset-mfid" },
    { changes: { measurement: " " }, resourceMfid: "dataset-mfid" },
    { changes: { public: true }, resourceMfid: "dataset-mfid" },
    { changes: { timestamp: "2026-09-01" }, resourceMfid: "dataset-mfid" },
    { changes: { instrument_id: null }, resourceMfid: "dataset-mfid" },
    {
      changes: { dataset_name: "x".repeat(DATASET_NAME_MAX_LENGTH + 1) },
      resourceMfid: "dataset-mfid",
    },
    {
      changes: {
        measurement: "x".repeat(DATASET_MEASUREMENT_MAX_LENGTH + 1),
      },
      resourceMfid: "dataset-mfid",
    },
    {
      changes: { data_format: "x".repeat(DATASET_DATA_FORMAT_MAX_LENGTH + 1) },
      resourceMfid: "dataset-mfid",
    },
    {
      changes: { data_type: "x".repeat(DATASET_DATA_TYPE_MAX_LENGTH + 1) },
      resourceMfid: "dataset-mfid",
    },
    {
      changes: {
        session_name: "x".repeat(DATASET_SESSION_NAME_MAX_LENGTH + 1),
      },
      resourceMfid: "dataset-mfid",
    },
    { changes: { data_type: null }, resourceMfid: "dataset/mfid" },
    {
      changes: { data_type: null },
      resourceMfid: "dataset-mfid",
      scenario: "unknown",
    },
  ])("rejects invalid or no-op dataset changes %#", (input) => {
    expect(() => datasetDescriptiveUpdateInputSchema.parse(input)).toThrow()
  })

  it("accepts merge and empty replacement metadata writes", () => {
    expect(
      resourceScientificMetadataUpdateInputSchema.parse({
        resourceKind: "sample",
        resourceMfid: " sample-mfid ",
        update: {
          kind: "merge",
          metadata: { preparation: { temperature_k: 298 } },
        },
        scenario: "dense",
      })
    ).toEqual({
      resourceKind: "sample",
      resourceMfid: "sample-mfid",
      update: {
        kind: "merge",
        metadata: { preparation: { temperature_k: 298 } },
      },
      scenario: "dense",
    })
    expect(
      resourceScientificMetadataUpdateInputSchema.parse({
        resourceKind: "dataset",
        resourceMfid: "dataset-mfid",
        update: { kind: "replace", metadata: {} },
      })
    ).toMatchObject({ update: { kind: "replace", metadata: {} } })
  })

  it.each([
    {
      label: "empty merge",
      metadata: { kind: "merge", metadata: {} },
    },
    {
      label: "blank key",
      metadata: { kind: "replace", metadata: { "  ": true } },
    },
    {
      label: "oversized key",
      metadata: {
        kind: "replace",
        metadata: {
          ["x".repeat(SCIENTIFIC_METADATA_KEY_MAX_LENGTH + 1)]: true,
        },
      },
    },
    {
      label: "non-finite number",
      metadata: {
        kind: "replace",
        metadata: { value: Number.POSITIVE_INFINITY },
      },
    },
    {
      label: "non-JSON value",
      metadata: { kind: "replace", metadata: { value: undefined } },
    },
    {
      label: "too many fields",
      metadata: {
        kind: "replace",
        metadata: Object.fromEntries(
          Array.from({ length: SCIENTIFIC_METADATA_MAX_FIELDS + 1 }, (_, i) => [
            `field-${i}`,
            i,
          ])
        ),
      },
    },
    {
      label: "oversized serialized payload",
      metadata: {
        kind: "replace",
        metadata: {
          value: "x".repeat(SCIENTIFIC_METADATA_MAX_SERIALIZED_BYTES),
        },
      },
    },
  ])("rejects unsafe scientific metadata: $label", ({ metadata }) => {
    expect(() =>
      resourceScientificMetadataUpdateInputSchema.parse({
        resourceKind: "dataset",
        resourceMfid: "dataset-mfid",
        update: metadata,
      })
    ).toThrow()
  })

  it("rejects scientific metadata beyond the maximum nesting depth", () => {
    let metadata: Record<string, unknown> = { leaf: true }
    for (let depth = 0; depth <= SCIENTIFIC_METADATA_MAX_DEPTH; depth += 1) {
      metadata = { nested: metadata }
    }

    expect(() =>
      resourceScientificMetadataUpdateInputSchema.parse({
        resourceKind: "sample",
        resourceMfid: "sample-mfid",
        update: { kind: "replace", metadata },
      })
    ).toThrow()
  })

  it("rejects invalid resource metadata write envelopes", () => {
    expect(() =>
      resourceScientificMetadataUpdateInputSchema.parse({
        resourceKind: "instrument",
        resourceMfid: "sample-mfid",
        update: { kind: "replace", metadata: {} },
      })
    ).toThrow()
    expect(() =>
      resourceScientificMetadataUpdateInputSchema.parse({
        resourceKind: "sample",
        resourceMfid: "sample/mfid",
        update: { kind: "replace", metadata: {} },
      })
    ).toThrow()
    expect(() =>
      resourceScientificMetadataUpdateInputSchema.parse({
        resourceKind: "sample",
        resourceMfid: "sample-mfid",
        update: { kind: "replace", metadata: {}, extra: true },
      })
    ).toThrow()
  })

  it("accepts normalized relationship operations", () => {
    expect(
      workspaceRelationshipOperationInputSchema.parse({
        action: "link",
        relationship: "parent",
        scenario: "dense",
        sourceKind: "sample",
        sourceMfid: " sample-child ",
        targetKind: "sample",
        targetMfid: " sample-parent ",
      })
    ).toEqual({
      action: "link",
      relationship: "parent",
      scenario: "dense",
      sourceKind: "sample",
      sourceMfid: "sample-child",
      targetKind: "sample",
      targetMfid: "sample-parent",
    })
    expect(
      workspaceRelationshipOperationInputSchema.safeParse({
        action: "unlink",
        relationship: "associated",
        sourceKind: "dataset",
        sourceMfid: "dataset-1",
        targetKind: "sample",
        targetMfid: "sample-1",
      }).success
    ).toBe(true)
  })

  it.each([
    {
      action: "link",
      relationship: "associated",
      sourceKind: "sample",
      sourceMfid: "sample-1",
      targetKind: "sample",
      targetMfid: "sample-2",
    },
    {
      action: "link",
      relationship: "parent",
      sourceKind: "sample",
      sourceMfid: "sample-1",
      targetKind: "dataset",
      targetMfid: "dataset-1",
    },
    {
      action: "link",
      relationship: "child",
      sourceKind: "dataset",
      sourceMfid: "dataset-1",
      targetKind: "sample",
      targetMfid: "sample-1",
    },
    {
      action: "link",
      relationship: "parent",
      sourceKind: "sample",
      sourceMfid: "same-resource",
      targetKind: "sample",
      targetMfid: "same-resource",
    },
    {
      action: "link",
      relationship: "parent",
      sourceKind: "sample",
      sourceMfid: "sample-1",
      targetKind: "sample",
      targetMfid: "sample/2",
      extra: true,
    },
  ])("rejects invalid relationship operations %#", (input) => {
    expect(() =>
      workspaceRelationshipOperationInputSchema.parse(input)
    ).toThrow()
  })
})
