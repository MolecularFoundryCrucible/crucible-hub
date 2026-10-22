import { publicDataSearchSchema } from "@/data/crucible/public-data"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { useIncludePublicByDefault } from "@/features/preferences/public-data"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"

import {
  collectionBrowseSearchFields,
  datasetFiltersForGroup,
  projectDatasetBrowseOptions,
  projectSampleBrowseOptions,
  resolveCollectionBrowse,
  sampleFiltersForGroup,
} from "@/data/crucible/collection-browse"
import {
  ResourcePreviewContext,
  resourcePreviewSearchSchema,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import {
  ProjectDataCollection,
  ProjectDataCollectionPending,
} from "@/features/project-data/project-data-collection"
import type { ProjectDataKind } from "@/features/project-data/project-data-collection"
import { resolveProjectDataFilters } from "@/features/project-data/project-data-filter-state"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import {
  collectionCursorSchema,
  resourceSortSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import {
  dataPageLimit,
  datasetsCursorQueryOptions,
  samplesCursorQueryOptions,
} from "@/data/crucible/data.queries"
import type { ProjectScope } from "@/data/crucible/data.queries"
import { facetFilterSearchFields } from "@/data/crucible/facet-filter-search"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  useDataGroupBy,
  useDefaultSort,
} from "@/features/preferences/data-group-by"

const filterSearchValue = z.string().max(255).optional().catch("")
const selectedFacetSchema = z
  .union([z.literal(true), z.literal("true")])
  .transform(() => true as const)
  .optional()
  .catch(undefined)
const projectDataSearchSchema = resourcePreviewSearchSchema.extend({
  ...collectionBrowseSearchFields,
  ...facetFilterSearchFields,
  createdFrom: filterSearchValue,
  createdTo: filterSearchValue,
  direction: sortDirectionSchema.optional().catch(undefined),
  instrumentMfid: filterSearchValue,
  instrumentMfidIsNull: selectedFacetSchema,
  kind: z.enum(["samples", "datasets"]).optional().catch(undefined),
  scope: z.enum(["all", "assigned", "shared"]).optional().catch(undefined),
  sampleCursor: collectionCursorSchema,
  datasetCursor: collectionCursorSchema,
  publicData: publicDataSearchSchema.optional().catch(undefined),
  sort: resourceSortSchema.optional().catch(undefined),
  visibility: filterSearchValue,
})

const projectRoute = getRouteApi("/_app/projects/$projectMfid")

export const Route = createFileRoute("/_app/projects/$projectMfid/")({
  validateSearch: projectDataSearchSchema,
  staleTime: Infinity,
  loaderDeps: ({ search }) => ({
    datasetCursor: search.datasetCursor,
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    dataFormat: search.dataFormat,
    dataFormatIsNull: search.dataFormatIsNull,
    dataFormatSet: search.dataFormatSet,
    direction: search.direction,
    groupBy: search.groupBy,
    groupValue: search.groupValue,
    groupValueIsNull: search.groupValueIsNull,
    groupValueSet: search.groupValueSet,
    instrumentMfid: search.instrumentMfid,
    instrumentMfidIsNull: search.instrumentMfidIsNull,
    kind: search.kind ?? "samples",
    measurement: search.measurement,
    measurementIsNull: search.measurementIsNull,
    measurementSet: search.measurementSet,
    ownerId: search.ownerId,
    ownerIdIsNull: search.ownerIdIsNull,
    ownerIdSet: search.ownerIdSet,
    projectScope: search.scope ?? "all",
    publicData: search.publicData,
    sampleCursor: search.sampleCursor,
    sampleType: search.sampleType,
    sampleTypeIsNull: search.sampleTypeIsNull,
    sampleTypeSet: search.sampleTypeSet,
    sessionName: search.sessionName,
    sessionNameIsNull: search.sessionNameIsNull,
    sessionNameSet: search.sessionNameSet,
    sort: search.sort,
    visibility: search.visibility,
    view: search.view,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    if (cause === "stay") return
    const project = (await parentMatchPromise).loaderData
    if (!project?.isProject || !project.projectMfid) return
    const resolution = resolveProjectDataFilters(
      deps,
      deps.kind,
      project.defaultSort?.data,
      {
        elevated: privilegeModeFromScope(project.scope) === "elevated",
        includePublicByDefault: project.includePublicByDefault,
      }
    )
    if (!resolution.valid) return
    if (deps.kind === "samples") {
      const browse = resolveCollectionBrowse(
        deps,
        projectSampleBrowseOptions,
        project.dataGroupBy?.samples
      )
      if (browse.view === "grouped" && browse.selection.kind === "all") return
      const filters =
        browse.view === "grouped"
          ? sampleFiltersForGroup(
              resolution.filters,
              browse.field,
              browse.selection
            )
          : resolution.filters
      const options = samplesCursorQueryOptions(project.scope, {
        cursor: deps.sampleCursor,
        limit: dataPageLimit,
        projectMfid: project.projectMfid,
        projectScope: deps.projectScope,
        ...filters,
      })
      await prefetchInfiniteQueryWithReadableCache(context.queryClient, options)
      return
    }

    const browse = resolveCollectionBrowse(
      deps,
      projectDatasetBrowseOptions,
      project.dataGroupBy?.datasets
    )
    if (browse.view === "grouped" && browse.selection.kind === "all") return
    const filters =
      browse.view === "grouped"
        ? datasetFiltersForGroup(
            resolution.filters,
            browse.field,
            browse.selection
          )
        : resolution.filters
    const options = datasetsCursorQueryOptions(project.scope, {
      cursor: deps.datasetCursor,
      limit: dataPageLimit,
      projectMfid: project.projectMfid,
      projectScope: deps.projectScope,
      ...filters,
    })
    await prefetchInfiniteQueryWithReadableCache(context.queryClient, options)
  },
  pendingComponent: ProjectDataPending,
  component: ProjectDataPage,
  remountDeps: ({ params }) => ({ projectMfid: params.projectMfid }),
})

function projectDataFilterValues(
  search: z.infer<typeof projectDataSearchSchema>
) {
  return {
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    dataFormat: search.dataFormat,
    dataFormatIsNull: search.dataFormatIsNull,
    dataFormatSet: search.dataFormatSet,
    direction: search.direction,
    instrumentMfid: search.instrumentMfid,
    instrumentMfidIsNull: search.instrumentMfidIsNull,
    measurement: search.measurement,
    measurementIsNull: search.measurementIsNull,
    measurementSet: search.measurementSet,
    ownerId: search.ownerId,
    ownerIdIsNull: search.ownerIdIsNull,
    ownerIdSet: search.ownerIdSet,
    sampleType: search.sampleType,
    sampleTypeIsNull: search.sampleTypeIsNull,
    sampleTypeSet: search.sampleTypeSet,
    sessionName: search.sessionName,
    sessionNameIsNull: search.sessionNameIsNull,
    sessionNameSet: search.sessionNameSet,
    publicData: search.publicData,
    sort: search.sort,
    visibility: search.visibility,
  }
}

function ProjectDataPending() {
  const search = Route.useSearch()
  const { projectMfid } = Route.useParams()
  const kind: ProjectDataKind = search.kind ?? "samples"
  const projectScope: ProjectScope = search.scope ?? "all"
  const filterValues = projectDataFilterValues(search)
  const filterResolution = resolveProjectDataFilters(filterValues, kind)
  return (
    <ProjectDataCollectionPending
      browseSearch={search}
      filterResolution={filterResolution}
      filterValues={filterValues}
      kind={kind}
      projectMfid={projectMfid}
      projectScope={projectScope}
    />
  )
}

function ProjectDataPage() {
  const search = Route.useSearch()
  const { projectMfid } = Route.useParams()
  const project = projectRoute.useLoaderData()
  const dataGroupBy = useDataGroupBy(project?.dataGroupBy)
  const defaultSort = useDefaultSort(project?.defaultSort)
  const includePublicByDefault = useIncludePublicByDefault(
    project?.includePublicByDefault
  )
  const scope = useWorkspaceScope()
  const navigation = useResourcePreviewNavigation({
    kind: "project-data",
    preview: search.preview,
    projectMfid: project?.isProject ? project.projectMfid : projectMfid,
  })
  if (!project?.isProject) return null

  const kind: ProjectDataKind = search.kind ?? "samples"
  const projectScope: ProjectScope = search.scope ?? "all"
  const filterValues = projectDataFilterValues(search)
  const filterResolution = resolveProjectDataFilters(
    filterValues,
    kind,
    defaultSort?.data,
    {
      elevated: privilegeModeFromScope(scope) === "elevated",
      includePublicByDefault,
    }
  )
  return (
    <ResourcePreviewContext.Provider value={navigation}>
      <ProjectDataCollection
        browseSearch={search}
        cursor={kind === "samples" ? search.sampleCursor : search.datasetCursor}
        dataGroupBy={dataGroupBy}
        defaultOrdering={defaultSort?.data}
        filterResolution={filterResolution}
        filterValues={filterValues}
        kind={kind}
        projectMfid={project.projectMfid}
        projectScope={projectScope}
      />
      <ResourceInspector navigation={navigation} />
    </ResourcePreviewContext.Provider>
  )
}
