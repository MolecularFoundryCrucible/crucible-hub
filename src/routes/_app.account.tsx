import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { AccountCapabilitiesCard } from "@/features/account-profile/account-capabilities-card"
import { AccountCredentialCard } from "@/features/account-profile/account-credential-card"
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
        description="Manage your Crucible identity and review account access."
        eyebrow="Account"
        title="My profile"
      />
      <ContentBoundary className="flex flex-col gap-4" width="reading">
        <AccountProfileForm account={account} scope={scope} />
        <AccountCredentialCard scope={scope} />
        <AccountCapabilitiesCard account={account} />
      </ContentBoundary>
    </PageLayout>
  )
}
