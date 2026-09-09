import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { demoWorkspace } from "./fixtures/demo-workspace"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import {
  assertFixtureScenarioAvailable,
  readWorkspaceFixture,
} from "./workspace-fixture.server"
import { isWorkspaceInstrumentStatus } from "./instrument-status"
import { toWorkspaceResourceDetail } from "./resources.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceInstrumentDescriptiveUpdate,
  WorkspaceInstrument,
  WorkspaceInstrumentLifecycleUpdate,
  WorkspaceInstrumentCreate,
  WorkspaceInstrumentOperator,
  WorkspaceInstrumentPage,
  WorkspaceInstrumentStatus,
  WorkspacePerson,
  WorkspaceResourceDetail,
} from "./workspace-source"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

function safeOwner(value: unknown): WorkspacePerson | null {
  if (typeof value !== "object" || value === null) return null
  const owner = value as Record<string, unknown>
  if (
    typeof owner.unique_id !== "string" ||
    typeof owner.first_name !== "string" ||
    typeof owner.last_name !== "string" ||
    (typeof owner.is_service_account !== "boolean" &&
      owner.is_service_account != null) ||
    (typeof owner.username !== "string" && owner.username != null)
  ) {
    return null
  }
  return {
    unique_id: owner.unique_id,
    first_name: owner.first_name,
    is_service_account: owner.is_service_account ?? null,
    last_name: owner.last_name,
    username: owner.username ?? null,
  }
}

function toWorkspaceInstrument(
  instrument: Schema<"InstrumentResponse">
): WorkspaceInstrument {
  return {
    instrument_id: instrument.instrument_id,
    unique_id: instrument.unique_id,
    instrument_name: instrument.instrument_name,
    instrument_type: instrument.instrument_type,
    status: instrument.status,
    description: instrument.description,
    location: instrument.location,
    manufacturer: instrument.manufacturer,
    model: instrument.model,
    modification_time: instrument.modification_time,
    other_id: instrument.other_id,
    other_id_source: instrument.other_id_source,
    capabilities: instrument.capabilities ?? null,
    owner: safeOwner(instrument.owner),
  }
}

function fixtureWorkspace(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace
}

function fixtureInstrumentOperators(
  instrumentMfid: string,
  scenario?: FixtureScenario
): WorkspaceInstrumentOperator[] {
  const workspace = fixtureWorkspace(scenario)
  if (
    !workspace.instruments.some(
      (instrument) => instrument.unique_id === instrumentMfid
    )
  ) {
    throw new CrucibleResponseError(404)
  }
  const operators = workspace.projects
    .flatMap((project) =>
      "members" in project && project.members ? project.members : []
    )
    .filter((member) => member.is_service_account === true)
  return [
    ...new Map(operators.map((member) => [member.unique_id, member])).values(),
  ]
}

export async function readWorkspaceInstrumentOperators(
  instrumentMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceInstrumentOperator[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return fixtureInstrumentOperators(instrumentMfid, scenario)
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET(
    "/instruments/{instrument_mfid}/service_accounts",
    {
      params: { path: { instrument_mfid: instrumentMfid } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function addWorkspaceInstrumentOperator(
  instrumentMfid: string,
  serviceAccountId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceInstrumentOperator[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const operators = fixtureInstrumentOperators(instrumentMfid, scenario)
    if (operators.some((operator) => operator.unique_id === serviceAccountId)) {
      return operators
    }
    const workspace = fixtureWorkspace(scenario)
    const member = workspace.projects
      .flatMap((project) =>
        "members" in project && project.members ? project.members : []
      )
      .find(
        (candidate) =>
          candidate.is_service_account === true &&
          candidate.unique_id === serviceAccountId
      )
    if (!member) throw new CrucibleResponseError(404)
    return [...operators, { ...member, role: "admin" }]
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST(
    "/instruments/{instrument_mfid}/service_accounts/{sa_unique_id}",
    {
      params: {
        path: {
          instrument_mfid: instrumentMfid,
          sa_unique_id: serviceAccountId,
        },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function removeWorkspaceInstrumentOperator(
  instrumentMfid: string,
  serviceAccountId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceInstrumentOperator[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return fixtureInstrumentOperators(instrumentMfid, scenario).filter(
      (operator) => operator.unique_id !== serviceAccountId
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.DELETE(
    "/instruments/{instrument_mfid}/service_accounts/{sa_unique_id}",
    {
      params: {
        path: {
          instrument_mfid: instrumentMfid,
          sa_unique_id: serviceAccountId,
        },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function createWorkspaceInstrumentResource(
  instrument: WorkspaceInstrumentCreate,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourceDetail> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    if (
      workspace.instruments.some(
        (candidate) =>
          candidate.instrument_id?.toLocaleLowerCase() ===
          instrument.instrument_id.toLocaleLowerCase()
      )
    ) {
      throw new CrucibleResponseError(409)
    }
    const template = demoWorkspace.instruments[0]
    return toWorkspaceResourceDetail({
      ...template,
      ...instrument,
      unique_id: `fixture-instrument-${instrument.instrument_id}`,
      creation_time: new Date().toISOString(),
      modification_time: null,
      owner: workspace.account,
      owner_orcid: workspace.account.unique_id,
      resource_type: "instrument",
      scientific_metadata: null,
      status: "active",
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/instruments", {
    body: instrument,
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceResourceDetail(result.data)
}

type InstrumentDescriptiveChanges = {
  description?: string | null
  instrument_name?: string
  instrument_type?: string | null
  location?: string
  manufacturer?: string | null
  model?: string | null
  other_id?: string | null
  other_id_source?: string | null
}

function workspaceInstrumentDescriptiveUpdate(
  instrument: WorkspaceInstrumentDescriptiveUpdate
): WorkspaceInstrumentDescriptiveUpdate {
  return {
    description: instrument.description ?? null,
    instrument_id: instrument.instrument_id ?? null,
    instrument_name: instrument.instrument_name,
    instrument_type: instrument.instrument_type ?? null,
    location: instrument.location,
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    modification_time: instrument.modification_time ?? null,
    other_id: instrument.other_id ?? null,
    other_id_source: instrument.other_id_source ?? null,
    unique_id: instrument.unique_id,
  }
}

export async function patchWorkspaceInstrument(
  instrumentMfid: string,
  changes: InstrumentDescriptiveChanges,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceInstrumentDescriptiveUpdate> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const instrument = fixtureWorkspace(scenario).instruments.find(
      (candidate) => candidate.unique_id === instrumentMfid
    )
    if (!instrument) throw new CrucibleResponseError(404)
    return workspaceInstrumentDescriptiveUpdate({
      description: instrument.description ?? null,
      instrument_id: instrument.instrument_id ?? null,
      instrument_name: instrument.instrument_name,
      instrument_type: instrument.instrument_type ?? null,
      location: instrument.location,
      manufacturer: instrument.manufacturer ?? null,
      model: instrument.model ?? null,
      modification_time: instrument.modification_time ?? null,
      other_id: instrument.other_id ?? null,
      other_id_source: instrument.other_id_source ?? null,
      unique_id: instrument.unique_id,
      ...changes,
    })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PATCH("/instruments/{instrument_mfid}", {
    body: changes,
    params: { path: { instrument_mfid: instrumentMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return workspaceInstrumentDescriptiveUpdate({
    description: result.data.description ?? null,
    instrument_id: result.data.instrument_id ?? null,
    instrument_name: result.data.instrument_name,
    instrument_type: result.data.instrument_type ?? null,
    location: result.data.location,
    manufacturer: result.data.manufacturer ?? null,
    model: result.data.model ?? null,
    modification_time: result.data.modification_time ?? null,
    other_id: result.data.other_id ?? null,
    other_id_source: result.data.other_id_source ?? null,
    unique_id: result.data.unique_id,
  })
}

function workspaceInstrumentLifecycleUpdate(
  instrument: Schema<"InstrumentResponse">
): WorkspaceInstrumentLifecycleUpdate {
  if (!isWorkspaceInstrumentStatus(instrument.status)) {
    throw new Error("The instrument status response is invalid.")
  }
  return {
    modification_time: instrument.modification_time ?? null,
    status: instrument.status,
    unique_id: instrument.unique_id,
  }
}

export async function setWorkspaceInstrumentStatus(
  instrumentMfid: string,
  status: WorkspaceInstrumentStatus,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceInstrumentLifecycleUpdate> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const instrument = fixtureWorkspace(scenario).instruments.find(
      (candidate) => candidate.unique_id === instrumentMfid
    )
    if (!instrument) throw new CrucibleResponseError(404)
    return {
      modification_time: instrument.modification_time ?? null,
      status,
      unique_id: instrument.unique_id,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/instruments/{instrument_mfid}/status", {
    params: {
      path: { instrument_mfid: instrumentMfid },
      query: { status },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  const update = workspaceInstrumentLifecycleUpdate(result.data)
  if (update.unique_id !== instrumentMfid) {
    throw new Error("The instrument status response is invalid.")
  }
  return update
}

export async function readWorkspaceInstruments(
  {
    limit,
    offset,
    scenario,
    status,
  }: {
    limit: number
    offset: number
    scenario?: FixtureScenario
    status?: WorkspaceInstrumentStatus
  },
  requestSignal?: AbortSignal
): Promise<WorkspaceInstrumentPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    assertFixtureScenarioAvailable(scenario, "instruments")
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const instruments = source.workspace.instruments.filter(
      (instrument) => instrument.status === (status ?? "active")
    )
    return {
      items: instruments.slice(offset, offset + limit),
      limit,
      offset,
      total: instruments.length,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/instruments", {
    params: {
      query: { include_owner: true, limit, offset, status },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return {
    items: result.data.items.map(toWorkspaceInstrument),
    limit: result.data.limit,
    offset: result.data.offset ?? offset,
    total: result.data.total ?? null,
  }
}
