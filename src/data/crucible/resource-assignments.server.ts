import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceDatasetInstrumentAssignment,
  WorkspacePerson,
  WorkspaceOwnershipTransfer,
  WorkspaceProjectReassignment,
} from "./workspace-source"

import {
  safeOwner,
  fixtureWorkspace,
  readWorkspaceResource,
} from "./resources.server"

function fixtureOwner(
  ownerReference: string,
  scenario?: FixtureScenario
): WorkspacePerson {
  const workspace = fixtureWorkspace(scenario)
  const person = workspace.people.find(
    (candidate) =>
      candidate.unique_id === ownerReference ||
      candidate.username === ownerReference
  )
  if (person) return person
  const serviceAccount = workspace.projects
    .flatMap((project) =>
      "members" in project && project.members ? project.members : []
    )
    .find(
      (candidate) =>
        candidate.is_service_account === true &&
        (candidate.unique_id === ownerReference ||
          candidate.username === ownerReference)
    )
  if (!serviceAccount) throw new CrucibleResponseError(404)
  const owner = safeOwner(serviceAccount)
  if (!owner) throw new CrucibleResponseError(404)
  return owner
}

export async function transferWorkspaceResourceOwnership(
  resourceMfid: string,
  newOwner: string,
  confirm: boolean,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceOwnershipTransfer> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const resource = await readWorkspaceResource(
      resourceMfid,
      scenario,
      requestSignal
    )
    if (!resource) throw new CrucibleResponseError(404)
    return {
      resource_mfid: resourceMfid,
      previous_owner: resource.owner,
      new_owner: fixtureOwner(newOwner, scenario),
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/resources/{mfid}/transfer_ownership", {
    body: { new_owner_ref: newOwner },
    params: { path: { mfid: resourceMfid }, query: { confirm } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data)
    throw new CrucibleResponseError(result.response, result.error)
  if (result.data.resource_mfid !== resourceMfid) {
    throw new Error("The ownership response identifies another resource.")
  }
  return result.data
}

export async function reassignWorkspaceResourceProject(
  resourceMfid: string,
  projectMfid: string,
  confirm: boolean,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectReassignment> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const resource = await readWorkspaceResource(
      resourceMfid,
      scenario,
      requestSignal
    )
    if (
      !resource ||
      (resource.kind !== "sample" && resource.kind !== "dataset")
    ) {
      throw new CrucibleResponseError(404)
    }
    const project = fixtureWorkspace(scenario).projects.find(
      (candidate) => candidate.unique_id === projectMfid
    )
    if (!project) throw new CrucibleResponseError(404)
    return {
      resource_id: resourceMfid,
      resource_mfid: resourceMfid,
      previous_project_id: resource.project_id,
      previous_project_mfid: resource.project_id,
      new_project_id: project.project_id,
      new_project_mfid: projectMfid,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/resources/{mfid}/project", {
    body: { project_mfid: projectMfid },
    params: { path: { mfid: resourceMfid }, query: { confirm } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data)
    throw new CrucibleResponseError(result.response, result.error)
  if (
    result.data.resource_id !== resourceMfid &&
    result.data.resource_mfid !== resourceMfid
  ) {
    throw new Error(
      "The project assignment response identifies another resource."
    )
  }
  return result.data
}

export async function setWorkspaceDatasetInstrument(
  datasetMfid: string,
  instrumentMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceDatasetInstrumentAssignment> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const dataset = await readWorkspaceResource(
      datasetMfid,
      scenario,
      requestSignal
    )
    if (!dataset || dataset.kind !== "dataset") {
      throw new CrucibleResponseError(404)
    }
    const instrument = fixtureWorkspace(scenario).instruments.find(
      (candidate) => candidate.unique_id === instrumentMfid
    )
    if (!instrument) throw new CrucibleResponseError(404)
    return {
      dataset_mfid: datasetMfid,
      instrument: {
        instrument_id: instrument.instrument_id,
        instrument_name: instrument.instrument_name,
        unique_id: instrument.unique_id,
      },
      previous_instrument: dataset.instrument,
      previous_instrument_name: dataset.instrument?.instrument_name ?? null,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PUT("/datasets/{dataset_mfid}/instrument", {
    body: { instrument_mfid: instrumentMfid },
    params: { path: { dataset_mfid: datasetMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data)
    throw new CrucibleResponseError(result.response, result.error)
  if (
    result.data.dataset_mfid !== datasetMfid ||
    result.data.instrument.unique_id !== instrumentMfid
  ) {
    throw new Error("The instrument assignment response is invalid.")
  }
  return result.data
}
