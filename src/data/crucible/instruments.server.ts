import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import {
  assertFixtureScenarioAvailable,
  readWorkspaceFixture,
} from "./workspace-fixture.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceInstrumentDescriptiveUpdate,
  WorkspaceInstrument,
  WorkspaceInstrumentPage,
  WorkspacePerson,
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
    (typeof owner.username !== "string" && owner.username != null)
  ) {
    return null
  }
  return {
    unique_id: owner.unique_id,
    first_name: owner.first_name,
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

export async function readWorkspaceInstruments(
  {
    limit,
    offset,
    scenario,
  }: { limit: number; offset: number; scenario?: FixtureScenario },
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
    return {
      items: source.workspace.instruments.slice(offset, offset + limit),
      limit,
      offset,
      total: source.workspace.instruments.length,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/instruments", {
    params: {
      query: { include_owner: true, limit, offset },
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
