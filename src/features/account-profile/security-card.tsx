import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"

import { SecuritySectionInTab } from "@/components/crucible/security-section"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  accountIdentitiesQueryOptions,
  userIdentitiesQueryOptions,
} from "@/data/crucible/account-identities.queries"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { apiKeysInfiniteQueryOptions } from "@/data/crucible/api-keys.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { sessionsInfiniteQueryOptions } from "@/data/crucible/sessions.queries"

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
import { SignInHistorySection } from "./sign-in-history-section"

const workspaceRoute = getRouteApi("/_app")

export const securityTabHashes: readonly string[] = [
  "sign-in-methods",
  "sessions",
  "api-keys",
  "history",
] satisfies SecurityTab[]

type SecurityTab = "sign-in-methods" | "sessions" | "api-keys" | "history"

function tabFromHash(): SecurityTab | undefined {
  if (typeof window === "undefined") return undefined
  const hash = window.location.hash.slice(1)
  return securityTabHashes.includes(hash) ? (hash as SecurityTab) : undefined
}

function useSecurityTab() {
  const [tab, setTab] = useState<SecurityTab>("sign-in-methods")
  useEffect(() => {
    const follow = () => {
      const fromHash = tabFromHash()
      if (fromHash) setTab(fromHash)
    }
    follow()
    window.addEventListener("hashchange", follow)
    return () => window.removeEventListener("hashchange", follow)
  }, [])
  return [tab, setTab] as const
}

function TabCount({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null
  return (
    <span className="rounded-full bg-muted px-1.5 text-supporting text-muted-foreground tabular-nums">
      {value}
    </span>
  )
}

function SecurityCard({
  counts,
  panels,
}: {
  counts: Partial<Record<SecurityTab, number | null>>
  panels: Partial<Record<SecurityTab, ReactNode>>
}) {
  const [tab, setTab] = useSecurityTab()
  const tabs: [SecurityTab, string][] = [
    ["sign-in-methods", "Sign-in methods"],
    ["sessions", "Sessions"],
    ["api-keys", "API keys"],
    ["history", "Sign-in history"],
  ]
  const shown = tabs.filter(([value]) => panels[value])
  return (
    <Card>
      <CardContent className="px-0">
        <Tabs
          className="gap-4"
          onValueChange={(value) => setTab(value as SecurityTab)}
          value={tab}
        >
          <div className="overflow-x-auto border-b px-(--card-spacing)">
            <TabsList aria-label="Security" className="gap-4" variant="line">
              {shown.map(([value, label]) => (
                <TabsTrigger
                  className="flex-none px-0"
                  key={value}
                  value={value}
                >
                  {label}
                  <TabCount value={counts[value]} />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <SecuritySectionInTab value={true}>
            {shown.map(([value]) => (
              <TabsContent keepMounted key={value} value={value}>
                {panels[value]}
              </TabsContent>
            ))}
          </SecuritySectionInTab>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function useSecurityCounts(
  scope: IdentityScope,
  userId: string | undefined,
  hasPassword: boolean
) {
  const ownIdentities = useQuery({
    ...accountIdentitiesQueryOptions(scope),
    enabled: !userId,
  })
  const theirIdentities = useQuery({
    ...userIdentitiesQueryOptions(scope, userId ?? ""),
    enabled: Boolean(userId),
  })
  const identities = userId ? theirIdentities : ownIdentities
  const sessions = useInfiniteQuery(sessionsInfiniteQueryOptions(scope, userId))
  const keys = useInfiniteQuery(
    apiKeysInfiniteQueryOptions(scope, userId, "active")
  )
  return {
    "api-keys": keys.data?.pages[0]?.total ?? null,
    sessions: sessions.data?.pages[0]?.total ?? null,
    "sign-in-methods": identities.data
      ? identities.data.length + (hasPassword ? 1 : 0)
      : null,
  }
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
  const account = useQuery(accountQueryOptions(scope)).data
  const canCreate =
    workspace.status === "ready" &&
    (workspace.mode === "fixture" || workspace.sessionAuth)
  const counts = useSecurityCounts(
    scope,
    undefined,
    account?.sign_in_methods?.includes("password") ?? false
  )
  return (
    <SecurityCard
      counts={counts}
      panels={{
        "sign-in-methods": (
          <AccountSignInMethodsSection
            linkOutcome={linkOutcome}
            onLinkOutcomeHandled={onLinkOutcomeHandled}
            scope={scope}
          />
        ),
        sessions: <SessionsSection owner={{ kind: "self" }} scope={scope} />,
        "api-keys": (
          <ApiKeysSection owner={{ canCreate, kind: "self" }} scope={scope} />
        ),
        history: <SignInHistorySection scope={scope} />,
      }}
    />
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
  const counts = useSecurityCounts(
    scope,
    userId,
    password?.signInMethods?.includes("password") ?? false
  )
  return (
    <SecurityCard
      counts={canManageApiKeys ? counts : { ...counts, "api-keys": null }}
      panels={{
        "sign-in-methods": (
          <PersonSignInMethodsSection
            password={password}
            personName={personName}
            scope={scope}
            userId={userId}
          />
        ),
        sessions: (
          <SessionsSection
            owner={{ kind: "person", name: personName, userId }}
            scope={scope}
          />
        ),
        "api-keys": canManageApiKeys ? (
          <ApiKeysSection
            owner={{ kind: "person", name: personName, userId }}
            scope={scope}
          />
        ) : undefined,
        history: <SignInHistorySection scope={scope} userId={userId} />,
      }}
    />
  )
}
