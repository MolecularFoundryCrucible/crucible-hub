import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { projectSummaryQueryOptions } from "@/data/crucible/projects.queries"
import { resourceSummaryQueryOptions } from "@/data/crucible/resources.queries"
import type {
  WorkspaceProject,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import { DatasetCreationForm } from "@/features/resource-creation/dataset-creation-form"

const resourceMfid = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional()
  .catch(undefined)

const datasetCreationSearchSchema = z.object({
  instrumentMfid: resourceMfid,
  projectMfid: resourceMfid,
})

export const Route = createFileRoute("/_app/datasets/new")({
  head: () => ({ meta: [{ title: "Create dataset | Crucible Hub" }] }),
  validateSearch: datasetCreationSearchSchema,
  loaderDeps: ({ search }) => ({
    instrumentMfid: search.instrumentMfid,
    projectMfid: search.projectMfid,
  }),
  loader: async ({ context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const [project, instrument] = await Promise.all([
      deps.projectMfid
        ? context.queryClient
            .ensureQueryData(
              projectSummaryQueryOptions(source.scope, deps.projectMfid)
            )
            .catch(() => null)
        : null,
      deps.instrumentMfid
        ? context.queryClient
            .ensureQueryData(
              resourceSummaryQueryOptions(source.scope, deps.instrumentMfid)
            )
            .catch(() => null)
        : null,
    ])

    return {
      initialInstrument: instrumentSearchResult(instrument),
      initialProject: projectSearchResult(project),
      mode: source.mode,
      scope: source.scope,
    }
  },
  component: NewDatasetPage,
})

function NewDatasetPage() {
  const scope = useWorkspaceScope()
  const mode = useWorkspaceMode()
  const loaderData = Route.useLoaderData()

  return (
    <PageLayout>
      <PageHeader eyebrow="Data" title="Create dataset" />
      <DatasetCreationForm
        initialInstrument={loaderData?.initialInstrument}
        initialProject={loaderData?.initialProject}
        mode={loaderData?.mode ?? mode}
        scope={scope}
      />
    </PageLayout>
  )
}

function projectSearchResult(
  project: WorkspaceProject | null | undefined
): WorkspaceSearchResult | undefined {
  if (!project) return undefined
  return {
    context: "organization" in project ? project.organization : null,
    kind: "project",
    name: project.title ?? project.project_id,
    unique_id: project.unique_id,
  }
}

function instrumentSearchResult(
  resource: WorkspaceResourceDetail | null | undefined
): WorkspaceSearchResult | undefined {
  if (!resource || resource.kind !== "instrument") return undefined
  return {
    context: resource.instrument_type ?? resource.location,
    kind: "instrument",
    name: resource.name,
    unique_id: resource.unique_id,
  }
}
