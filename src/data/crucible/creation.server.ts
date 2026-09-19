import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { demoWorkspace } from "./fixtures/demo-workspace"
import type { FixtureScenario } from "./fixture-scenarios"
import { toWorkspaceProject } from "./projects.server"
import { toWorkspaceResourceDetail } from "./resources.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceDatasetCreate,
  WorkspaceProject,
  WorkspaceProjectCreate,
  WorkspaceResourceDetail,
  WorkspaceSampleCreate,
} from "./workspace-source"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

function fixtureWorkspace(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace
}

function projectReference(
  projectMfid: string | null,
  scenario?: FixtureScenario
): Schema<"ProjectReferenceRead"> | null {
  if (!projectMfid) return null
  const project = fixtureWorkspace(scenario).projects.find(
    (candidate) => candidate.unique_id === projectMfid
  )
  if (!project) throw new CrucibleResponseError(404)
  return {
    project_id: project.project_id,
    title: project.title,
    unique_id: project.unique_id,
  }
}

export async function createWorkspaceProjectResource(
  project: WorkspaceProjectCreate,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProject> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    if (
      workspace.projects.some(
        (candidate) =>
          candidate.project_id.toLocaleLowerCase() ===
          project.project_id.toLocaleLowerCase()
      )
    ) {
      throw new CrucibleResponseError(409)
    }
    const lead = [workspace.account, ...workspace.people].find(
      (candidate) => candidate.unique_id === project.project_lead
    )
    if (!lead) throw new CrucibleResponseError(404)
    return {
      capabilities: demoWorkspace.projects[0].capabilities,
      creation_time: new Date().toISOString(),
      lead,
      members: [],
      modification_time: null,
      organization: project.organization,
      project_id: project.project_id,
      project_lead_orcid: lead.unique_id,
      scientific_metadata: null,
      status: "active",
      title: project.title,
      unique_id: `fixture-project-${project.project_id}`,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/projects", {
    body: { ...project, status: "active" },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceProject(result.data)
}

export async function createWorkspaceSampleResource(
  sample: WorkspaceSampleCreate,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourceDetail> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    const project = projectReference(sample.projectMfid, scenario)
    return toWorkspaceResourceDetail({
      ...demoWorkspace.samples[0],
      ...sample,
      capabilities: demoWorkspace.samples[0].capabilities,
      creation_time: new Date().toISOString(),
      links: [],
      modification_time: null,
      owner: workspace.account,
      owner_orcid: workspace.account.unique_id,
      project,
      project_id: project?.project_id ?? null,
      resource_type: "sample",
      scientific_metadata: null,
      unique_id: `fixture-sample-${crypto.randomUUID()}`,
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/samples", {
    body: {
      description: sample.description,
      ...(sample.projectMfid ? { project_mfid: sample.projectMfid } : {}),
      public: sample.public,
      sample_name: sample.sample_name,
      sample_type: sample.sample_type,
      timestamp: sample.timestamp,
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.data) return toWorkspaceResourceDetail(result.data)
  throw new CrucibleResponseError(result.response.status)
}

export async function createWorkspaceDatasetResource(
  dataset: WorkspaceDatasetCreate,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourceDetail> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    const project = projectReference(dataset.projectMfid, scenario)
    const instrument = dataset.instrumentMfid
      ? workspace.instruments.find(
          (candidate) => candidate.unique_id === dataset.instrumentMfid
        )
      : null
    if (dataset.instrumentMfid && !instrument) {
      throw new CrucibleResponseError(404)
    }
    return toWorkspaceResourceDetail({
      ...demoWorkspace.datasets[0],
      ...dataset,
      capabilities: demoWorkspace.datasets[0].capabilities,
      creation_time: new Date().toISOString(),
      instrument: instrument
        ? {
            instrument_id: instrument.instrument_id,
            instrument_name: instrument.instrument_name,
            unique_id: instrument.unique_id,
          }
        : null,
      instrument_id: instrument?.instrument_id ?? null,
      instrument_name: instrument?.instrument_name ?? null,
      links: [],
      modification_time: null,
      owner: workspace.account,
      owner_orcid: workspace.account.unique_id,
      project,
      project_id: project?.project_id ?? null,
      public: dataset.public,
      resource_type: "dataset",
      scientific_metadata: null,
      unique_id: `fixture-dataset-${crypto.randomUUID()}`,
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/datasets", {
    body: {
      data_format: dataset.data_format,
      data_type: dataset.data_type,
      dataset_name: dataset.dataset_name,
      ...(dataset.instrumentMfid
        ? { instrument_mfid: dataset.instrumentMfid }
        : {}),
      measurement: dataset.measurement,
      ...(dataset.projectMfid ? { project_mfid: dataset.projectMfid } : {}),
      public: dataset.public,
      session_name: dataset.session_name,
      timestamp: dataset.timestamp,
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.data) return toWorkspaceResourceDetail(result.data)
  throw new CrucibleResponseError(result.response.status)
}
