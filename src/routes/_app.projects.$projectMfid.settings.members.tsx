import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_app/projects/$projectMfid/settings/members"
)({
  component: ProjectMembersRedirect,
})

function ProjectMembersRedirect() {
  const { projectMfid } = Route.useParams()
  return (
    <Navigate
      params={{ projectMfid }}
      replace
      to="/projects/$projectMfid/settings"
    />
  )
}
