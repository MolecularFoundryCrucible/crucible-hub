import type { ReactNode } from "react"
import { getRouteApi } from "@tanstack/react-router"

import { SecurityIcon } from "@/components/crucible/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { IdentityScope } from "@/data/crucible/query-keys"

import {
  AccountSignInMethodsSection,
  PersonSignInMethodsSection,
} from "./account-sign-in-methods-card"
import type {
  AccountLinkOutcome,
  PersonPasswordState,
} from "./account-sign-in-methods-card"
import { ApiKeysSection } from "./api-keys-section"
import { SessionsSection } from "./sessions-section"

const workspaceRoute = getRouteApi("/_app")

function SecurityCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SecurityIcon aria-hidden="true" />
          Security
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">{children}</CardContent>
    </Card>
  )
}

export function AccountSecurityCard({
  linkOutcome,
  onLinkOutcomeHandled,
  scope,
}: {
  linkOutcome?: AccountLinkOutcome
  onLinkOutcomeHandled: () => void
  scope: IdentityScope
}) {
  const workspace = workspaceRoute.useLoaderData()
  const canCreate =
    workspace.status === "ready" &&
    (workspace.mode === "fixture" || workspace.sessionAuth)
  return (
    <SecurityCard>
      <AccountSignInMethodsSection
        linkOutcome={linkOutcome}
        onLinkOutcomeHandled={onLinkOutcomeHandled}
        scope={scope}
      />
      <SessionsSection owner={{ kind: "self" }} scope={scope} />
      <ApiKeysSection owner={{ canCreate, kind: "self" }} scope={scope} />
    </SecurityCard>
  )
}

export function PersonSecurityCard({
  canManageApiKeys,
  password,
  personName,
  scope,
  userId,
}: {
  canManageApiKeys: boolean
  password?: PersonPasswordState
  personName: string
  scope: IdentityScope
  userId: string
}) {
  return (
    <SecurityCard>
      <PersonSignInMethodsSection
        password={password}
        personName={personName}
        scope={scope}
        userId={userId}
      />
      <SessionsSection
        owner={{ kind: "person", name: personName, userId }}
        scope={scope}
      />
      {canManageApiKeys ? (
        <ApiKeysSection
          owner={{ kind: "person", name: personName, userId }}
          scope={scope}
        />
      ) : null}
    </SecurityCard>
  )
}
