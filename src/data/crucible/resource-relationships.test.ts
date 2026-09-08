import { describe, expect, it } from "vitest"

import { workspaceApiRelationshipOperation } from "./resource-relationships"

describe("workspace relationship API operation", () => {
  it.each([
    {
      operation: {
        action: "link",
        relationship: "parent",
        relationshipType: "is_derived_from",
        sourceKind: "sample",
        sourceMfid: "sample-child",
        targetKind: "sample",
        targetMfid: "sample-parent",
      } as const,
      expected: {
        kind: "sample-lineage",
        parentMfid: "sample-parent",
        childMfid: "sample-child",
        relationshipType: "is_derived_from",
      },
    },
    {
      operation: {
        action: "unlink",
        relationship: "child",
        sourceKind: "dataset",
        sourceMfid: "dataset-parent",
        targetKind: "dataset",
        targetMfid: "dataset-child",
      } as const,
      expected: {
        kind: "dataset-lineage",
        parentMfid: "dataset-parent",
        childMfid: "dataset-child",
        relationshipType: null,
      },
    },
    {
      operation: {
        action: "link",
        relationship: "associated",
        sourceKind: "sample",
        sourceMfid: "sample-1",
        targetKind: "dataset",
        targetMfid: "dataset-1",
      } as const,
      expected: {
        kind: "dataset-sample",
        datasetMfid: "dataset-1",
        sampleMfid: "sample-1",
      },
    },
  ])(
    "normalizes $operation.relationship relationships",
    ({ operation, expected }) => {
      expect(workspaceApiRelationshipOperation(operation)).toEqual(expected)
    }
  )
})
