import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceLinkedResource,
  WorkspaceRelationshipOperation,
  WorkspaceRelationshipType,
} from "./workspace-source"

export type WorkspaceRelationshipResourceKind = "dataset" | "sample"
export type WorkspaceRelationship =
  WorkspaceRelationshipOperation["relationship"]

export type WorkspaceRelationshipChoice = {
  label: string
  relationship: WorkspaceRelationship
  targetKind: WorkspaceRelationshipResourceKind
}

const workspaceRelationshipNameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
})

export const workspaceRelationshipChoices = {
  dataset: [
    { label: "Parent dataset", relationship: "parent", targetKind: "dataset" },
    { label: "Child dataset", relationship: "child", targetKind: "dataset" },
    {
      label: "Linked sample",
      relationship: "associated",
      targetKind: "sample",
    },
  ],
  sample: [
    { label: "Parent sample", relationship: "parent", targetKind: "sample" },
    { label: "Child sample", relationship: "child", targetKind: "sample" },
    {
      label: "Linked dataset",
      relationship: "associated",
      targetKind: "dataset",
    },
  ],
} as const satisfies Record<
  WorkspaceRelationshipResourceKind,
  readonly WorkspaceRelationshipChoice[]
>

export const workspaceRelationshipTypeOptions = [
  { label: "Derived from", value: "is_derived_from" },
  { label: "Part of", value: "is_part_of" },
] as const satisfies readonly {
  label: string
  value: WorkspaceRelationshipType
}[]

export function compareWorkspaceRelationshipResources(
  left: Pick<WorkspaceLinkedResource, "name" | "unique_id">,
  right: Pick<WorkspaceLinkedResource, "name" | "unique_id">
) {
  const leftLabel = left.name?.trim() || left.unique_id
  const rightLabel = right.name?.trim() || right.unique_id
  return (
    workspaceRelationshipNameCollator.compare(leftLabel, rightLabel) ||
    workspaceRelationshipNameCollator.compare(left.unique_id, right.unique_id)
  )
}

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

export function workspaceRelationshipOperation({
  action,
  relationship,
  relationshipType,
  resourceKind,
  resourceMfid,
  scenario,
  targetMfid,
}: {
  action: "link" | "unlink"
  relationship: WorkspaceRelationship
  relationshipType?: WorkspaceRelationshipType | null
  resourceKind: WorkspaceRelationshipResourceKind
  resourceMfid: string
  scenario?: FixtureScenario
  targetMfid: string
}): WorkspaceRelationshipOperation {
  const base = {
    action,
    relationship,
    scenario,
    sourceMfid: resourceMfid,
    targetMfid,
  }
  if (relationship === "associated") {
    return resourceKind === "sample"
      ? {
          ...base,
          relationship: "associated",
          sourceKind: "sample",
          targetKind: "dataset",
        }
      : {
          ...base,
          relationship: "associated",
          sourceKind: "dataset",
          targetKind: "sample",
        }
  }
  return resourceKind === "sample"
    ? {
        ...base,
        relationship,
        relationshipType,
        sourceKind: "sample",
        targetKind: "sample",
      }
    : {
        ...base,
        relationship,
        relationshipType,
        sourceKind: "dataset",
        targetKind: "dataset",
      }
}

export function workspaceRelationshipChoiceDescription(
  resourceKind: WorkspaceRelationshipResourceKind,
  choice: WorkspaceRelationshipChoice
) {
  if (choice.relationship === "associated") {
    return `The ${choice.targetKind} and ${resourceKind} will be linked without a parent-child direction.`
  }
  return choice.relationship === "parent"
    ? `The selected ${choice.targetKind} will be a parent of this ${resourceKind}.`
    : `The selected ${choice.targetKind} will be a child of this ${resourceKind}.`
}
