import "@tanstack/react-start/server-only"

import { z } from "zod"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type { WorkspacePrivilegeMode } from "./privilege-mode"
import type {
  WorkspaceDeletionPreview,
  WorkspaceDeletionRequest,
} from "./workspace-source"

import {
  workspaceDeletionRequest,
  readWorkspaceResource,
} from "./resources.server"

const deletionGrantSchema = z
  .object({
    permission: z.string(),
    resource_mfid: z.string(),
    resource_type: z.string(),
  })
  .passthrough()

const workspaceDeletionPreviewSchema = z
  .object({
    blocking: z.record(z.string(), z.number()).optional(),
    deleted: z.boolean(),
    join_requests_removed: z.number().optional().default(0),
    memberships_removed: z.number().optional().default(0),
    removed_grants: z.array(deletionGrantSchema).optional(),
    resource_mfid: z.string(),
    resource_type: z.enum(["dataset", "instrument", "project", "sample"]),
    service_accounts_unbound: z.number().optional().default(0),
  })
  .passthrough()

function workspaceDeletionPreview(
  value: unknown
): WorkspaceDeletionPreview | null {
  const result = workspaceDeletionPreviewSchema.safeParse(value)
  if (!result.success) return null
  return {
    blocking: result.data.blocking ?? {},
    deleted: result.data.deleted,
    join_requests_removed: result.data.join_requests_removed,
    memberships_removed: result.data.memberships_removed,
    removed_grants: result.data.removed_grants ?? [],
    resource_mfid: result.data.resource_mfid,
    resource_type: result.data.resource_type,
    service_accounts_unbound: result.data.service_accounts_unbound,
  }
}

export async function requestWorkspaceResourceDeletion(
  resourceMfid: string,
  reason?: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal,
  privilegeMode?: WorkspacePrivilegeMode
): Promise<WorkspaceDeletionRequest> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const resource = await readWorkspaceResource(
      resourceMfid,
      scenario,
      requestSignal,
      "overview",
      privilegeMode
    )
    if (
      !resource ||
      (resource.kind !== "sample" && resource.kind !== "dataset")
    ) {
      throw new CrucibleResponseError(404)
    }
    return {
      capabilities: { can_review: true },
      id: 1,
      project_id: "project_id" in resource ? resource.project_id : null,
      project_mfid:
        "project" in resource ? (resource.project?.unique_id ?? null) : null,
      reason: reason ?? null,
      request_time: "2026-09-06T00:00:00Z",
      requester: source.workspace.account,
      requester_id: source.workspace.account.unique_id,
      resource_mfid: resource.unique_id,
      resource_name: resource.name,
      resource_type: resource.kind,
      review_time: null,
      reviewer: null,
      reviewer_id: null,
      reviewer_notes: null,
      status: "pending",
    }
  }

  const client = createCrucibleClient(configuration, { privilegeMode })
  const result = await client.POST("/resources/{mfid}/delete", {
    params: {
      path: { mfid: resourceMfid },
      ...(reason === undefined ? {} : { query: { reason } }),
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  if (result.data.resource_mfid !== resourceMfid) {
    throw new Error(
      "The deletion request response identifies another resource."
    )
  }
  const deletionRequest = workspaceDeletionRequest(result.data)
  if (!deletionRequest) {
    throw new Error("The deletion request response is invalid.")
  }
  return deletionRequest
}

export async function deleteWorkspaceResource(
  resourceMfid: string,
  confirm: boolean,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal,
  privilegeMode?: WorkspacePrivilegeMode
): Promise<WorkspaceDeletionPreview> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return fixtureDeletionPreview(resourceMfid, confirm, scenario)
  }

  const client = createCrucibleClient(configuration, { privilegeMode })
  const result = await client.DELETE("/resources/{mfid}", {
    params: {
      path: { mfid: resourceMfid },
      query: { force: true, ...(confirm ? { confirm: true } : {}) },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data)
    throw new CrucibleResponseError(result.response, result.error)
  const preview = workspaceDeletionPreview(result.data)
  if (!preview) {
    throw new Error("The deletion response is invalid.")
  }
  if (preview.resource_mfid !== resourceMfid) {
    throw new Error("The deletion response identifies another resource.")
  }
  if (preview.deleted !== confirm) {
    throw new Error("The deletion response does not match the request.")
  }
  return preview
}

function fixtureDeletionPreview(
  resourceMfid: string,
  confirm: boolean,
  scenario?: FixtureScenario
): WorkspaceDeletionPreview {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const { datasets, instruments, projects, samples } = source.workspace
  const project = projects.find(
    (candidate) => candidate.unique_id === resourceMfid
  )
  if (project) {
    const blockingDatasets = datasets.filter(
      (dataset) => dataset.project_id === project.project_id
    ).length
    const blockingSamples = samples.filter(
      (sample) => sample.project_id === project.project_id
    ).length
    const blocking: Record<string, number> = {}
    if (blockingDatasets > 0) blocking.datasets = blockingDatasets
    if (blockingSamples > 0) blocking.samples = blockingSamples
    if (!confirm) {
      return {
        blocking,
        deleted: false,
        join_requests_removed: 0,
        memberships_removed: project.members?.length ?? 0,
        removed_grants: [],
        resource_mfid: project.unique_id,
        resource_type: "project",
        service_accounts_unbound: 0,
      }
    }
    if (Object.keys(blocking).length > 0) {
      throw new CrucibleResponseError(409)
    }
    return {
      blocking: {},
      deleted: true,
      join_requests_removed: 0,
      memberships_removed: project.members?.length ?? 0,
      removed_grants: [],
      resource_mfid: project.unique_id,
      resource_type: "project",
      service_accounts_unbound: 0,
    }
  }
  const instrument = instruments.find(
    (candidate) => candidate.unique_id === resourceMfid
  )
  if (instrument) {
    const blockingDatasets = datasets.filter(
      (dataset) => dataset.instrument_id === instrument.instrument_id
    ).length
    const blocking: Record<string, number> =
      blockingDatasets > 0 ? { datasets: blockingDatasets } : {}
    if (!confirm) {
      return {
        blocking,
        deleted: false,
        join_requests_removed: 0,
        memberships_removed: 0,
        removed_grants: [],
        resource_mfid: instrument.unique_id,
        resource_type: "instrument",
        service_accounts_unbound: 0,
      }
    }
    if (Object.keys(blocking).length > 0) {
      throw new CrucibleResponseError(409)
    }
    return {
      blocking: {},
      deleted: true,
      join_requests_removed: 0,
      memberships_removed: 0,
      removed_grants: [],
      resource_mfid: instrument.unique_id,
      resource_type: "instrument",
      service_accounts_unbound: 0,
    }
  }
  const dataset = datasets.find(
    (candidate) => candidate.unique_id === resourceMfid
  )
  if (dataset) {
    return {
      blocking: {},
      deleted: true,
      join_requests_removed: 0,
      memberships_removed: 0,
      removed_grants: [],
      resource_mfid: dataset.unique_id,
      resource_type: "dataset",
      service_accounts_unbound: 0,
    }
  }
  const sample = samples.find(
    (candidate) => candidate.unique_id === resourceMfid
  )
  if (sample) {
    return {
      blocking: {},
      deleted: true,
      join_requests_removed: 0,
      memberships_removed: 0,
      removed_grants: [],
      resource_mfid: sample.unique_id,
      resource_type: "sample",
      service_accounts_unbound: 0,
    }
  }
  throw new CrucibleResponseError(404)
}
