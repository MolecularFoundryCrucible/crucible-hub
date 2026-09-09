import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { CollectionFilters } from "./collection-filters"
import { normalizeCollectionFilters } from "./collection-filters"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import {
  assertFixtureScenarioAvailable,
  isFixtureResourceSharedWithProject,
  readWorkspaceFixture,
} from "./workspace-fixture.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceCursorPage,
  WorkspaceDataset,
  WorkspacePerson,
  WorkspaceProjectRelation,
  WorkspaceSample,
} from "./workspace-source"

type ProjectScope = "all" | "assigned" | "shared"

type ProjectScopedInput = CollectionFilters & {
  projectMfid?: string
  projectScope?: ProjectScope
  scenario?: FixtureScenario
}

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

function toWorkspaceSample(sample: Schema<"SampleResponse">): WorkspaceSample {
  return {
    unique_id: sample.unique_id,
    sample_name: sample.sample_name,
    sample_type: sample.sample_type,
    project_id: sample.project?.project_id ?? sample.project_id,
    project: sample.project ?? null,
    project_relation: sample.project_relation ?? null,
    public: sample.public,
    creation_time: sample.creation_time,
    modification_time: sample.modification_time,
    timestamp: sample.timestamp ?? null,
    owner: safeOwner(sample.owner),
  }
}

function toWorkspaceDataset(
  dataset: Schema<"DatasetResponse">
): WorkspaceDataset {
  return {
    unique_id: dataset.unique_id,
    dataset_name: dataset.dataset_name,
    measurement: dataset.measurement,
    project_id: dataset.project?.project_id ?? dataset.project_id,
    project: dataset.project ?? null,
    project_relation: dataset.project_relation ?? null,
    public: dataset.public,
    instrument_id: dataset.instrument?.instrument_id ?? dataset.instrument_id,
    instrument: dataset.instrument ?? null,
    size: dataset.size,
    timestamp: dataset.timestamp,
    creation_time: dataset.creation_time,
    modification_time: dataset.modification_time,
    owner: safeOwner(dataset.owner),
  }
}

function fixtureOffset(cursor: string | undefined) {
  if (!cursor) return 0
  const match = /^fixture:(\d+)$/.exec(cursor)
  if (!match) throw new Error("The fixture cursor is invalid.")
  return Number(match[1])
}

function fixturePage<TItem>(
  items: readonly TItem[],
  input: { cursor?: string; limit: number }
): WorkspaceCursorPage<TItem> {
  const offset = fixtureOffset(input.cursor)
  const pageItems = items.slice(offset, offset + input.limit)
  const nextOffset = offset + pageItems.length
  return {
    items: pageItems,
    limit: input.limit,
    nextCursor: nextOffset < items.length ? `fixture:${nextOffset}` : null,
    total: input.cursor ? null : items.length,
  }
}

function fixtureWorkspace(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace
}

function normalizedProjectScope(input: ProjectScopedInput) {
  if (input.projectScope && !input.projectMfid) {
    throw new Error(
      "A project MFID is required when selecting a project scope."
    )
  }
  return input.projectMfid ? (input.projectScope ?? "all") : undefined
}

function normalizedInstrumentMfid(instrumentMfid: string | undefined) {
  if (instrumentMfid === undefined) return undefined
  const normalized = instrumentMfid.trim()
  if (!normalized || normalized.length > 255) {
    throw new Error("The instrument MFID must contain 1 to 255 characters.")
  }
  return normalized
}

function creationTimeBounds(input: CollectionFilters) {
  const filters = normalizeCollectionFilters(input)
  return {
    ...(filters.createdFrom
      ? { creation_time_gte: `${filters.createdFrom}T00:00:00+00:00` }
      : {}),
    ...(filters.createdTo
      ? {
          creation_time_lte: `${filters.createdTo}T23:59:59.999999+00:00`,
        }
      : {}),
  }
}

function fixtureTimestamp(value: string) {
  return value.endsWith("Z") ? `${value.slice(0, -1)}+00:00` : value
}

function fixtureCollectionRows<
  TItem extends { creation_time?: string | null; public: boolean },
>(items: readonly TItem[], input: CollectionFilters): TItem[] {
  const filters = normalizeCollectionFilters(input)
  const bounds = creationTimeBounds(filters)
  return items.filter((item) => {
    if (filters.visibility === "public" && !item.public) return false
    if (filters.visibility === "private" && item.public) return false
    if (!bounds.creation_time_gte && !bounds.creation_time_lte) return true
    if (!item.creation_time) return false
    const creationTime = fixtureTimestamp(item.creation_time)
    return (
      (!bounds.creation_time_gte || creationTime >= bounds.creation_time_gte) &&
      (!bounds.creation_time_lte || creationTime <= bounds.creation_time_lte)
    )
  })
}

function fixtureProjectRows<
  TItem extends {
    project?: { project_id: string; unique_id: string } | null
    project_id?: string | null
    unique_id: string
  },
>(
  items: readonly TItem[],
  input: ProjectScopedInput,
  family: "datasets" | "samples",
  projects: readonly {
    project_id: string
    unique_id: string
  }[]
): Array<TItem & { project_relation: WorkspaceProjectRelation | null }> {
  const projectScope = normalizedProjectScope(input)
  if (!input.projectMfid || !projectScope) {
    return items.map((item) => ({ ...item, project_relation: null }))
  }

  const requestedProject = projects.find(
    (project) => project.unique_id === input.projectMfid
  )
  if (!requestedProject) return []

  return items.flatMap((item) => {
    let relation: WorkspaceProjectRelation | null = null
    if (
      item.project?.unique_id === requestedProject.unique_id ||
      (!item.project && item.project_id === requestedProject.project_id)
    ) {
      relation = "assigned"
    } else if (
      isFixtureResourceSharedWithProject(
        input.scenario,
        requestedProject.unique_id,
        family,
        item.unique_id
      )
    ) {
      relation = "shared"
    }

    return relation && (projectScope === "all" || projectScope === relation)
      ? [{ ...item, project_relation: relation }]
      : []
  })
}

export async function readWorkspaceSamples(
  input: {
    cursor?: string
    limit: number
  } & ProjectScopedInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceCursorPage<WorkspaceSample>> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(input.scenario)
    const samples = workspace.samples.map((sample) => {
      const project =
        sample.project ??
        workspace.projects.find(
          (candidate) => candidate.project_id === sample.project_id
        ) ??
        null
      return {
        ...sample,
        project,
        project_id: project?.project_id ?? sample.project_id ?? null,
      }
    })
    const projectSamples = fixtureProjectRows(
      samples,
      input,
      "samples",
      workspace.projects
    )
    return fixturePage(fixtureCollectionRows(projectSamples, input), input)
  }

  const projectScope = normalizedProjectScope(input)
  const collectionFilters = normalizeCollectionFilters(input)
  const client = createCrucibleClient(configuration)
  const result = await client.GET("/samples", {
    params: {
      query: {
        cursor: input.cursor,
        include_owner: true,
        limit: input.limit,
        project_mfid: input.projectMfid,
        project_scope: projectScope,
        visibility: collectionFilters.visibility,
        ...creationTimeBounds(collectionFilters),
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return {
    items: result.data.items.map(toWorkspaceSample),
    limit: result.data.limit,
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? null,
  }
}

export async function readWorkspaceDatasets(
  input: {
    cursor?: string
    instrumentMfid?: string
    limit: number
  } & ProjectScopedInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceCursorPage<WorkspaceDataset>> {
  const instrumentMfid = normalizedInstrumentMfid(input.instrumentMfid)
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    assertFixtureScenarioAvailable(input.scenario, "datasets")
    const workspace = fixtureWorkspace(input.scenario)
    const datasets = workspace.datasets
    const requestedInstrument = instrumentMfid
      ? workspace.instruments.find(
          (candidate) => candidate.unique_id === instrumentMfid
        )
      : undefined
    const instrumentDatasets = instrumentMfid
      ? datasets.filter((dataset) => {
          if (dataset.instrument) {
            return dataset.instrument.unique_id === instrumentMfid
          }
          const instrumentId = requestedInstrument?.instrument_id
          return Boolean(instrumentId) && instrumentId === dataset.instrument_id
        })
      : datasets
    const filteredDatasets = fixtureProjectRows(
      instrumentDatasets,
      input,
      "datasets",
      workspace.projects
    )
    return fixturePage(fixtureCollectionRows(filteredDatasets, input), input)
  }

  const projectScope = normalizedProjectScope(input)
  const collectionFilters = normalizeCollectionFilters(input)
  const client = createCrucibleClient(configuration)
  const result = await client.GET("/datasets", {
    params: {
      query: {
        cursor: input.cursor,
        include_owner: true,
        instrument_mfid: instrumentMfid,
        limit: input.limit,
        project_mfid: input.projectMfid,
        project_scope: projectScope,
        visibility: collectionFilters.visibility,
        ...creationTimeBounds(collectionFilters),
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return {
    items: result.data.items.map(toWorkspaceDataset),
    limit: result.data.limit,
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? null,
  }
}
