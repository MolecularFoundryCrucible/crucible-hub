import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { ContentGrid } from "@/components/crucible/content-layout"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { AccountCapabilitiesCard } from "@/features/account-profile/account-capabilities-card"
import { AccountProfileForm } from "@/features/account-profile/account-profile-form"
import { securityTabHashes } from "@/features/account-profile/security-card"

export const Route = createFileRoute("/_app/account/")({
  component: AccountOverviewPage,
})

function AccountOverviewPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (securityTabHashes.includes(hash)) {
      void navigate({ hash, replace: true, to: "/account/security" })
    }
  }, [navigate])

  return (
    <ContentGrid className="items-start" variant="split">
      <AccountProfileForm account={account} scope={scope} />
      <AccountCapabilitiesCard account={account} />
    </ContentGrid>
  )
}
