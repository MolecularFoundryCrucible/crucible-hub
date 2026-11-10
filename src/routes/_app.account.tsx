import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { z } from "zod"

import {
  ContentBoundary,
  ContentGrid,
} from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  PersonAvatar,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { AccountCapabilitiesCard } from "@/features/account-profile/account-capabilities-card"
import { AccountProfileForm } from "@/features/account-profile/account-profile-form"
import { AccountSecurityCard } from "@/features/account-profile/security-card"
import { formatUsername } from "@/lib/username"

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: "Profile | Crucible Hub" }] }),
  validateSearch: z.object({
    link: z
      .enum(["pending", "retry", "cancelled", "expired", "failed"])
      .optional()
      .catch(undefined),
  }),
  component: AccountPage,
})

function AccountPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const { link } = Route.useSearch()
  const navigate = useNavigate()
  const clearLinkOutcome = useCallback(() => {
    void navigate({ replace: true, search: {}, to: "/account" })
  }, [navigate])

  return (
    <PageLayout>
      <PageHeader
        avatar={<PersonAvatar person={account} size="lg" />}
        eyebrow="My profile"
        identifier={
          account.username
            ? formatUsername(account.username, "handle")
            : undefined
        }
        title={personDisplayName(account)}
      />
      <ContentBoundary className="flex flex-col gap-page-section">
        <ContentGrid className="items-start" variant="split">
          <AccountProfileForm account={account} scope={scope} />
          <AccountCapabilitiesCard account={account} />
        </ContentGrid>
        <AccountSecurityCard
          linkOutcome={link}
          onLinkOutcomeHandled={clearLinkOutcome}
          scope={scope}
        />
      </ContentBoundary>
    </PageLayout>
  )
}
