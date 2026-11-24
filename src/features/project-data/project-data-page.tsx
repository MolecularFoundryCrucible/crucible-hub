import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { useIncludePublicByDefault } from "@/hooks/public-data"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { getRouteApi } from "@tanstack/react-router"
import type { z } from "zod"
import {
  ResourcePreviewContext,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import {
  ProjectDataCollection,
  ProjectDataCollectionPending,
} from "@/features/project-data/project-data-collection"
import type { ProjectDataKind } from "@/features/project-data/project-data-collection"
import { resolveProjectDataFilters } from "@/features/project-data/project-data-filter-state"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import type { ProjectScope } from "@/data/crucible/data.queries"
import {
  useDataGroupBy,
  useDefaultSort,
} from "@/features/preferences/data-group-by"
import type { projectDataSearchSchema } from "@/features/project-data/project-data-search"

const route = getRouteApi("/_app/projects/$projectMfid/")

const projectRoute = getRouteApi("/_app/projects/$projectMfid")

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

export function ProjectDataPending() {
  const search = route.useSearch()
  const { projectMfid } = route.useParams()
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

export function ProjectDataPage() {
  const search = route.useSearch()
  const { projectMfid } = route.useParams()
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
