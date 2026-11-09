import { useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { getRouteApi } from "@tanstack/react-router"

import { ActivityTime } from "@/components/crucible/activity-time"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  CredentialName,
  CredentialTablePending,
} from "@/components/crucible/credential-table"
import {
  CredentialActionsIcon,
  SignedInSessionIcon,
  SignOutIcon,
} from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { notifySuccess } from "@/components/crucible/notifications"
import {
  hubActionError,
  withReauthentication,
} from "@/components/crucible/reauthentication"
import {
  SecuritySection,
  SecuritySectionMessage,
} from "@/components/crucible/security-section"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSubmitItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import {
  endOtherWorkspaceSessionsFn,
  endWorkspaceSessionFn,
} from "@/data/crucible/sessions.functions"
import {
  sessionsInfiniteQueryOptions,
  sessionsQueryKey,
} from "@/data/crucible/sessions.queries"
import type { WorkspaceSignedInSession } from "@/data/crucible/workspace-source"

export type SessionOwner =
  { kind: "self" } | { kind: "person"; name: string; userId: string }

const workspaceRoute = getRouteApi("/_app")

const stepUpReason = "Signing out other sessions needs a recent sign-in."

export function SessionsSection({
  owner,
  scope,
}: {
  owner: SessionOwner
  scope: IdentityScope
}) {
  const userId = owner.kind === "person" ? owner.userId : undefined
  const query = useInfiniteQuery(sessionsInfiniteQueryOptions(scope, userId))
  const sessions = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.total ?? null
  const others = sessions.some((session) => !session.current)

  return (
    <SecuritySection
      action={
        (owner.kind === "self" ? others : sessions.length > 0) ? (
          <SignOutEverywhereAction owner={owner} scope={scope} />
        ) : null
      }
      title="Sessions"
    >
      {query.isError && sessions.length === 0 ? (
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
          {hubErrorMessage(query.error, "Sessions could not be loaded.")}
        </SecuritySectionMessage>
      ) : query.isPending ? (
        <CredentialTablePending label="Loading sessions" />
      ) : sessions.length === 0 ? (
        <SecuritySectionMessage>
          {owner.kind === "self"
            ? "You have no signed-in sessions."
            : "This person has no signed-in sessions."}
        </SecuritySectionMessage>
      ) : (
        <>
          <Table aria-label="Sessions">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">App</TableHead>
                <TableHead className="hidden @xl:table-cell" kind="date">
                  Signed in
                </TableHead>
                <TableHead className="hidden @md:table-cell" kind="date">
                  Last used
                </TableHead>
                <TableHead kind="date">Expires</TableHead>
                <TableHead className="pr-(--card-spacing)" kind="action">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  owner={owner}
                  scope={scope}
                  session={session}
                />
              ))}
            </TableBody>
          </Table>
          {query.hasNextPage || query.isFetchNextPageError ? (
            <div className="px-(--card-spacing)">
              <CollectionPagination
                disabled={query.isFetching}
                hasNextPage={query.hasNextPage}
                isError={query.isFetchNextPageError}
                isLoading={query.isFetchingNextPage}
                label="sessions"
                loaded={sessions.length}
                onLoadMore={() => void query.fetchNextPage()}
                total={total}
              />
            </div>
          ) : null}
        </>
      )}
    </SecuritySection>
  )
}

function SessionRow({
  owner,
  scope,
  session,
}: {
  owner: SessionOwner
  scope: IdentityScope
  session: WorkspaceSignedInSession
}) {
  return (
    <TableRow>
      <TableCell className="w-full max-w-0 pl-(--card-spacing)">
        <CredentialName
          icon={<SignedInSessionIcon aria-hidden="true" />}
          name={session.client_name}
          subtitle={session.current ? "This browser" : undefined}
        >
          <span className="@md:hidden">
            Last used{" "}
            <ActivityTime fallback="never" value={session.last_used_at} />
          </span>
        </CredentialName>
      </TableCell>
      <TableCell className="hidden @xl:table-cell" kind="date">
        <ActivityTime fallback="Unknown" value={session.signed_in_at} />
      </TableCell>
      <TableCell className="hidden @md:table-cell" kind="date">
        <ActivityTime fallback="Never" value={session.last_used_at} />
      </TableCell>
      <TableCell kind="date">
        <LocalDateTime dateOnly value={session.expires_at} />
      </TableCell>
      <TableCell className="pr-(--card-spacing)" kind="action">
        <SessionActions owner={owner} scope={scope} session={session} />
      </TableCell>
    </TableRow>
  )
}

function SessionActions({
  owner,
  scope,
  session,
}: {
  owner: SessionOwner
  scope: IdentityScope
  session: WorkspaceSignedInSession
}) {
  const [confirming, setConfirming] = useState(false)
  const workspace = workspaceRoute.useLoaderData()
  const hubSignOut = workspace.status === "ready" && workspace.sessionAuth
  if (session.current && !hubSignOut) return null
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${session.client_name}${session.current ? " (this browser)" : ""}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <CredentialActionsIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            {session.current ? (
              <DropdownMenuSubmitItem form="hub-sign-out" variant="destructive">
                <SignOutIcon aria-hidden="true" />
                Sign out
              </DropdownMenuSubmitItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setConfirming(true)}
                variant="destructive"
              >
                <SignOutIcon aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming ? (
        <EndSessionDialog
          onClose={() => setConfirming(false)}
          owner={owner}
          scope={scope}
          session={session}
        />
      ) : null}
    </>
  )
}

function EndSessionDialog({
  onClose,
  owner,
  scope,
  session,
}: {
  onClose: () => void
  owner: SessionOwner
  scope: IdentityScope
  session: WorkspaceSignedInSession
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<React.ReactNode>()
  const userId = owner.kind === "person" ? owner.userId : undefined
  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () =>
        unwrapHubResult(
          await endWorkspaceSessionFn({
            data: { sessionId: session.id, userId },
          })
        )
      ),
    onError: (cause) =>
      setError(
        hubActionError(
          cause,
          "The session could not be signed out.",
          stepUpReason,
          () => {
            setError(undefined)
            mutation.mutate()
          }
        )
      ),
    onSuccess: () => {
      notifySuccess("Signed out", session.client_name)
      void queryClient.invalidateQueries({
        queryKey: sessionsQueryKey(scope, userId),
      })
      onClose()
    },
  })
  return (
    <ConfirmationDialog
      confirmLabel="Sign out"
      description={
        owner.kind === "self"
          ? `That session ends at once, and ${session.client_name} will ask you to sign in again there.`
          : `${owner.name}'s session in ${session.client_name} ends at once.`
      }
      error={error}
      kind="alert"
      onConfirm={() => mutation.mutate()}
      onOpenChange={(open) => !open && onClose()}
      open
      pending={mutation.isPending}
      pendingLabel="Signing out"
      title={`Sign out of ${session.client_name}?`}
      variant="destructive"
    />
  )
}

function SignOutEverywhereAction({
  owner,
  scope,
}: {
  owner: SessionOwner
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<React.ReactNode>()
  const userId = owner.kind === "person" ? owner.userId : undefined
  const self = owner.kind === "self"
  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () =>
        unwrapHubResult(await endOtherWorkspaceSessionsFn({ data: { userId } }))
      ),
    onError: (cause) =>
      setError(
        hubActionError(
          cause,
          "The sessions could not be signed out.",
          stepUpReason,
          () => {
            setError(undefined)
            mutation.mutate()
          }
        )
      ),
    onSuccess: () => {
      notifySuccess(
        self ? "Signed out everywhere else" : "Signed out everywhere"
      )
      void queryClient.invalidateQueries({
        queryKey: sessionsQueryKey(scope, userId),
      })
      setOpen(false)
    },
  })
  const label = self ? "Sign out everywhere else" : "Sign out everywhere"
  return (
    <>
      <Button
        onClick={() => {
          setError(undefined)
          setOpen(true)
        }}
        size="sm"
        variant="outline"
      >
        <SignOutIcon aria-hidden="true" data-icon="inline-start" />
        {label}
      </Button>
      <ConfirmationDialog
        confirmLabel={label}
        description={
          self
            ? "Every other session ends at once, including the command line and devices you approved. This browser stays signed in."
            : `All of ${owner.name}'s sessions end at once, including the command line and devices they approved.`
        }
        error={error}
        kind="alert"
        onConfirm={() => mutation.mutate()}
        onOpenChange={setOpen}
        open={open}
        pending={mutation.isPending}
        pendingLabel="Signing out"
        title={
          self
            ? "Sign out everywhere else?"
            : `Sign out ${owner.name} everywhere?`
        }
        variant="destructive"
      />
    </>
  )
}
