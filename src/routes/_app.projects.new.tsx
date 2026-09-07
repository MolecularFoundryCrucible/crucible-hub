import { createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { ProjectCreationForm } from "@/features/project-creation/project-creation-form"

export const Route = createFileRoute("/_app/projects/new")({
  head: () => ({ meta: [{ title: "Create project | Crucible Hub" }] }),
  component: NewProjectPage,
})

function NewProjectPage() {
  const scope = useWorkspaceScope()
  return <ProjectCreationForm scope={scope} />
}
