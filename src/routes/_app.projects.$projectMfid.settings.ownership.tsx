import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_app/projects/$projectMfid/settings/ownership"
)({
  component: ProjectOwnershipRedirect,
})

function ProjectOwnershipRedirect() {
  const { projectMfid } = Route.useParams()
  return (
    <Navigate
      params={{ projectMfid }}
      replace
      to="/projects/$projectMfid/settings"
    />
  )
}
