import { createFileRoute } from "@tanstack/react-router"

import { IdentityDetailContentPending } from "@/components/crucible/route-content-pending"
import { UserDetailView } from "@/features/admin/user-detail"
import {
  ReadOnlyPersonProfileCard,
  usePersonPage,
} from "@/features/people/person-page"

export const Route = createFileRoute("/_app/users/$userId/")({
  component: PersonOverviewPage,
})

function PersonOverviewPage() {
  const { userId } = Route.useParams()
  const {
    activePerson,
    administersPerson,
    administrationScope,
    adminUserResult,
    lastActiveAt,
  } = usePersonPage(userId)
  if (!activePerson) return null

  if (administersPerson && adminUserResult.isPending) {
    return <IdentityDetailContentPending kind="person" />
  }
  if (administersPerson && adminUserResult.data) {
    return (
      <UserDetailView
        key={adminUserResult.data.unique_id}
        scope={administrationScope}
        user={adminUserResult.data}
      />
    )
  }
  return (
    <ReadOnlyPersonProfileCard
      lastActiveAt={lastActiveAt}
      person={activePerson}
    />
  )
}
