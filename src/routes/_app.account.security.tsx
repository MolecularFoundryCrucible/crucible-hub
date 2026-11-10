import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { z } from "zod"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { AccountSecurityCard } from "@/features/account-profile/security-card"

export const Route = createFileRoute("/_app/account/security")({
  head: () => ({ meta: [{ title: "Security | Crucible Hub" }] }),
  validateSearch: z.object({
    link: z
      .enum(["pending", "retry", "cancelled", "expired", "failed"])
      .optional()
      .catch(undefined),
  }),
  component: AccountSecurityPage,
})

function AccountSecurityPage() {
  const scope = useWorkspaceScope()
  const { link } = Route.useSearch()
  const navigate = useNavigate()
  const clearLinkOutcome = useCallback(() => {
    void navigate({ replace: true, search: {}, to: "/account/security" })
  }, [navigate])

  return (
    <AccountSecurityCard
      linkOutcome={link}
      onLinkOutcomeHandled={clearLinkOutcome}
      scope={scope}
    />
  )
}
