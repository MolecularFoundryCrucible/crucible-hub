import { describe, expect, it } from "vitest"

import {
  resourceScientificMetadataUpdateInputSchema,
  datasetFilesInputSchema,
  fileDownloadInputSchema,
  resourceMfidInputSchema,
  workspaceRelationshipOperationInputSchema,
  SCIENTIFIC_METADATA_MAX_DEPTH,
} from "./resources.functions"

describe("resource server function input", () => {
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
        resourceKind: "file",
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
      sourceMfid: "same-resource",
      targetKind: "sample",
      targetMfid: "same-resource",
    },
  ])("rejects invalid relationship operations %#", (input) => {
    expect(() =>
      workspaceRelationshipOperationInputSchema.parse(input)
    ).toThrow()
  })
})
