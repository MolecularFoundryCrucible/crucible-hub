import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { createFileRoute } from "@tanstack/react-router"
import {
  datasetFiltersForGroup,
  projectDatasetBrowseOptions,
  projectSampleBrowseOptions,
  resolveCollectionBrowse,
  sampleFiltersForGroup,
} from "@/data/crucible/collection-browse"
import { resolveProjectDataFilters } from "@/features/project-data/project-data-filter-state"
import {
  dataPageLimit,
  datasetsCursorQueryOptions,
  samplesCursorQueryOptions,
} from "@/data/crucible/data.queries"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  ProjectDataPending,
  ProjectDataPage,
} from "@/features/project-data/project-data-page"
import { projectDataSearchSchema } from "@/features/project-data/project-data-search"

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
