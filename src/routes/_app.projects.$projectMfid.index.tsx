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
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import {
  dataPageLimit,
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import type { ProjectScope } from "@/data/crucible/data.queries"

const filterSearchValue = z.string().max(255).optional().catch("")
const projectDataSearchSchema = resourcePreviewSearchSchema.extend({
  createdFrom: filterSearchValue,
  createdTo: filterSearchValue,
  instrumentMfid: filterSearchValue,
  kind: z.enum(["samples", "datasets"]).optional().catch(undefined),
  scope: z.enum(["all", "assigned", "shared"]).optional().catch(undefined),
  sampleCursor: z.string().min(1).max(2048).optional().catch(undefined),
  datasetCursor: z.string().min(1).max(2048).optional().catch(undefined),
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
    instrumentMfid: search.instrumentMfid,
    kind: search.kind ?? "samples",
    projectScope: search.scope ?? "all",
    sampleCursor: search.sampleCursor,
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
    instrumentMfid: search.instrumentMfid,
    visibility: search.visibility,
  }
  const filterResolution = resolveProjectDataFilters(filterValues, kind)
  return (
    <ResourcePreviewContext.Provider value={navigation}>
      <div className="flex justify-end">
        <ResourceCreationActions projectMfid={project.projectMfid} />
      </div>
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
