import type { WorkspaceRelationshipOperation } from "./workspace-source"

export type WorkspaceApiRelationshipOperation =
  | {
      childMfid: string
      kind: "sample-lineage"
      parentMfid: string
    }
  | {
      childMfid: string
      kind: "dataset-lineage"
      parentMfid: string
    }
  | {
      datasetMfid: string
      kind: "dataset-sample"
      sampleMfid: string
    }

export function workspaceApiRelationshipOperation(
  operation: WorkspaceRelationshipOperation
): WorkspaceApiRelationshipOperation {
  if (operation.relationship === "associated") {
    return operation.sourceKind === "dataset"
      ? {
          kind: "dataset-sample",
          datasetMfid: operation.sourceMfid,
          sampleMfid: operation.targetMfid,
        }
      : {
          kind: "dataset-sample",
          datasetMfid: operation.targetMfid,
          sampleMfid: operation.sourceMfid,
        }
  }

  const parentMfid =
    operation.relationship === "child"
      ? operation.sourceMfid
      : operation.targetMfid
  const childMfid =
    operation.relationship === "parent"
      ? operation.sourceMfid
      : operation.targetMfid

  return {
    kind:
      operation.sourceKind === "sample" ? "sample-lineage" : "dataset-lineage",
    parentMfid,
    childMfid,
  }
}

export function inverseWorkspaceRelationship(
  relationship: WorkspaceRelationshipOperation["relationship"]
) {
  if (relationship === "associated") return relationship
  return relationship === "parent" ? "child" : "parent"
}
