import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { ProjectCreationForm } from "@/features/project-creation/project-creation-form"

export const Route = createFileRoute("/_app/projects/new")({
  head: () => ({ meta: [{ title: "Create project | Crucible Hub" }] }),
  component: NewProjectPage,
})

function NewProjectPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  if (!account.capabilities.can_create_project) {
    return <Navigate replace to="/projects" />
  }
  return <ProjectCreationForm scope={scope} />
}
