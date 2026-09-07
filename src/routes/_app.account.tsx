import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { AccountProfileForm } from "@/features/account-profile/account-profile-form"

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: "Profile | Crucible Hub" }] }),
  component: AccountPage,
})

function AccountPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  return (
    <PageLayout>
      <PageHeader
        description="Review and update the identity associated with your Crucible account."
        eyebrow="Account"
        title="My profile"
      />
      <AccountProfileForm account={account} scope={scope} />
    </PageLayout>
  )
}
