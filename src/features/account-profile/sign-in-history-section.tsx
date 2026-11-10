import { useInfiniteQuery } from "@tanstack/react-query"
import { useId, useState } from "react"
import { Link } from "@tanstack/react-router"

import { ActivityTime } from "@/components/crucible/activity-time"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import {
  CredentialName,
  CredentialTablePending,
} from "@/components/crucible/credential-table"
import {
  SignInHistoryIcon,
  SignInHistoryWarningIcon,
} from "@/components/crucible/icons"
import {
  SecuritySection,
  SecuritySectionMessage,
} from "@/components/crucible/security-section"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authEventsInfiniteQueryOptions } from "@/data/crucible/auth-events.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage } from "@/data/crucible/result"
import type { WorkspaceAuthEvent } from "@/data/crucible/workspace-source"

const eventLabels: Record<string, string> = {
  api_key_created: "API key created",
  api_key_revoked: "API key revoked",
  approved: "Account approved",
  disabled: "Account disabled",
  enabled: "Account enabled",
  identity_linked: "Sign-in method added",
  identity_unlinked: "Sign-in method removed",
  link_issued: "Password link created",
  locked: "Locked after failed sign-ins",
  password_changed: "Password changed",
  password_removed: "Password removed",
  password_reset: "Password reset",
  password_set: "Password set",
  provider_refused: "Sign-in refused by the provider",
  registered: "Asked for an account",
  rejected: "Account request rejected",
  role_changed: "Platform role changed",
  sessions_ended: "Sessions signed out",
  sign_in: "Signed in",
  sign_in_failed: "Sign-in failed",
}

const recentEventCount = 5

const warningEvents = new Set(["locked", "provider_refused", "sign_in_failed"])

const clientNames: Record<string, string> = {
  "crucible-hub": "Crucible Hub",
  "nano-crucible": "nano-crucible",
}

export function authEventLabel(event: string) {
  const known = eventLabels[event]
  if (known) return known
  const words = event.replaceAll("_", " ").trim()
  return words ? words[0].toUpperCase() + words.slice(1) : event
}

export function authEventIssuer(issuer: string | null | undefined) {
  if (!issuer) return null
  try {
    const host = new URL(issuer).hostname.replace(/^www\./, "")
    return /(^|\.)orcid\.org$/.test(host) ? "ORCID" : host
  } catch {
    return issuer
  }
}

export function SignInHistorySection({
  scope,
  userId,
}: {
  scope: IdentityScope
  userId?: string
}) {
  const query = useInfiniteQuery(authEventsInfiniteQueryOptions(scope, userId))
  const events = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.total ?? null
  const [expanded, setExpanded] = useState(false)
  const tableBodyId = useId()
  const canExpand = events.length > recentEventCount || query.hasNextPage
  const visibleEvents = expanded ? events : events.slice(0, recentEventCount)

  return (
    <SecuritySection title="Sign-in history">
      {query.isError && events.length === 0 ? (
        <SecuritySectionMessage
          action={
            <Button
              onClick={() => void query.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          }
          role="alert"
        >
          {hubErrorMessage(query.error, "Sign-in history could not be loaded.")}
        </SecuritySectionMessage>
      ) : query.isPending ? (
        <CredentialTablePending label="Loading sign-in history" />
      ) : events.length === 0 ? (
        <SecuritySectionMessage>No sign-in history yet.</SecuritySectionMessage>
      ) : (
        <>
          <Table aria-label="Sign-in history">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Event</TableHead>
                <TableHead
                  className="hidden pr-(--card-spacing) @md:table-cell"
                  kind="date"
                >
                  When
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody id={tableBodyId}>
              {visibleEvents.map((event) => (
                <SignInHistoryRow event={event} key={event.id} />
              ))}
            </TableBody>
          </Table>
          {canExpand ? (
            <div className="flex flex-col gap-3 px-(--card-spacing)">
              {expanded && (query.hasNextPage || query.isFetchNextPageError) ? (
                <CollectionPagination
                  disabled={query.isFetching}
                  hasNextPage={query.hasNextPage}
                  isError={query.isFetchNextPageError}
                  isLoading={query.isFetchingNextPage}
                  label="events"
                  loaded={events.length}
                  onLoadMore={() => void query.fetchNextPage()}
                  total={total}
                />
              ) : null}
              <Button
                aria-controls={tableBodyId}
                aria-expanded={expanded}
                className="self-start"
                onClick={() => setExpanded((value) => !value)}
                size="sm"
                variant="outline"
              >
                {expanded
                  ? "Show fewer"
                  : total !== null && total > recentEventCount
                    ? `Show all ${total}`
                    : "Show more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </SecuritySection>
  )
}

function SignInHistoryRow({ event }: { event: WorkspaceAuthEvent }) {
  const warning = warningEvents.has(event.event)
  const details = [
    authEventIssuer(event.issuer),
    event.client_id ? (clientNames[event.client_id] ?? event.client_id) : null,
  ].filter(Boolean)
  return (
    <TableRow>
      <TableCell className="w-full max-w-0 pl-(--card-spacing)">
        <CredentialName
          icon={
            warning ? (
              <SignInHistoryWarningIcon
                aria-hidden="true"
                className="text-warning-text"
              />
            ) : (
              <SignInHistoryIcon aria-hidden="true" />
            )
          }
          name={authEventLabel(event.event)}
          subtitle={
            details.length > 0 || event.actor_unique_id ? (
              <>
                {details.join(" · ")}
                {details.length > 0 && event.actor_unique_id ? " · " : null}
                {event.actor_unique_id ? (
                  <Link
                    className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    params={{ userId: event.actor_unique_id }}
                    to="/users/$userId"
                  >
                    by another person
                  </Link>
                ) : null}
              </>
            ) : undefined
          }
        >
          <span className="@md:hidden">
            <ActivityTime fallback="" value={event.at} />
          </span>
        </CredentialName>
      </TableCell>
      <TableCell
        className="hidden pr-(--card-spacing) @md:table-cell"
        kind="date"
      >
        <ActivityTime fallback="" value={event.at} />
      </TableCell>
    </TableRow>
  )
}
