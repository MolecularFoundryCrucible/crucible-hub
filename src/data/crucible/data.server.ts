import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { CollectionFilters } from "./collection-filters"
import { normalizeCollectionFilters } from "./collection-filters"
import type { CollectionQueryOptions, ResourceSort } from "./collection-query"
import { normalizeCollectionQueryOptions } from "./collection-query"
import { fixtureCursorPage, fixtureResourcePageLimit } from "./pagination"
import {
  normalizeDatasetFacetFilters,
  normalizeSampleFacetFilters,
} from "./facets"
import type {
  DatasetFacetField,
  DatasetFacetFilters,
  SampleFacetField,
  SampleFacetFilters,
  WorkspaceFacetBucket,
  WorkspaceFacetPage,
} from "./facets"
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

type ProjectScopedInput = CollectionFilters &
  CollectionQueryOptions & {
    projectMfid?: string
    projectMfidIsNull?: true
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
    is_service_account: owner.is_service_account === true,
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
    data_format: dataset.data_format,
    session_name: dataset.session_name,
    timestamp: dataset.timestamp,
    creation_time: dataset.creation_time,
    modification_time: dataset.modification_time,
    owner: safeOwner(dataset.owner),
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

function matchesFacetValue(
  value: string | null | undefined,
  selected: string | undefined,
  isNull: true | undefined
) {
  if (selected !== undefined) return value === selected
  if (isNull) return value == null
  return true
}

function fixtureSampleFacetRows(
  items: readonly WorkspaceSample[],
  input: SampleFacetFilters
) {
  const filters = normalizeSampleFacetFilters(input)
  return items.filter(
    (item) =>
      matchesFacetValue(
        item.sample_type,
        filters.sampleType,
        filters.sampleTypeIsNull
      ) &&
      matchesFacetValue(
        item.owner?.unique_id,
        filters.ownerId,
        filters.ownerIdIsNull
      )
  )
}

function fixtureDatasetFacetRows(
  items: readonly WorkspaceDataset[],
  input: DatasetFacetFilters
) {
  const filters = normalizeDatasetFacetFilters(input)
  return items.filter(
    (item) =>
      matchesFacetValue(
        item.data_format,
        filters.dataFormat,
        filters.dataFormatIsNull
      ) &&
      matchesFacetValue(
        item.measurement,
        filters.measurement,
        filters.measurementIsNull
      ) &&
      matchesFacetValue(
        item.session_name,
        filters.sessionName,
        filters.sessionNameIsNull
      ) &&
      matchesFacetValue(
        item.owner?.unique_id,
        filters.ownerId,
        filters.ownerIdIsNull
      ) &&
      (!filters.instrumentMfidIsNull || item.instrument == null)
  )
}

function facetBuckets(values: readonly (string | null | undefined)[]) {
  const counts = new Map<string | null, number>()
  for (const value of values) {
    const normalized = value ?? null
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => {
      if (left === null && right === null) return 0
      if (left === null) return 1
      if (right === null) return -1
      return left.localeCompare(right)
    })
    .map(([value, count]): WorkspaceFacetBucket => ({ count, value }))
}

function resolvedFacetBuckets<TItem, TReference>(
  items: readonly TItem[],
  value: (item: TItem) => string | null | undefined,
  reference: (item: TItem) => TReference | null | undefined,
  key: "instrument" | "owner" | "project"
): WorkspaceFacetBucket[] {
  return facetBuckets(items.map(value)).map((bucket) => {
    const item = items.find(
      (candidate) => (value(candidate) ?? null) === bucket.value
    )
    return {
      ...bucket,
      [key]: item ? (reference(item) ?? null) : null,
    }
  })
}

function toWorkspaceFacetPage(
  response: Schema<"FacetResponse">,
  field: DatasetFacetField | SampleFacetField
): WorkspaceFacetPage {
  if (response.field !== field) {
    throw new Error("The facet response field does not match the request.")
  }
  return {
    field,
    items: response.items.map((item) => ({
      count: item.count,
      ...("instrument" in item ? { instrument: item.instrument } : {}),
      ...("owner" in item ? { owner: safeOwner(item.owner) } : {}),
      ...("project" in item ? { project: item.project } : {}),
      value: item.value,
    })),
    limit: response.limit,
    nextCursor: response.next_cursor ?? null,
  }
}

function fixtureFacetPage(
  buckets: readonly WorkspaceFacetBucket[],
  input: { cursor?: string; limit: number },
  field: DatasetFacetField | SampleFacetField
): WorkspaceFacetPage {
  const page = fixtureCursorPage(buckets, input)
  return {
    field,
    items: page.items,
    limit: page.limit,
    nextCursor: page.nextCursor,
  }
}

function sampleFacetQuery(filters: SampleFacetFilters) {
  const normalized = normalizeSampleFacetFilters(filters)
  return {
    owner_id: normalized.ownerId,
    owner_id_is_null: normalized.ownerIdIsNull,
    sample_type: normalized.sampleType,
    sample_type_is_null: normalized.sampleTypeIsNull,
  }
}

function datasetFacetQuery(filters: DatasetFacetFilters) {
  const normalized = normalizeDatasetFacetFilters(filters)
  return {
    data_format: normalized.dataFormat,
    data_format_is_null: normalized.dataFormatIsNull,
    instrument_mfid_is_null: normalized.instrumentMfidIsNull,
    measurement: normalized.measurement,
    measurement_is_null: normalized.measurementIsNull,
    owner_id: normalized.ownerId,
    owner_id_is_null: normalized.ownerIdIsNull,
    session_name: normalized.sessionName,
    session_name_is_null: normalized.sessionNameIsNull,
  }
}

function fixtureQueryRows<
  TItem extends {
    creation_time?: string | null
    modification_time?: string | null
    owner: WorkspacePerson | null
    unique_id: string
  },
>(
  items: readonly TItem[],
  input: CollectionQueryOptions,
  accountMfid: string,
  name: (item: TItem) => string
) {
  const options = normalizeCollectionQueryOptions(input)
  const affiliated = options.affiliation
    ? items.filter((item) => item.owner?.unique_id === accountMfid)
    : items
  if (!options.sort) {
    return [...affiliated].sort((left, right) =>
      right.unique_id.localeCompare(left.unique_id)
    )
  }
  const sort = options.sort
  const direction = options.direction === "asc" ? 1 : -1
  return [...affiliated].sort((left, right) => {
    const leftValue = fixtureSortValue(left, sort, name)
    const rightValue = fixtureSortValue(right, sort, name)
    if (leftValue === null && rightValue !== null) return 1
    if (leftValue !== null && rightValue === null) return -1
    if (leftValue !== rightValue) {
      return String(leftValue).localeCompare(String(rightValue)) * direction
    }
    return left.unique_id.localeCompare(right.unique_id) * direction
  })
}

function fixtureSortValue<
  TItem extends {
    creation_time?: string | null
    modification_time?: string | null
  },
>(item: TItem, sort: ResourceSort, name: (item: TItem) => string) {
  if (sort === "name") return name(item).toLocaleLowerCase()
  if (sort === "created") return item.creation_time ?? null
  return item.modification_time ?? item.creation_time ?? null
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
  if (input.projectMfidIsNull) {
    return items
      .filter((item) => item.project == null && item.project_id == null)
      .map((item) => ({ ...item, project_relation: null }))
  }
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
  } & ProjectScopedInput &
    SampleFacetFilters,
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
    return fixtureCursorPage(
      fixtureQueryRows(
        fixtureSampleFacetRows(
          fixtureCollectionRows(projectSamples, input),
          input
        ),
        input,
        workspace.account.unique_id,
        (sample) => sample.sample_name
      ),
      { ...input, limit: Math.min(input.limit, fixtureResourcePageLimit) }
    )
  }

  const projectScope = normalizedProjectScope(input)
  const collectionFilters = normalizeCollectionFilters(input)
  const collectionQuery = normalizeCollectionQueryOptions(input)
  const client = createCrucibleClient(configuration)
  const result = await client.GET("/samples", {
    params: {
      query: {
        affiliation: collectionQuery.affiliation
          ? [collectionQuery.affiliation]
          : undefined,
        cursor: input.cursor,
        direction: collectionQuery.direction,
        include_owner: true,
        include_total: true,
        limit: input.limit,
        project_mfid: input.projectMfid,
        project_mfid_is_null: input.projectMfidIsNull,
        project_scope: projectScope,
        ...sampleFacetQuery(input),
        sort: collectionQuery.sort,
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
  } & ProjectScopedInput &
    DatasetFacetFilters,
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
    return fixtureCursorPage(
      fixtureQueryRows(
        fixtureDatasetFacetRows(
          fixtureCollectionRows(filteredDatasets, input),
          input
        ),
        input,
        workspace.account.unique_id,
        (dataset) => dataset.dataset_name ?? ""
      ),
      { ...input, limit: Math.min(input.limit, fixtureResourcePageLimit) }
    )
  }

  const projectScope = normalizedProjectScope(input)
  const collectionFilters = normalizeCollectionFilters(input)
  const collectionQuery = normalizeCollectionQueryOptions(input)
  const client = createCrucibleClient(configuration)
  const result = await client.GET("/datasets", {
    params: {
      query: {
        affiliation: collectionQuery.affiliation
          ? [collectionQuery.affiliation]
          : undefined,
        cursor: input.cursor,
        direction: collectionQuery.direction,
        include_owner: true,
        include_total: true,
        instrument_mfid: instrumentMfid,
        limit: input.limit,
        project_mfid: input.projectMfid,
        project_mfid_is_null: input.projectMfidIsNull,
        project_scope: projectScope,
        ...datasetFacetQuery(input),
        sort: collectionQuery.sort,
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

type FacetContextInput = ProjectScopedInput & {
  cursor?: string
  limit: number
}

export async function readWorkspaceSampleFacets(
  input: FacetContextInput & SampleFacetFilters & { field: SampleFacetField },
  requestSignal?: AbortSignal
): Promise<WorkspaceFacetPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(input.scenario)
    const samples = fixtureSampleFacetRows(
      fixtureCollectionRows(
        fixtureProjectRows(
          workspace.samples,
          input,
          "samples",
          workspace.projects
        ),
        input
      ),
      input
    )
    const buckets =
      input.field === "owner"
        ? resolvedFacetBuckets(
            samples,
            (sample) => sample.owner?.unique_id,
            (sample) => sample.owner,
            "owner"
          )
        : input.field === "project"
          ? resolvedFacetBuckets(
              samples,
              (sample) => sample.project?.unique_id,
              (sample) => sample.project,
              "project"
            )
          : facetBuckets(samples.map((sample) => sample.sample_type))
    return fixtureFacetPage(buckets, input, input.field)
  }

  const filters = normalizeCollectionFilters(input)
  const query = normalizeCollectionQueryOptions(input)
  const result = await createCrucibleClient(configuration).GET(
    "/samples/facets",
    {
      params: {
        query: {
          affiliation: query.affiliation ? [query.affiliation] : undefined,
          cursor: input.cursor,
          field: input.field,
          limit: input.limit,
          project_mfid: input.projectMfid,
          project_mfid_is_null: input.projectMfidIsNull,
          project_scope: normalizedProjectScope(input),
          visibility: filters.visibility,
          ...creationTimeBounds(filters),
          ...sampleFacetQuery(input),
        },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceFacetPage(result.data, input.field)
}

export async function readWorkspaceDatasetFacets(
  input: FacetContextInput &
    DatasetFacetFilters & {
      field: DatasetFacetField
      instrumentMfid?: string
    },
  requestSignal?: AbortSignal
): Promise<WorkspaceFacetPage> {
  const instrumentMfid = normalizedInstrumentMfid(input.instrumentMfid)
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(input.scenario)
    const datasets = fixtureDatasetFacetRows(
      fixtureCollectionRows(
        fixtureProjectRows(
          instrumentMfid
            ? workspace.datasets.filter(
                (dataset) => dataset.instrument?.unique_id === instrumentMfid
              )
            : workspace.datasets,
          input,
          "datasets",
          workspace.projects
        ),
        input
      ),
      input
    )
    const buckets =
      input.field === "owner"
        ? resolvedFacetBuckets(
            datasets,
            (dataset) => dataset.owner?.unique_id,
            (dataset) => dataset.owner,
            "owner"
          )
        : input.field === "instrument"
          ? resolvedFacetBuckets(
              datasets,
              (dataset) => dataset.instrument?.unique_id,
              (dataset) => dataset.instrument,
              "instrument"
            )
          : input.field === "project"
            ? resolvedFacetBuckets(
                datasets,
                (dataset) => dataset.project?.unique_id,
                (dataset) => dataset.project,
                "project"
              )
            : facetBuckets(
                datasets.map((dataset) =>
                  input.field === "session"
                    ? dataset.session_name
                    : input.field === "measurement"
                      ? dataset.measurement
                      : dataset.data_format
                )
              )
    return fixtureFacetPage(buckets, input, input.field)
  }

  const filters = normalizeCollectionFilters(input)
  const query = normalizeCollectionQueryOptions(input)
  const result = await createCrucibleClient(configuration).GET(
    "/datasets/facets",
    {
      params: {
        query: {
          affiliation: query.affiliation ? [query.affiliation] : undefined,
          cursor: input.cursor,
          field: input.field,
          instrument_mfid: instrumentMfid,
          limit: input.limit,
          project_mfid: input.projectMfid,
          project_mfid_is_null: input.projectMfidIsNull,
          project_scope: normalizedProjectScope(input),
          visibility: filters.visibility,
          ...creationTimeBounds(filters),
          ...datasetFacetQuery(input),
        },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceFacetPage(result.data, input.field)
}
