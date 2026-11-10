import { Navigate, createFileRoute } from "@tanstack/react-router"

import { IdentityDetailContentPending } from "@/components/crucible/route-content-pending"
import { UserDetailView } from "@/features/admin/user-detail"
import { usePersonPage } from "@/features/people/person-page"

export const Route = createFileRoute("/_app/users/$userId/security")({
  component: PersonSecurityPage,
})

function PersonSecurityPage() {
  const { userId } = Route.useParams()
  const { administersPerson, administrationScope, adminUserResult } =
    usePersonPage(userId)

  if (administersPerson && adminUserResult.isPending) {
    return <IdentityDetailContentPending kind="person" />
  }
  if (administersPerson && adminUserResult.data) {
    return (
      <UserDetailView
        key={adminUserResult.data.unique_id}
        scope={administrationScope}
        section="security"
        user={adminUserResult.data}
      />
    )
  }
  return <Navigate params={{ userId }} replace to="/users/$userId" />
}
