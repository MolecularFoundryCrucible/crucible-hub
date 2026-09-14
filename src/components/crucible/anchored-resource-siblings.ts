import type { QueryClient } from "@tanstack/react-query"

import type {
  ResourceSibling,
  ResourceSiblingCollection,
  ResourceSiblingConfiguration,
} from "@/components/crucible/resource-sibling-navigation"
import { resourceSiblingSequenceLabel } from "@/components/crucible/resource-sibling-navigation"
import {
  datasetsAnchorQueryOptions,
  datasetsQueryOptions,
  samplesAnchorQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import type {
  AnchoredDatasetFilters,
  AnchoredSampleFilters,
} from "@/data/crucible/data.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceCursorPage,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"

const siblingPageLimit = 25

type Resource = Extract<WorkspaceResourceDetail, { kind: "dataset" | "sample" }>

export async function createAnchoredResourceSiblingCollection({
  configuration,
  queryClient,
  resource,
  scope,
}: {
  configuration: ResourceSiblingConfiguration
  queryClient: QueryClient
  resource: Resource
  scope: IdentityScope
}): Promise<ResourceSiblingCollection> {
  if (resource.kind === "sample") {
    const anchoredFilters = sampleFilters(resource, configuration)
    const { anchorMfid, ...filters } = anchoredFilters
    return createAnchoredCollection({
      anchorMfid,
      configuration,
      fetchAnchor: (direction) =>
        queryClient.fetchQuery(
          samplesAnchorQueryOptions(scope, {
            ...filters,
            anchorMfid,
            direction,
            includeTotal: false,
          })
        ),
      fetchCursor: (direction, cursor) =>
        queryClient.fetchQuery(
          samplesQueryOptions(scope, {
            ...filters,
            cursor,
            direction,
            includeTotal: false,
          })
        ),
      kind: "sample",
      label: resourceSiblingSequenceLabel({
        filters,
        kind: "sample",
        scope:
          configuration.scope === "project"
            ? "project"
            : configuration.scope === "owner"
              ? "owner"
              : undefined,
      }),
      mapName: (sample) => sample.sample_name,
    })
  }

  const anchoredFilters = datasetFilters(resource, configuration)
  const { anchorMfid, ...filters } = anchoredFilters
  return createAnchoredCollection({
    anchorMfid,
    configuration,
    fetchAnchor: (direction) =>
      queryClient.fetchQuery(
        datasetsAnchorQueryOptions(scope, {
          ...filters,
          anchorMfid,
          direction,
          includeTotal: false,
        })
      ),
    fetchCursor: (direction, cursor) =>
      queryClient.fetchQuery(
        datasetsQueryOptions(scope, {
          ...filters,
          cursor,
          direction,
          includeTotal: false,
        })
      ),
    kind: "dataset",
    label: resourceSiblingSequenceLabel({
      filters,
      kind: "dataset",
      scope:
        configuration.scope === "project"
          ? "project"
          : configuration.scope === "instrument"
            ? "instrument"
            : configuration.scope === "owner"
              ? "owner"
              : undefined,
    }),
    mapName: (dataset) => dataset.dataset_name ?? "Untitled dataset",
  })
}

function sampleFilters(
  resource: Extract<Resource, { kind: "sample" }>,
  configuration: ResourceSiblingConfiguration
): AnchoredSampleFilters {
  const base = {
    anchorMfid: resource.unique_id,
    direction: configuration.direction,
    limit: siblingPageLimit,
    sort: configuration.sort,
  } satisfies AnchoredSampleFilters
  if (configuration.scope === "project") {
    if (!resource.project) throw new Error("This sample has no project.")
    return {
      ...base,
      projectMfid: resource.project.unique_id,
      projectScope: "assigned",
    }
  }
  if (configuration.scope === "owner") {
    if (!resource.owner) throw new Error("This sample has no readable owner.")
    return { ...base, ownerId: resource.owner.unique_id }
  }
  if (configuration.scope === "subtype") {
    return resource.sample_type === null
      ? { ...base, sampleTypeIsNull: true }
      : { ...base, sampleType: resource.sample_type }
  }
  if (configuration.scope === "instrument") {
    throw new Error("Samples cannot be scoped by instrument.")
  }
  return base
}

function datasetFilters(
  resource: Extract<Resource, { kind: "dataset" }>,
  configuration: ResourceSiblingConfiguration
): AnchoredDatasetFilters {
  const base = {
    anchorMfid: resource.unique_id,
    direction: configuration.direction,
    limit: siblingPageLimit,
    sort: configuration.sort,
  } satisfies AnchoredDatasetFilters
  if (configuration.scope === "project") {
    if (!resource.project) throw new Error("This dataset has no project.")
    return {
      ...base,
      projectMfid: resource.project.unique_id,
      projectScope: "assigned",
    }
  }
  if (configuration.scope === "owner") {
    if (!resource.owner) throw new Error("This dataset has no readable owner.")
    return { ...base, ownerId: resource.owner.unique_id }
  }
  if (configuration.scope === "subtype") {
    return resource.measurement === null
      ? { ...base, measurementIsNull: true }
      : { ...base, measurement: resource.measurement }
  }
  if (configuration.scope === "instrument") {
    return resource.instrument === null
      ? { ...base, instrumentMfidIsNull: true }
      : { ...base, instrumentMfid: resource.instrument.unique_id }
  }
  return base
}

async function createAnchoredCollection<TItem extends { unique_id: string }>({
  anchorMfid,
  configuration,
  fetchAnchor,
  fetchCursor,
  kind,
  label,
  mapName,
}: {
  anchorMfid: string
  configuration: ResourceSiblingConfiguration
  fetchAnchor: (
    direction: ResourceSiblingConfiguration["direction"]
  ) => Promise<WorkspaceCursorPage<TItem>>
  fetchCursor: (
    direction: ResourceSiblingConfiguration["direction"],
    cursor: string
  ) => Promise<WorkspaceCursorPage<TItem>>
  kind: "dataset" | "sample"
  label: string
  mapName: (item: TItem) => string
}) {
  const oppositeDirection = configuration.direction === "asc" ? "desc" : "asc"
  const [nextPage, previousPage] = await Promise.all([
    fetchAnchor(configuration.direction),
    fetchAnchor(oppositeDirection),
  ])
  if (
    nextPage.items[0]?.unique_id !== anchorMfid ||
    previousPage.items[0]?.unique_id !== anchorMfid
  ) {
    throw new Error("The anchored collection did not start at its anchor.")
  }
  let nextCursor = nextPage.nextCursor
  let previousCursor = previousPage.nextCursor
  let items = uniqueSiblings([
    ...mapSiblings([...previousPage.items.slice(1)].reverse(), kind, mapName),
    ...mapSiblings(nextPage.items, kind, mapName),
  ])
  function currentPage() {
    return {
      hasNextPage: Boolean(nextCursor),
      hasPreviousPage: Boolean(previousCursor),
      items,
    }
  }

  return {
    ...currentPage(),
    anchorMfid,
    configuration,
    label,
    loadNext: async () => {
      if (!nextCursor) return currentPage()
      const page = await fetchCursor(configuration.direction, nextCursor)
      nextCursor = page.nextCursor
      items = uniqueSiblings([
        ...items,
        ...mapSiblings(page.items, kind, mapName),
      ])
      return currentPage()
    },
    loadPrevious: async () => {
      if (!previousCursor) return currentPage()
      const page = await fetchCursor(oppositeDirection, previousCursor)
      previousCursor = page.nextCursor
      items = uniqueSiblings([
        ...mapSiblings([...page.items].reverse(), kind, mapName),
        ...items,
      ])
      return currentPage()
    },
  } satisfies ResourceSiblingCollection
}

function mapSiblings<TItem extends { unique_id: string }>(
  items: readonly TItem[],
  kind: "dataset" | "sample",
  mapName: (item: TItem) => string
): ResourceSibling[] {
  return items.map((item) => ({
    kind,
    mfid: item.unique_id,
    name: mapName(item),
  }))
}

function uniqueSiblings(items: readonly ResourceSibling[]) {
  return Array.from(
    new Map(items.map((item) => [`${item.kind}:${item.mfid}`, item])).values()
  )
}
