import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import {
  inverseWorkspaceRelationship,
  workspaceApiRelationshipOperation,
} from "./resource-relationships"
import type {
  WorkspaceLinkedResource,
  WorkspaceRelationshipMutationResult,
  WorkspaceRelationshipOperation,
  WorkspaceResourceDetail,
} from "./workspace-source"

import { readWorkspaceResource } from "./resources.server"
import type { WorkspaceRelationshipResourceDetail } from "./resources.server"

function relationshipDetail(
  detail: WorkspaceResourceDetail | null,
  kind: WorkspaceRelationshipOperation["sourceKind"],
  role: "source" | "target"
): WorkspaceRelationshipResourceDetail {
  if (!detail) throw new CrucibleResponseError(404)
  if (detail.kind !== kind) {
    throw new Error(`The relationship ${role} does not have the expected kind.`)
  }
  return detail
}

function relationshipLink(
  target: WorkspaceRelationshipResourceDetail,
  relationship: WorkspaceRelationshipOperation["relationship"],
  relationshipType: WorkspaceLinkedResource["relationship_type"]
) {
  return {
    name: target.name,
    relationship,
    relationship_type: relationshipType ?? null,
    resource_type: target.kind,
    unique_id: target.unique_id,
  } satisfies WorkspaceLinkedResource
}

function hasRelationshipLink(
  resource: WorkspaceRelationshipResourceDetail,
  targetMfid: string,
  relationship: WorkspaceRelationshipOperation["relationship"]
) {
  return (
    resource.links?.some(
      (link) =>
        link.unique_id === targetMfid && link.relationship === relationship
    ) ?? false
  )
}

function applyRelationshipLink(
  resource: WorkspaceRelationshipResourceDetail,
  target: WorkspaceRelationshipResourceDetail,
  relationship: WorkspaceRelationshipOperation["relationship"],
  relationshipType: WorkspaceLinkedResource["relationship_type"],
  action: WorkspaceRelationshipOperation["action"]
) {
  const links = resource.links ?? []
  const exists = hasRelationshipLink(resource, target.unique_id, relationship)
  if (action === "unlink" && !exists) return null
  return {
    ...resource,
    links:
      action === "link"
        ? exists
          ? [...links]
          : [...links, relationshipLink(target, relationship, relationshipType)]
        : links.filter(
            (link) =>
              link.unique_id !== target.unique_id ||
              link.relationship !== relationship
          ),
  }
}

async function fixtureWorkspaceRelationshipMutation(
  operation: WorkspaceRelationshipOperation,
  requestSignal?: AbortSignal
): Promise<WorkspaceRelationshipMutationResult> {
  const source = relationshipDetail(
    await readWorkspaceResource(
      operation.sourceMfid,
      operation.scenario,
      requestSignal
    ),
    operation.sourceKind,
    "source"
  )
  const target = relationshipDetail(
    await readWorkspaceResource(
      operation.targetMfid,
      operation.scenario,
      requestSignal
    ),
    operation.targetKind,
    "target"
  )
  const updatedSource = applyRelationshipLink(
    source,
    target,
    operation.relationship,
    operation.relationship === "associated" ? null : operation.relationshipType,
    operation.action
  )
  if (!updatedSource) throw new CrucibleResponseError(404)
  const updatedTarget = applyRelationshipLink(
    target,
    source,
    inverseWorkspaceRelationship(operation.relationship),
    operation.relationship === "associated" ? null : operation.relationshipType,
    operation.action
  )
  if (!updatedTarget) throw new CrucibleResponseError(404)
  return { source: updatedSource, target: updatedTarget }
}

export async function mutateWorkspaceRelationship(
  operation: WorkspaceRelationshipOperation,
  requestSignal?: AbortSignal
): Promise<WorkspaceRelationshipMutationResult> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return fixtureWorkspaceRelationshipMutation(operation, requestSignal)
  }

  const client = createCrucibleClient(configuration)
  const normalized = workspaceApiRelationshipOperation(operation)
  const result =
    normalized.kind === "sample-lineage"
      ? operation.action === "link"
        ? await client.POST(
            "/samples/{parent_sample_mfid}/children/{child_sample_mfid}",
            {
              params: {
                path: {
                  parent_sample_mfid: normalized.parentMfid,
                  child_sample_mfid: normalized.childMfid,
                },
                ...(normalized.relationshipType
                  ? {
                      query: {
                        relationship_type: normalized.relationshipType,
                      },
                    }
                  : {}),
              },
              signal: crucibleRequestSignal(requestSignal),
            }
          )
        : await client.DELETE(
            "/samples/{parent_sample_mfid}/children/{child_sample_mfid}",
            {
              params: {
                path: {
                  parent_sample_mfid: normalized.parentMfid,
                  child_sample_mfid: normalized.childMfid,
                },
              },
              signal: crucibleRequestSignal(requestSignal),
            }
          )
      : normalized.kind === "dataset-lineage"
        ? operation.action === "link"
          ? await client.POST(
              "/datasets/{parent_dataset_mfid}/children/{child_dataset_mfid}",
              {
                params: {
                  path: {
                    parent_dataset_mfid: normalized.parentMfid,
                    child_dataset_mfid: normalized.childMfid,
                  },
                  ...(normalized.relationshipType
                    ? {
                        query: {
                          relationship_type: normalized.relationshipType,
                        },
                      }
                    : {}),
                },
                signal: crucibleRequestSignal(requestSignal),
              }
            )
          : await client.DELETE(
              "/datasets/{parent_dataset_mfid}/children/{child_dataset_mfid}",
              {
                params: {
                  path: {
                    parent_dataset_mfid: normalized.parentMfid,
                    child_dataset_mfid: normalized.childMfid,
                  },
                },
                signal: crucibleRequestSignal(requestSignal),
              }
            )
        : operation.action === "link"
          ? await client.POST(
              "/datasets/{dataset_mfid}/samples/{sample_mfid}",
              {
                params: {
                  path: {
                    dataset_mfid: normalized.datasetMfid,
                    sample_mfid: normalized.sampleMfid,
                  },
                },
                signal: crucibleRequestSignal(requestSignal),
              }
            )
          : await client.DELETE(
              "/datasets/{dataset_mfid}/samples/{sample_mfid}",
              {
                params: {
                  path: {
                    dataset_mfid: normalized.datasetMfid,
                    sample_mfid: normalized.sampleMfid,
                  },
                },
                signal: crucibleRequestSignal(requestSignal),
              }
            )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }

  const [source, target] = await Promise.all([
    readWorkspaceResource(
      operation.sourceMfid,
      operation.scenario,
      requestSignal
    ),
    readWorkspaceResource(
      operation.targetMfid,
      operation.scenario,
      requestSignal
    ),
  ])
  return {
    source: relationshipDetail(source, operation.sourceKind, "source"),
    target: relationshipDetail(target, operation.targetKind, "target"),
  }
}
