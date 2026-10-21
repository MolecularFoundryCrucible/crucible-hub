import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import {
  demoWorkspace,
  fixturePublicOnlyMfids,
} from "@/data/crucible/fixtures/demo-workspace"
import { formatUsername } from "@/lib/username"
import { resourceDisplayName } from "@/lib/resource-name"

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

type SearchAffiliation = "member" | "owner"

type SearchInput = {
  affiliation?: SearchAffiliation
  kinds: readonly WorkspaceSearchKind[]
  limit: number
  projectMfid?: string
  query: string
  scenario?: FixtureScenario
  serviceAccountsOnly?: boolean
}

type MetadataSearchInput = {
  affiliation?: SearchAffiliation
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
          : resource.name.trim()
            ? resource.project_id
            : null
  return {
    context,
    kind: resource.kind,
    name: resourceDisplayName(resource.kind, resource.name, {
      identifier:
        resource.kind === "project"
          ? resource.project_id
          : resource.kind === "instrument"
            ? resource.instrument_id
            : null,
      mfid: resource.unique_id,
    }),
    projectId:
      resource.kind === "dataset" || resource.kind === "sample"
        ? (resource.project?.project_id ?? resource.project_id ?? null)
        : null,
    unique_id: resource.unique_id,
  }
}

function personSearchName(person: {
  first_name: string
  last_name: string
  unique_id: string
  username?: string | null
}) {
  const name = [person.first_name, person.last_name]
    .filter((value) => value.trim())
    .join(" ")
  return name || formatUsername(person.username, "raw") || person.unique_id
}

function fixtureItems(
  workspace: Workspace,
  kind: WorkspaceSearchKind
): readonly WorkspaceSearchResult[] {
  if (kind === "person") {
    return workspace.people.map((item) => ({
      context: formatUsername(item.username, "handle") || null,
      is_service_account: item.is_service_account,
      kind,
      name: personSearchName(item),
      projectId: null,
      unique_id: item.unique_id,
    }))
  }
  if (kind === "sample") {
    return workspace.samples.map((item) => ({
      context: item.sample_type ?? null,
      kind,
      name: resourceDisplayName("sample", item.sample_name),
      projectId: item.project?.project_id ?? item.project_id ?? null,
      unique_id: item.unique_id,
    }))
  }
  if (kind === "dataset") {
    return workspace.datasets.map((item) => ({
      context: item.measurement ?? null,
      kind,
      name: resourceDisplayName("dataset", item.dataset_name),
      projectId: item.project?.project_id ?? item.project_id ?? null,
      unique_id: item.unique_id,
    }))
  }
  if (kind === "instrument") {
    return workspace.instruments.map((item) => ({
      context: item.instrument_type ?? item.location,
      kind,
      name: resourceDisplayName("instrument", item.instrument_name, {
        identifier: item.instrument_id,
        mfid: item.unique_id,
      }),
      projectId: null,
      unique_id: item.unique_id,
    }))
  }
  return workspace.projects.map((item) => ({
    context: item.title?.trim() ? item.project_id : null,
    kind,
    name: resourceDisplayName("project", item.title, {
      identifier: item.project_id,
      mfid: item.unique_id,
    }),
    projectId: null,
    unique_id: item.unique_id,
  }))
}

function fixtureOwnedMfids(workspace: Workspace) {
  const accountMfid = workspace.account.unique_id
  const ownerOf = (item: object) => {
    const record = item as {
      lead?: { unique_id?: string } | null
      owner?: { unique_id?: string } | null
      owner_orcid?: string | null
      project_lead_orcid?: string | null
    }
    return (
      record.owner?.unique_id ??
      record.owner_orcid ??
      record.lead?.unique_id ??
      record.project_lead_orcid
    )
  }
  return new Set(
    [
      ...workspace.projects,
      ...workspace.instruments,
      ...workspace.samples,
      ...workspace.datasets,
    ]
      .filter((item) => ownerOf(item) === accountMfid)
      .map((item) => item.unique_id)
  )
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
  const owned =
    input.affiliation === "owner"
      ? fixtureOwnedMfids(source.workspace)
      : undefined
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
        .filter(
          (item) =>
            !input.serviceAccountsOnly || item.is_service_account === true
        )
        .filter(
          (item) =>
            input.affiliation !== "member" ||
            (kind !== "sample" && kind !== "dataset") ||
            mfidPattern.test(input.query.trim()) ||
            !fixturePublicOnlyMfids.has(item.unique_id)
        )
        .filter(
          (item) => !owned || kind === "person" || owned.has(item.unique_id)
        )
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
  const owned =
    input.affiliation === "owner"
      ? fixtureOwnedMfids(source.workspace)
      : undefined
  const resources = [
    ...source.workspace.projects.map((resource) => ({
      kind: "project" as const,
      metadata:
        "scientific_metadata" in resource ? resource.scientific_metadata : null,
      name: resourceDisplayName("project", resource.title, {
        identifier: resource.project_id,
        mfid: resource.unique_id,
      }),
      unique_id: resource.unique_id,
    })),
    ...source.workspace.instruments.map((resource) => ({
      kind: "instrument" as const,
      metadata:
        demoWorkspace.instruments.find(
          (candidate) => candidate.unique_id === resource.unique_id
        )?.scientific_metadata ?? null,
      name: resourceDisplayName("instrument", resource.instrument_name, {
        identifier: resource.instrument_id,
        mfid: resource.unique_id,
      }),
      unique_id: resource.unique_id,
    })),
    ...source.workspace.samples.map((resource) => ({
      kind: "sample" as const,
      metadata:
        demoWorkspace.samples.find(
          (candidate) => candidate.unique_id === resource.unique_id
        )?.scientific_metadata ?? null,
      name: resourceDisplayName("sample", resource.sample_name),
      unique_id: resource.unique_id,
    })),
    ...source.workspace.datasets.map((resource) => ({
      kind: "dataset" as const,
      metadata:
        demoWorkspace.datasets.find(
          (candidate) => candidate.unique_id === resource.unique_id
        )?.scientific_metadata ?? null,
      name: resourceDisplayName("dataset", resource.dataset_name),
      unique_id: resource.unique_id,
    })),
  ]
  const results = resources
    .filter(
      (resource) =>
        input.affiliation !== "member" ||
        !fixturePublicOnlyMfids.has(resource.unique_id)
    )
    .filter((resource) => !owned || owned.has(resource.unique_id))
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

function projectResult(
  project: Schema<"ProjectRead"> | Schema<"ProjectWithLead">
): WorkspaceSearchResult {
  return {
    context: project.title?.trim() ? project.project_id : null,
    kind: "project",
    name: resourceDisplayName("project", project.title, {
      identifier: project.project_id,
      mfid: project.unique_id,
    }),
    projectId: null,
    unique_id: project.unique_id,
  }
}

function personResult(
  person: Schema<"UserPublicRead"> | Schema<"UserRead">
): WorkspaceSearchResult {
  return {
    context: formatUsername(person.username, "handle") || null,
    is_service_account: person.is_service_account,
    kind: "person",
    name: personSearchName(person),
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
    name: resourceDisplayName("instrument", instrument.instrument_name, {
      identifier: instrument.instrument_id,
      mfid: instrument.unique_id,
    }),
    projectId: null,
    unique_id: instrument.unique_id,
  }
}

function sampleResult(sample: Schema<"SampleResponse">): WorkspaceSearchResult {
  return {
    context: sample.sample_type ?? null,
    kind: "sample",
    name: resourceDisplayName("sample", sample.sample_name),
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
    name: resourceDisplayName("dataset", dataset.dataset_name),
    projectId: dataset.project?.project_id ?? dataset.project_id ?? null,
    unique_id: dataset.unique_id,
  }
}

type SearchOutcome = {
  items: readonly WorkspaceSearchResult[]
  total: number | null
}

type SearchKindRequest = (
  client: ReturnType<typeof createCrucibleClient>,
  input: SearchInput,
  signal: AbortSignal
) => Promise<SearchOutcome>

function searchOutcome<T>(
  data:
    | {
        items: T[]
        total?: number | null | undefined
      }
    | undefined,
  message: string,
  map: (item: T) => WorkspaceSearchResult
): SearchOutcome {
  if (!data) throw new Error(message)
  return {
    items: data.items.map(map),
    total: data.total ?? null,
  }
}

const kindSearches: Record<
  WorkspaceSearchKind,
  { browse: SearchKindRequest; search: SearchKindRequest }
> = {
  person: {
    browse: async (client, input, signal) => {
      const result = await client.GET("/users", {
        params: {
          query: {
            is_service_account: input.serviceAccountsOnly || undefined,
            limit: input.limit,
          },
        },
        signal,
      })
      if (!result.data) throw new Error("people browse failed")
      return {
        items: result.data.items.map(personResult),
        total: result.data.total ?? null,
      }
    },
    search: async (client, input, signal) => {
      const result = await client.GET("/users/search", {
        params: {
          query: {
            is_service_account: input.serviceAccountsOnly || undefined,
            limit: input.limit,
            q: input.query,
          },
        },
        signal,
      })
      if (!result.data) throw new Error("people search failed")
      const items = result.data.map(personResult)
      return { items, total: items.length }
    },
  },
  project: {
    browse: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/projects", {
            params: { query: { limit: input.limit } },
            signal,
          })
        ).data,
        "project browse failed",
        projectResult
      ),
    search: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/projects/search", {
            params: {
              query: {
                affiliation:
                  input.affiliation === "owner" ? ["owner"] : undefined,
                limit: input.limit,
                q: input.query,
              },
            },
            signal,
          })
        ).data,
        "project search failed",
        projectResult
      ),
  },
  instrument: {
    browse: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/instruments", {
            params: { query: { limit: input.limit } },
            signal,
          })
        ).data,
        "instrument browse failed",
        instrumentResult
      ),
    search: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/instruments/search", {
            params: {
              query: {
                affiliation:
                  input.affiliation === "owner" ? ["owner"] : undefined,
                include_owner: false,
                limit: input.limit,
                q: input.query,
              },
            },
            signal,
          })
        ).data,
        "instrument search failed",
        instrumentResult
      ),
  },
  sample: {
    browse: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/samples", {
            params: {
              query: {
                limit: input.limit,
                project_mfid: input.projectMfid,
                project_scope: input.projectMfid ? "all" : undefined,
              },
            },
            signal,
          })
        ).data,
        "sample browse failed",
        sampleResult
      ),
    search: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/samples/search", {
            params: {
              query: {
                affiliation: input.affiliation
                  ? [input.affiliation]
                  : undefined,
                limit: input.limit,
                project_mfid: input.projectMfid,
                project_scope: input.projectMfid ? "all" : undefined,
                q: input.query,
              },
            },
            signal,
          })
        ).data,
        "sample search failed",
        sampleResult
      ),
  },
  dataset: {
    browse: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/datasets", {
            params: {
              query: {
                limit: input.limit,
                project_mfid: input.projectMfid,
                project_scope: input.projectMfid ? "all" : undefined,
              },
            },
            signal,
          })
        ).data,
        "dataset browse failed",
        datasetResult
      ),
    search: async (client, input, signal) =>
      searchOutcome(
        (
          await client.GET("/datasets/search", {
            params: {
              query: {
                affiliation: input.affiliation
                  ? [input.affiliation]
                  : undefined,
                limit: input.limit,
                project_mfid: input.projectMfid,
                project_scope: input.projectMfid ? "all" : undefined,
                q: input.query,
              },
            },
            signal,
          })
        ).data,
        "dataset search failed",
        datasetResult
      ),
  },
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

  const isBrowse = !input.query.trim()
  if (!isBrowse && input.query.trim().length < 3) {
    return {
      groups: input.kinds.map((kind) => group(kind, [])),
      query: input.query,
    }
  }
  const client = createCrucibleClient(configuration)
  const signal = crucibleRequestSignal(requestSignal)
  const requests = input.kinds.map(async (kind) => {
    const spec = kindSearches[kind]
    const outcome = isBrowse
      ? await spec.browse(client, input, signal)
      : await spec.search(client, input, signal)
    return group(kind, outcome.items, outcome.total)
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
    params: {
      query: {
        affiliation: input.affiliation ? [input.affiliation] : undefined,
        limit: input.limit,
        q: input.query,
      },
    },
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
        name: resourceDisplayName(kind, resource.name, {
          mfid: resource.unique_id,
        }),
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
