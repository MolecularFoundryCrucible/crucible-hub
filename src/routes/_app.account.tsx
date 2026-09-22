import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  ContentBoundary,
  ContentGrid,
} from "@/components/crucible/content-layout"
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
      <PageHeader title="My profile" />
      <ContentBoundary>
        <ContentGrid variant="split">
          <div className="flex min-w-0 flex-col gap-page-section">
            <AccountProfileForm account={account} scope={scope} />
            <AccountCredentialCard scope={scope} />
          </div>
          <AccountCapabilitiesCard account={account} />
        </ContentGrid>
      </ContentBoundary>
    </PageLayout>
  )
}
