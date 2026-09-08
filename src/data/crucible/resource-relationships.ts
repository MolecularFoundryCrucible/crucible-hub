import type {
  WorkspaceLinkedResource,
  WorkspaceRelationshipOperation,
  WorkspaceRelationshipType,
} from "./workspace-source"

export const workspaceRelationshipTypeOptions = [
  { label: "Derived from", value: "is_derived_from" },
  { label: "Part of", value: "is_part_of" },
] as const satisfies readonly {
  label: string
  value: WorkspaceRelationshipType
}[]

export type WorkspaceApiRelationshipOperation =
  | {
      childMfid: string
      kind: "sample-lineage"
      parentMfid: string
      relationshipType: WorkspaceRelationshipType | null
    }
  | {
      childMfid: string
      kind: "dataset-lineage"
      parentMfid: string
      relationshipType: WorkspaceRelationshipType | null
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
    relationshipType: operation.relationshipType ?? null,
  }
}

export function isWorkspaceRelationshipType(
  value: string | null | undefined
): value is WorkspaceRelationshipType {
  return workspaceRelationshipTypeOptions.some(
    (option) => option.value === value
  )
}

export function workspaceRelationshipTypeLabel(
  link: Pick<WorkspaceLinkedResource, "relationship" | "relationship_type">
) {
  if (!link.relationship_type || link.relationship === "associated") {
    return null
  }
  if (link.relationship_type === "is_derived_from") {
    return link.relationship === "parent" ? "Derived from" : "Derived from this"
  }
  if (link.relationship_type === "is_part_of") {
    return link.relationship === "parent" ? "Part of" : "Part of this"
  }
  const label = link.relationship_type.replaceAll("_", " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function inverseWorkspaceRelationship(
  relationship: WorkspaceRelationshipOperation["relationship"]
) {
  if (relationship === "associated") return relationship
  return relationship === "parent" ? "child" : "parent"
}
