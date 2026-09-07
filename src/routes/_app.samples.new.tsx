import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"
import { SampleCreationForm } from "@/features/resource-creation/sample-creation-form"

const sampleCreationSearchSchema = z.object({
  projectMfid: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_app/samples/new")({
  head: () => ({ meta: [{ title: "Create sample | Crucible Hub" }] }),
  validateSearch: sampleCreationSearchSchema,
  loaderDeps: ({ search }) => ({ projectMfid: search.projectMfid }),
  loader: async ({ context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable" || !deps.projectMfid) {
      return { initialProject: undefined }
    }
    const project = await context.queryClient
      .ensureQueryData(projectQueryOptions(source.scope, deps.projectMfid))
      .catch(() => null)
    if (!project) return { initialProject: undefined }
    return {
      initialProject: {
        context: project.project_id,
        kind: "project",
        name: project.title ?? project.project_id,
        unique_id: project.unique_id,
      } satisfies WorkspaceSearchResult,
    }
  },
  component: NewSamplePage,
})

function NewSamplePage() {
  const scope = useWorkspaceScope()
  const { initialProject } = Route.useLoaderData()
  return <SampleCreationForm initialProject={initialProject} scope={scope} />
}
