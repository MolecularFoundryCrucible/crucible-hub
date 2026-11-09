import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { ActivityTime } from "@/components/crucible/activity-time"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { notifySuccess } from "@/components/crucible/notifications"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HubConflictCode } from "@/data/crucible/errors"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import {
  approveWorkspaceUserFn,
  rejectWorkspaceUserFn,
} from "@/data/crucible/user-approvals.functions"
import { pendingUsersQueryOptions } from "@/data/crucible/user-approvals.queries"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"
import { formatSignInMethods } from "@/lib/sign-in-methods"

const approvalErrors: Partial<Record<HubConflictCode, string>> = {
  not_pending: "This account is no longer waiting for approval.",
  still_referenced:
    "Other records refer to this account, so it can't be deleted. Approve it instead, or ask a developer to look at what refers to it.",
}

function approvalError(error: unknown, fallback: string) {
  const code =
    error instanceof HubApiClientError ? error.details.conflictCode : undefined
  return (code && approvalErrors[code]) ?? hubErrorMessage(error, fallback)
}

function useRefreshUsers(scope: IdentityScope) {
  const queryClient = useQueryClient()
  return (refetchType: "active" | "none" = "active") =>
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.userAdminQueries(scope),
      refetchType,
    })
}

export function PendingUsersCard({ scope }: { scope: IdentityScope }) {
  const query = useQuery(pendingUsersQueryOptions(scope))
  if (!query.data || query.data.items.length === 0) return null
  const total = query.data.total ?? query.data.items.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Waiting for approval
          <Badge variant="warning">{total}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {query.data.items.map((user) => (
            <PendingUserRow key={user.unique_id} scope={scope} user={user} />
          ))}
        </ul>
        {total > query.data.items.length ? (
          <p className="mt-3 text-supporting text-muted-foreground">
            Showing the {query.data.items.length} oldest of {total}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PendingUserRow({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          className="min-w-0 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          params={{ userId: user.unique_id }}
          to="/users/$userId"
        >
          <PersonIdentity person={user} />
        </Link>
        <span className="text-supporting text-muted-foreground">
          {user.email ? `${user.email} (not verified) · ` : null}
          {user.sign_in_methods?.length
            ? `Signs in with ${formatSignInMethods(user.sign_in_methods)} · `
            : null}
          Requested <ActivityTime fallback="" value={user.pending_at} />
        </span>
      </div>
      <PendingUserActions scope={scope} user={user} />
    </li>
  )
}

export function PendingUserActions({
  onRejected,
  scope,
  user,
}: {
  onRejected?: () => void
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const refresh = useRefreshUsers(scope)
  const name = personDisplayName(user)
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState<string>()
  const approve = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await approveWorkspaceUserFn({ data: { userId: user.unique_id } })
      ),
    onError: (cause) =>
      setError(approvalError(cause, "The account could not be approved.")),
    onSuccess: () => {
      setError(undefined)
      notifySuccess("Account approved", `${name} can now sign in.`)
      refresh()
    },
  })
  const reject = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await rejectWorkspaceUserFn({ data: { userId: user.unique_id } })
      ),
    onError: (cause) =>
      setError(approvalError(cause, "The request could not be rejected.")),
    onSuccess: () => {
      setRejecting(false)
      setError(undefined)
      notifySuccess("Request rejected", name)
      refresh(onRejected ? "none" : "active")
      onRejected?.()
    },
  })
  const busy = approve.isPending || reject.isPending

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={() => setRejecting(true)}
          size="sm"
          variant="outline"
        >
          Reject
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setError(undefined)
            approve.mutate()
          }}
          size="sm"
        >
          Approve
        </Button>
      </div>
      {error && !rejecting ? (
        <p
          className="max-w-xs text-right text-body text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <ConfirmationDialog
        confirmLabel="Reject"
        description={`This deletes ${name}'s waiting account and frees its username and login. They can sign in again later to ask for access.`}
        error={rejecting ? error : undefined}
        kind="alert"
        onConfirm={() => reject.mutate()}
        onOpenChange={(open) => {
          setRejecting(open)
          if (!open) setError(undefined)
        }}
        open={rejecting}
        pending={reject.isPending}
        pendingLabel="Rejecting"
        title={`Reject ${name}'s request?`}
        variant="destructive"
      />
    </div>
  )
}
