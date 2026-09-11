import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"

import { CollectionTablePending } from "@/components/crucible/collection-state"
import {
  ResourcePreviewContext,
  resourcePreviewSearchSchema,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { ProjectDataCollection } from "@/features/project-data/project-data-collection"
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
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import type { ProjectScope } from "@/data/crucible/data.queries"

const filterSearchValue = z.string().max(255).optional().catch("")
const facetSearchValue = z.string().max(255).optional().catch(undefined)
const selectedFacetSchema = z
  .union([z.literal(true), z.literal("true")])
  .transform(() => true as const)
  .optional()
  .catch(undefined)
const projectDataSearchSchema = resourcePreviewSearchSchema.extend({
  createdFrom: filterSearchValue,
  createdTo: filterSearchValue,
  dataFormat: facetSearchValue,
  dataFormatIsNull: selectedFacetSchema,
  dataFormatSet: selectedFacetSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  instrumentMfid: filterSearchValue,
  kind: z.enum(["samples", "datasets"]).optional().catch(undefined),
  measurement: facetSearchValue,
  measurementIsNull: selectedFacetSchema,
  measurementSet: selectedFacetSchema,
  scope: z.enum(["all", "assigned", "shared"]).optional().catch(undefined),
  sampleCursor: collectionCursorSchema,
  datasetCursor: collectionCursorSchema,
  sampleType: facetSearchValue,
  sampleTypeIsNull: selectedFacetSchema,
  sampleTypeSet: selectedFacetSchema,
  sessionName: facetSearchValue,
  sessionNameIsNull: selectedFacetSchema,
  sessionNameSet: selectedFacetSchema,
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
    instrumentMfid: search.instrumentMfid,
    kind: search.kind ?? "samples",
    measurement: search.measurement,
    measurementIsNull: search.measurementIsNull,
    measurementSet: search.measurementSet,
    projectScope: search.scope ?? "all",
    sampleCursor: search.sampleCursor,
    sampleType: search.sampleType,
    sampleTypeIsNull: search.sampleTypeIsNull,
    sampleTypeSet: search.sampleTypeSet,
    sessionName: search.sessionName,
    sessionNameIsNull: search.sessionNameIsNull,
    sessionNameSet: search.sessionNameSet,
    sort: search.sort,
    visibility: search.visibility,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    if (cause === "stay") return
    const project = (await parentMatchPromise).loaderData
    if (!project?.isProject || !project.projectMfid) return
    const resolution = resolveProjectDataFilters(deps, deps.kind)
    if (!resolution.valid) return

    if (deps.kind === "samples") {
      const options = samplesQueryOptions(project.scope, {
        cursor: deps.sampleCursor,
        limit: dataPageLimit,
        projectMfid: project.projectMfid,
        projectScope: deps.projectScope,
        ...resolution.filters,
      })
      const hasData =
        context.queryClient.getQueryData(options.queryKey) !== undefined
      const request = context.queryClient.prefetchQuery(options)
      if (hasData) {
        void request
        return
      }
      await request
      return
    }

    const options = datasetsQueryOptions(project.scope, {
      cursor: deps.datasetCursor,
      limit: dataPageLimit,
      projectMfid: project.projectMfid,
      projectScope: deps.projectScope,
      ...resolution.filters,
    })
    const hasData =
      context.queryClient.getQueryData(options.queryKey) !== undefined
    const request = context.queryClient.prefetchQuery(options)
    if (hasData) {
      void request
      return
    }
    await request
  },
  pendingComponent: ProjectDataPending,
  component: ProjectDataPage,
})

function ProjectDataPending() {
  return <CollectionTablePending label="project data" />
}

function ProjectDataPage() {
  const search = Route.useSearch()
  const { projectMfid } = Route.useParams()
  const project = projectRoute.useLoaderData()
  const navigation = useResourcePreviewNavigation({
    kind: "project-data",
    preview: search.preview,
    projectMfid: project?.isProject ? project.projectMfid : projectMfid,
  })
  if (!project?.isProject) return null

  const kind: ProjectDataKind = search.kind ?? "samples"
  const projectScope: ProjectScope = search.scope ?? "all"
  const filterValues = {
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    dataFormat: search.dataFormat,
    dataFormatIsNull: search.dataFormatIsNull,
    dataFormatSet: search.dataFormatSet,
    direction: search.direction,
    instrumentMfid: search.instrumentMfid,
    measurement: search.measurement,
    measurementIsNull: search.measurementIsNull,
    measurementSet: search.measurementSet,
    sampleType: search.sampleType,
    sampleTypeIsNull: search.sampleTypeIsNull,
    sampleTypeSet: search.sampleTypeSet,
    sessionName: search.sessionName,
    sessionNameIsNull: search.sessionNameIsNull,
    sessionNameSet: search.sessionNameSet,
    sort: search.sort,
    visibility: search.visibility,
  }
  const filterResolution = resolveProjectDataFilters(filterValues, kind)
  return (
    <ResourcePreviewContext.Provider value={navigation}>
      <ProjectDataCollection
        cursor={kind === "samples" ? search.sampleCursor : search.datasetCursor}
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
