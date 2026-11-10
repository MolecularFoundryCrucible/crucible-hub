import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { components } from "@/generated/crucible-api"

import type {
  WorkspacePipeline,
  WorkspacePostprocessingParameters,
  WorkspacePostprocessingRun,
  WorkspacePostprocessingRunPage,
  WorkspaceScientificMetadata,
} from "./workspace-source"

type Schema<TName extends keyof components["schemas"]> =
  components["schemas"][TName]

function toWorkspaceRun(
  run: Schema<"PostprocessingRunRead">
): WorkspacePostprocessingRun {
  return { ...run, parameters: run.parameters as WorkspaceScientificMetadata }
}

const fixturePipelines: WorkspacePipeline[] = [
  {
    description:
      "Postprocessing: segment a sample-carrier photo into one image per sample position.",
    name: "carrier_segmentation",
    parameters_schema: { properties: {}, type: "object" },
  },
  {
    description: "Postprocessing: stitch image tiles into a mosaic.",
    name: "mosaic_stitch",
    parameters_schema: { properties: {}, type: "object" },
  },
]

function fixtureRuns(
  datasetMfid: string,
  scenario?: FixtureScenario
): WorkspacePostprocessingRun[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const reference = Date.parse(source.workspace.referenceTime)
  const at = (minutes: number) =>
    new Date(reference + minutes * 60 * 1000).toISOString()
  return [
    {
      dataset_mfid: datasetMfid,
      error: null,
      finished_at: null,
      parameters: {},
      pipeline: "mosaic_stitch",
      requested_at: at(-5),
      requested_by: source.workspace.account.unique_id,
      run_id: 2,
      started_at: at(-4),
      status: "running",
    },
    {
      dataset_mfid: datasetMfid,
      error: null,
      finished_at: at(-24 * 60 + 3),
      parameters: {},
      pipeline: "carrier_segmentation",
      requested_at: at(-24 * 60),
      requested_by: source.workspace.account.unique_id,
      run_id: 1,
      started_at: at(-24 * 60 + 1),
      status: "completed",
    },
  ]
}

export async function readWorkspacePipelines(
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspacePipeline[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return fixturePipelines
  const result = await createCrucibleClient(configuration).GET("/pipelines", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return result.data.map((pipeline) => ({
    ...pipeline,
    parameters_schema:
      pipeline.parameters_schema as WorkspaceScientificMetadata,
  }))
}

export async function readDatasetPostprocessingRuns(
  datasetMfid: string,
  limit: number,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspacePostprocessingRunPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const items = fixtureRuns(datasetMfid, scenario)
    return { items, total: items.length }
  }
  const result = await createCrucibleClient(configuration).GET(
    "/postprocessing_runs",
    {
      params: { query: { dataset_mfid: datasetMfid, limit } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    items: result.data.items.map(toWorkspaceRun),
    total: result.data.total ?? null,
  }
}

export async function startDatasetPostprocessing(
  input: {
    datasetMfid: string
    idempotencyKey: string
    parameters: WorkspacePostprocessingParameters
    pipeline: string
  },
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspacePostprocessingRun> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return {
      dataset_mfid: input.datasetMfid,
      error: null,
      finished_at: null,
      parameters: input.parameters,
      pipeline: input.pipeline,
      requested_at: new Date().toISOString(),
      requested_by: source.workspace.account.unique_id,
      run_id: 3,
      started_at: null,
      status: "requested",
    }
  }
  const result = await createCrucibleClient(configuration).POST(
    "/datasets/{dataset_mfid}/postprocess",
    {
      body: { parameters: input.parameters, pipeline: input.pipeline },
      params: {
        header: { "idempotency-key": input.idempotencyKey },
        path: { dataset_mfid: input.datasetMfid },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return toWorkspaceRun(result.data)
}
