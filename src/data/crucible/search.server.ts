import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceResource } from "./resources.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import {
  assertFixtureScenarioAvailable,
  isFixtureResourceSharedWithProject,
  readWorkspaceFixture,
} from "./workspace-fixture.server"
import type {
  Workspace,
  WorkspaceResourceDetail,
  WorkspaceSearchGroup,
  WorkspaceSearchKind,
  WorkspaceSearchResponse,
  WorkspaceSearchResult,
} from "./workspace-source"
import { normalizeScientificMetadata } from "./scientific-metadata"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

type SearchInput = {
  kinds: readonly WorkspaceSearchKind[]
  limit: number
  projectMfid?: string
  query: string
  scenario?: FixtureScenario
}

type MetadataSearchInput = {
  limit: number
  query: string
  scenario?: FixtureScenario
}

const mfidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/i

function group(
  kind: WorkspaceSearchKind,
  items: readonly WorkspaceSearchResult[],
  total: number | null = items.length,
  error = false
): WorkspaceSearchGroup {
  return { error, items, kind, total }
}

function detailResult(
  resource: WorkspaceResourceDetail
): WorkspaceSearchResult {
  const context =
    resource.kind === "dataset"
      ? resource.measurement
      : resource.kind === "sample"
        ? resource.sample_type
        : resource.kind === "instrument"
          ? (resource.instrument_type ?? resource.location)
          : resource.organization
  return {
    context,
    kind: resource.kind,
    name: resource.name,
    projectId:
      resource.kind === "dataset" || resource.kind === "sample"
        ? (resource.project?.project_id ?? resource.project_id ?? null)
        : null,
    unique_id: resource.unique_id,
  }
}

function fixtureItems(
  workspace: Workspace,
  kind: WorkspaceSearchKind
): readonly WorkspaceSearchResult[] {
  if (kind === "person") {
    return workspace.people.map((item) => ({
      context: item.username ? `@${item.username}` : null,
      kind,
      name: `${item.first_name} ${item.last_name}`,
      projectId: null,
      unique_id: item.unique_id,
    }))
  }
  if (kind === "sample") {
    return workspace.samples.map((item) => ({
      context: item.sample_type ?? null,
      kind,
      name: item.sample_name,
      projectId: item.project?.project_id ?? item.project_id ?? null,
      unique_id: item.unique_id,
    }))
  }
  if (kind === "dataset") {
    return workspace.datasets.map((item) => ({
      context: item.measurement ?? null,
      kind,
      name: item.dataset_name ?? "Untitled dataset",
      projectId: item.project?.project_id ?? item.project_id ?? null,
      unique_id: item.unique_id,
    }))
  }
  if (kind === "instrument") {
    return workspace.instruments.map((item) => ({
      context: item.instrument_type ?? item.location,
      kind,
      name: item.instrument_name,
      projectId: null,
      unique_id: item.unique_id,
    }))
  }
  return workspace.projects.map((item) => ({
    context: "organization" in item ? item.organization : item.project_id,
    kind,
    name: item.title ?? item.project_id,
    projectId: null,
    unique_id: item.unique_id,
  }))
}

function relevance(item: WorkspaceSearchResult, query: string) {
  const name = item.name.toLocaleLowerCase()
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  return 2
}

function fixtureSearch(input: SearchInput): WorkspaceSearchResponse {
  const source = readWorkspaceFixture(input.scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const query = input.query.toLocaleLowerCase()
  const groups = input.kinds.map((kind) => {
    try {
      if (kind === "dataset" || kind === "instrument") {
        assertFixtureScenarioAvailable(input.scenario, `${kind}s`)
      }
      const project = input.projectMfid
        ? source.workspace.projects.find(
            (item) => item.unique_id === input.projectMfid
          )
        : undefined
      const matches = fixtureItems(source.workspace, kind)
        .filter((item) => {
          if (!input.projectMfid) return true
          if (!project || (kind !== "sample" && kind !== "dataset")) {
            return false
          }
          const resource =
            kind === "sample"
              ? source.workspace.samples.find(
                  (candidate) => candidate.unique_id === item.unique_id
                )
              : source.workspace.datasets.find(
                  (candidate) => candidate.unique_id === item.unique_id
                )
          return Boolean(
            resource &&
            (resource.project?.unique_id === project.unique_id ||
              (!resource.project &&
                resource.project_id === project.project_id) ||
              isFixtureResourceSharedWithProject(
                input.scenario,
                project.unique_id,
                kind === "sample" ? "samples" : "datasets",
                resource.unique_id
              ))
          )
        })
        .filter((item) =>
          [
            item.name,
            item.context,
            item.projectId,
            input.projectMfid ? undefined : item.unique_id,
          ].some((value) => value?.toLocaleLowerCase().includes(query))
        )
        .sort((left, right) => relevance(left, query) - relevance(right, query))
      return group(kind, matches.slice(0, input.limit), matches.length)
    } catch {
      return group(kind, [], null, true)
    }
  })
  return { groups, query: input.query }
}

function metadataContext(metadata: unknown, query: string) {
  const normalized = normalizeScientificMetadata(metadata)
  if (!normalized) return "Scientific metadata match"
  const match = Object.entries(normalized).find(([, value]) =>
    JSON.stringify(value)
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase())
  )
  if (!match) return "Scientific metadata match"
  const [key, value] = match
  const formatted = typeof value === "string" ? value : JSON.stringify(value)
  return `${key}: ${formatted}`
}

function metadataKind(value: string | null | undefined) {
  return value === "dataset" ||
    value === "instrument" ||
    value === "project" ||
    value === "sample"
    ? value
    : null
}

function fixtureMetadataSearch(
  input: MetadataSearchInput
): WorkspaceSearchResponse {
  const source = readWorkspaceFixture(input.scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const query = input.query.toLocaleLowerCase()
  const resources = [
    ...source.workspace.projects.map((resource) => ({
      kind: "project" as const,
      metadata:
        "scientific_metadata" in resource ? resource.scientific_metadata : null,
      name: resource.title ?? resource.project_id,
      unique_id: resource.unique_id,
    })),
    ...source.workspace.instruments.map((resource) => ({
      kind: "instrument" as const,
      metadata:
        demoWorkspace.instruments.find(
          (candidate) => candidate.unique_id === resource.unique_id
        )?.scientific_metadata ?? null,
      name: resource.instrument_name,
      unique_id: resource.unique_id,
    })),
    ...source.workspace.samples.map((resource) => ({
      kind: "sample" as const,
      metadata:
        demoWorkspace.samples.find(
          (candidate) => candidate.unique_id === resource.unique_id
        )?.scientific_metadata ?? null,
      name: resource.sample_name,
      unique_id: resource.unique_id,
    })),
    ...source.workspace.datasets.map((resource) => ({
      kind: "dataset" as const,
      metadata:
        demoWorkspace.datasets.find(
          (candidate) => candidate.unique_id === resource.unique_id
        )?.scientific_metadata ?? null,
      name: resource.dataset_name ?? "Untitled dataset",
      unique_id: resource.unique_id,
    })),
  ]
  const results = resources
    .filter((resource) =>
      JSON.stringify(resource.metadata).toLocaleLowerCase().includes(query)
    )
    .slice(0, input.limit)
    .map((resource): WorkspaceSearchResult => ({
      context: metadataContext(resource.metadata, input.query),
      kind: resource.kind,
      name: resource.name,
      projectId: null,
      unique_id: resource.unique_id,
    }))

  return {
    groups: (["project", "instrument", "sample", "dataset"] as const).map(
      (kind) => {
        const items = results.filter((result) => result.kind === kind)
        return group(kind, items)
      }
    ),
    query: input.query,
  }
}

function projectResult(project: Schema<"ProjectRead">): WorkspaceSearchResult {
  return {
    context: project.organization,
    kind: "project",
    name: project.title ?? project.project_id,
    projectId: null,
    unique_id: project.unique_id,
  }
}

function personResult(person: Schema<"UserPublicRead">): WorkspaceSearchResult {
  return {
    context: person.username ? `@${person.username}` : null,
    kind: "person",
    name: `${person.first_name} ${person.last_name}`,
    projectId: null,
    unique_id: person.unique_id,
  }
}

function instrumentResult(
  instrument: Schema<"InstrumentResponse">
): WorkspaceSearchResult {
  return {
    context: instrument.instrument_type ?? instrument.location,
    kind: "instrument",
    name: instrument.instrument_name,
    projectId: null,
    unique_id: instrument.unique_id,
  }
}

function sampleResult(sample: Schema<"SampleResponse">): WorkspaceSearchResult {
  return {
    context: sample.sample_type ?? null,
    kind: "sample",
    name: sample.sample_name,
    projectId: sample.project?.project_id ?? sample.project_id ?? null,
    unique_id: sample.unique_id,
  }
}

function datasetResult(
  dataset: Schema<"DatasetResponse">
): WorkspaceSearchResult {
  return {
    context: dataset.measurement ?? null,
    kind: "dataset",
    name: dataset.dataset_name ?? "Untitled dataset",
    projectId: dataset.project?.project_id ?? dataset.project_id ?? null,
    unique_id: dataset.unique_id,
  }
}

export async function searchWorkspace(
  input: SearchInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceSearchResponse> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return fixtureSearch(input)

  if (!input.projectMfid && mfidPattern.test(input.query)) {
    const resource = await readWorkspaceResource(
      input.query,
      input.scenario,
      requestSignal
    )
    const result = resource ? detailResult(resource) : null
    return {
      query: input.query,
      groups: input.kinds.map((kind) =>
        group(kind, result?.kind === kind ? [result] : [])
      ),
    }
  }

  const client = createCrucibleClient(configuration)
  const signal = crucibleRequestSignal(requestSignal)
  const requests = input.kinds.map(async (kind) => {
    if (kind === "person") {
      const result = await client.GET("/users/search", {
        params: { query: { limit: input.limit, q: input.query } },
        signal,
      })
      if (!result.data) throw new Error("people search failed")
      return group(kind, result.data.map(personResult))
    }
    if (kind === "project") {
      const result = await client.GET("/projects/search", {
        params: { query: { limit: input.limit, q: input.query } },
        signal,
      })
      if (!result.data) throw new Error("project search failed")
      return group(
        kind,
        result.data.items.map(projectResult),
        result.data.total ?? null
      )
    }
    if (kind === "instrument") {
      const result = await client.GET("/instruments/search", {
        params: {
          query: { include_owner: false, limit: input.limit, q: input.query },
        },
        signal,
      })
      if (!result.data) throw new Error("instrument search failed")
      return group(
        kind,
        result.data.items.map(instrumentResult),
        result.data.total ?? null
      )
    }
    if (kind === "sample") {
      const result = await client.GET("/samples/search", {
        params: {
          query: {
            limit: input.limit,
            project_mfid: input.projectMfid,
            project_scope: input.projectMfid ? "all" : undefined,
            q: input.query,
          },
        },
        signal,
      })
      if (!result.data) throw new Error("sample search failed")
      return group(
        kind,
        result.data.items.map(sampleResult),
        result.data.total ?? null
      )
    }
    const result = await client.GET("/datasets/search", {
      params: {
        query: {
          limit: input.limit,
          project_mfid: input.projectMfid,
          project_scope: input.projectMfid ? "all" : undefined,
          q: input.query,
        },
      },
      signal,
    })
    if (!result.data) throw new Error("dataset search failed")
    return group(
      kind,
      result.data.items.map(datasetResult),
      result.data.total ?? null
    )
  })
  const settled = await Promise.allSettled(requests)
  return {
    query: input.query,
    groups: settled.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : group(input.kinds[index], [], null, true)
    ),
  }
}

export async function searchWorkspaceMetadata(
  input: MetadataSearchInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceSearchResponse> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return fixtureMetadataSearch(input)

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/resources/metadata/search", {
    params: { query: { limit: input.limit, q: input.query } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new Error("scientific metadata search failed")
  }

  const items = result.data.items
    .map((resource): WorkspaceSearchResult | null => {
      const kind = metadataKind(resource.resource_type)
      if (!kind) return null
      return {
        context: metadataContext(resource.scientific_metadata, input.query),
        kind,
        name: resource.name ?? resource.unique_id,
        projectId: null,
        unique_id: resource.unique_id,
      }
    })
    .filter((item): item is WorkspaceSearchResult => item !== null)

  return {
    groups: (["project", "instrument", "sample", "dataset"] as const).map(
      (kind) => {
        const groupItems = items.filter((item) => item.kind === kind)
        return group(kind, groupItems)
      }
    ),
    query: input.query,
  }
}
