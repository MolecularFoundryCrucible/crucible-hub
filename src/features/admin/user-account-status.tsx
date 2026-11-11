import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { ActivityTime } from "@/components/crucible/activity-time"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  CredentialActionsIcon,
  DisableAccountIcon,
} from "@/components/crucible/icons"
import { notifySuccess } from "@/components/crucible/notifications"
import { DelayedPendingIcon } from "@/components/crucible/pending-icon"
import { personDisplayName } from "@/components/crucible/person-identity"
import {
  hubActionError,
  withReauthentication,
} from "@/components/crucible/reauthentication"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import { setWorkspaceUserDisabledFn } from "@/data/crucible/users.functions"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"

function canSwitchAccount(user: WorkspaceAdminUser) {
  return (
    user.user_capabilities?.can_change_platform_role === true &&
    !user.pending_at
  )
}

function useSetUserDisabled(scope: IdentityScope, user: WorkspaceAdminUser) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (disabled: boolean) =>
      unwrapHubResult(
        await setWorkspaceUserDisabledFn({
          data: {
            disabled,
            scenario: fixtureScenarioFromScope(scope),
            userId: user.unique_id,
          },
        })
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        crucibleKeys.userAdminDetail(scope, user.unique_id),
        (current: WorkspaceAdminUser | undefined) => ({
          ...updated,
          api_key_status:
            updated.api_key_status ?? current?.api_key_status ?? null,
          user_capabilities:
            updated.user_capabilities ?? current?.user_capabilities ?? null,
        })
      )
      void Promise.all(
        [
          crucibleKeys.userAdminLists(scope),
          crucibleKeys.userSessions(scope, user.unique_id),
          crucibleKeys.userApiKeyQueries(scope, user.unique_id),
          crucibleKeys.userAuthEvents(scope, user.unique_id),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
    },
  })
}

function switchError(cause: unknown, action: string, retry: () => void) {
  if (cause instanceof HubApiClientError && cause.details.kind === "conflict") {
    return "This is the last active administrator, so their account can't be disabled."
  }
  return hubActionError(
    cause,
    `The account could not be ${action}.`,
    `Changing whether an account is on needs a recent sign-in.`,
    retry
  )
}

export function DisabledAccountBanner({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const mutation = useSetUserDisabled(scope, user)
  const [error, setError] = useState<React.ReactNode>()

  async function enable() {
    setError(undefined)
    try {
      await withReauthentication(() => mutation.mutateAsync(false))
      notifySuccess("Account enabled")
    } catch (cause) {
      setError(switchError(cause, "enabled", () => void enable()))
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-label">
            <Badge variant="destructive">Disabled</Badge>
          </span>
          <span className="text-supporting text-muted-foreground">
            Disabled <ActivityTime fallback="" value={user.disabled_at} />
          </span>
          {error ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        {canSwitchAccount(user) ? (
          <Button
            disabled={mutation.isPending}
            onClick={() => void enable()}
            variant="outline"
          >
            <DelayedPendingIcon
              data-icon="inline-start"
              pending={mutation.isPending}
            />
            Enable account
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function UserAccountActions({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const mutation = useSetUserDisabled(scope, user)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<React.ReactNode>()
  const name = personDisplayName(user)

  if (!canSwitchAccount(user) || user.disabled_at) return null

  async function disable() {
    setError(undefined)
    try {
      await withReauthentication(() => mutation.mutateAsync(true))
      setOpen(false)
      notifySuccess("Account disabled")
    } catch (cause) {
      setError(switchError(cause, "disabled", () => void disable()))
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`More actions for ${name}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <CredentialActionsIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setOpen(true)}
              variant="destructive"
            >
              <DisableAccountIcon aria-hidden="true" />
              Disable account
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationDialog
        confirmLabel="Disable account"
        description="They are signed out everywhere, and their sign-in methods and API keys stop working until the account is enabled again."
        error={error}
        kind="alert"
        onConfirm={() => void disable()}
        onOpenChange={(next) => {
          if (mutation.isPending) return
          setOpen(next)
          if (!next) setError(undefined)
        }}
        open={open}
        pending={mutation.isPending}
        pendingLabel="Disabling account"
        title={`Disable ${name}'s account?`}
        variant="destructive"
      />
    </>
  )
}
