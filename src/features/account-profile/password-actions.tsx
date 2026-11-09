import { useId, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { IdentifierInput } from "@/components/crucible/identifier-input"
import { CopyIcon, CopySuccessIcon } from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { notifySuccess } from "@/components/crucible/notifications"
import {
  hubActionError,
  withReauthentication,
} from "@/components/crucible/reauthentication"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { HubConflictCode } from "@/data/crucible/errors"
import {
  issueWorkspaceUserPasswordLinkFn,
  removeWorkspaceUserPasswordFn,
  setWorkspaceAccountPasswordFn,
} from "@/data/crucible/passwords.functions"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspacePasswordLink } from "@/data/crucible/workspace-source"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { useCopyFeedback } from "@/hooks/use-copy-feedback"
import { useExitSafeValue } from "@/hooks/use-exit-safe"

const passwordRefusals: Partial<Record<HubConflictCode, string>> = {
  account_disabled: "This account is disabled, so it can't have a password.",
  account_pending:
    "This account is waiting for approval. Approve it before setting up a password.",
  browser_sign_in_required:
    "Passwords can only be changed after signing in with a browser.",
  feature_disabled: "Passwords are turned off on this server.",
  hub_session_required:
    "Passwords can only be changed after signing in with a browser.",
  last_sign_in_method:
    "This is the only way to sign in, so the password can't be removed.",
  no_password: "There is no password to remove.",
  password_changed:
    "The password was changed somewhere else a moment ago. Close this and try again.",
  service_account: "Service accounts can't have a password.",
  username_required:
    "Choose a username in your profile first. You'll sign in with it and your password.",
}

function details(error: unknown) {
  return error instanceof HubApiClientError ? error.details : undefined
}

function refusal(error: unknown) {
  const code = details(error)?.conflictCode
  return code ? passwordRefusals[code] : undefined
}

export function SetPasswordDialog({
  hasPassword,
  onOpenChange,
  open,
  scope,
  username,
}: {
  hasPassword: boolean | null
  onOpenChange: (open: boolean) => void
  open: boolean
  scope: IdentityScope
  username: string | null
}) {
  const queryClient = useQueryClient()
  const currentId = useId()
  const nextId = useId()
  const confirmId = useId()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [askCurrent, setAskCurrent] = useState(hasPassword === true)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"current" | "next" | "confirm", string>>
  >({})
  const [error, setError] = useState<React.ReactNode>()
  const changing = askCurrent

  function reset() {
    setCurrent("")
    setNext("")
    setConfirm("")
    setAskCurrent(hasPassword === true)
    setFieldErrors({})
    setError(undefined)
  }

  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () =>
        unwrapHubResult(
          await setWorkspaceAccountPasswordFn({
            data: {
              ...(askCurrent ? { currentPassword: current } : {}),
              newPassword: next,
            },
          })
        )
      ),
    onError: (cause) => {
      const issues: Partial<Record<string, string[]>> =
        details(cause)?.fieldErrors ?? {}
      const currentIssue = issues.current_password?.[0]
      const nextIssue = issues.new_password?.[0]
      if (currentIssue || nextIssue) {
        if (currentIssue && !askCurrent) {
          setAskCurrent(true)
          setFieldErrors({
            current: "Enter your current password to change it.",
          })
          return
        }
        setFieldErrors({ current: currentIssue, next: nextIssue })
        return
      }
      setError(
        refusal(cause) ??
          hubActionError(
            cause,
            "The password could not be saved.",
            "Changing your password needs a recent sign-in.",
            () => {
              setError(undefined)
              mutation.mutate()
            }
          )
      )
    },
    onSuccess: () => {
      onOpenChange(false)
      reset()
      notifySuccess(
        changing ? "Password changed" : "Password set",
        changing ? "Your other sessions were signed out." : undefined
      )
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.accountProfile(scope),
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.accountSessions(scope),
      })
    },
  })

  function submit() {
    if (mutation.isPending) return
    setError(undefined)
    if (next !== confirm) {
      setFieldErrors({ confirm: "The passwords don't match." })
      return
    }
    setFieldErrors({})
    mutation.mutate()
  }

  return (
    <ConfirmationDialog
      confirmDisabled={!next || !confirm || (askCurrent && !current)}
      confirmLabel={changing ? "Change password" : "Set password"}
      description={
        changing
          ? "Your other sessions will be signed out."
          : username
            ? `You'll sign in with your username, ${username}, and this password.`
            : "You'll sign in with your username and this password."
      }
      error={error}
      onConfirm={submit}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) reset()
      }}
      open={open}
      pending={mutation.isPending}
      pendingLabel="Saving"
      title={changing ? "Change password" : "Set a password"}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {username ? (
          <input
            autoComplete="username"
            hidden
            name="username"
            readOnly
            type="text"
            value={username}
          />
        ) : null}
        <FieldGroup>
          {askCurrent ? (
            <Field data-invalid={fieldErrors.current ? true : undefined}>
              <FieldLabel htmlFor={currentId}>Current password</FieldLabel>
              <Input
                aria-invalid={fieldErrors.current ? true : undefined}
                autoComplete="current-password"
                autoFocus
                id={currentId}
                maxLength={1024}
                onChange={(event) => setCurrent(event.target.value)}
                type="password"
                value={current}
              />
              {fieldErrors.current ? (
                <FieldError>{fieldErrors.current}</FieldError>
              ) : null}
            </Field>
          ) : null}
          <Field data-invalid={fieldErrors.next ? true : undefined}>
            <FieldLabel htmlFor={nextId}>New password</FieldLabel>
            <Input
              aria-invalid={fieldErrors.next ? true : undefined}
              autoComplete="new-password"
              autoFocus={!askCurrent}
              id={nextId}
              maxLength={1024}
              onChange={(event) => setNext(event.target.value)}
              type="password"
              value={next}
            />
            {fieldErrors.next ? (
              <FieldError>{fieldErrors.next}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={fieldErrors.confirm ? true : undefined}>
            <FieldLabel htmlFor={confirmId}>Confirm new password</FieldLabel>
            <Input
              aria-invalid={fieldErrors.confirm ? true : undefined}
              autoComplete="new-password"
              id={confirmId}
              maxLength={1024}
              onChange={(event) => setConfirm(event.target.value)}
              type="password"
              value={confirm}
            />
            {fieldErrors.confirm ? (
              <FieldError>{fieldErrors.confirm}</FieldError>
            ) : null}
          </Field>
        </FieldGroup>
        <Button className="hidden" type="submit" />
      </form>
    </ConfirmationDialog>
  )
}

export function useIssuePasswordLink(scope: IdentityScope, userId: string) {
  const [link, setLink] = useState<WorkspacePasswordLink>()
  const [error, setError] = useState<React.ReactNode>()
  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () =>
        unwrapHubResult(
          await issueWorkspaceUserPasswordLinkFn({
            data: { scenario: fixtureScenarioFromScope(scope), userId },
          })
        )
      ),
    onError: (cause) =>
      setError(
        refusal(cause) ??
          hubActionError(
            cause,
            "The password link could not be created.",
            "Creating a password link needs a recent sign-in.",
            () => {
              setError(undefined)
              mutation.mutate()
            }
          )
      ),
    onSuccess: (created) => {
      setError(undefined)
      setLink(created)
    },
  })
  return {
    clear: () => setLink(undefined),
    clearError: () => setError(undefined),
    error,
    issue: () => {
      setError(undefined)
      mutation.mutate()
    },
    link,
    pending: mutation.isPending,
  }
}

export function PasswordLinkDialog({
  link,
  onClose,
  personName,
}: {
  link?: WorkspacePasswordLink
  onClose: () => void
  personName: string
}) {
  const { copy, reset, state: copyState } = useCopyFeedback()
  const { onOpenChangeComplete, value: shown } = useExitSafeValue(link)

  function close() {
    reset()
    onClose()
  }

  const copyLabel = copyState === "success" ? "Link copied" : "Copy link"

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) close()
      }}
      onOpenChangeComplete={onOpenChangeComplete}
      open={Boolean(link)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {shown?.purpose === "reset"
              ? "Password reset link"
              : "Password setup link"}
          </DialogTitle>
          <DialogDescription>
            Send this link to {personName} privately. It works once and is shown
            only now.
          </DialogDescription>
        </DialogHeader>
        {shown ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <IdentifierInput
                aria-label="Password link"
                className="min-w-0"
                readOnly
                value={shown.url}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={copyLabel}
                      onClick={() => void copy(shown.url)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  {copyState === "success" ? (
                    <CopySuccessIcon aria-hidden="true" />
                  ) : (
                    <CopyIcon aria-hidden="true" />
                  )}
                </TooltipTrigger>
                <TooltipContent>{copyLabel}</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-supporting text-muted-foreground">
              Expires <LocalDateTime value={shown.expires_at} />. Creating
              another link cancels this one.
            </p>
            <span className="sr-only" role="status">
              {copyState === "success" ? "Link copied" : null}
            </span>
            {copyState === "error" ? (
              <p className="text-body text-destructive" role="alert">
                The link could not be copied. Select and copy it manually.
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={close} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RemovePasswordDialog({
  invalidate,
  onOpenChange,
  open,
  owner,
  userId,
}: {
  invalidate: readonly QueryKey[]
  onOpenChange: (open: boolean) => void
  open: boolean
  owner: { kind: "self" } | { kind: "person"; name: string }
  userId: string
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<React.ReactNode>()
  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () =>
        unwrapHubResult(
          await removeWorkspaceUserPasswordFn({
            data: { self: owner.kind === "self" || undefined, userId },
          })
        )
      ),
    onError: (cause) =>
      setError(
        refusal(cause) ??
          hubActionError(
            cause,
            "The password could not be removed.",
            "Removing a password needs a recent sign-in.",
            () => {
              setError(undefined)
              mutation.mutate()
            }
          )
      ),
    onSuccess: () => {
      onOpenChange(false)
      setError(undefined)
      notifySuccess("Password removed")
      for (const queryKey of invalidate) {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
  })

  return (
    <ConfirmationDialog
      confirmLabel="Remove"
      description={
        owner.kind === "self"
          ? "You won't be able to sign in with your password any more, and your sessions on other browsers and devices will end."
          : `${owner.name}'s password stops working at once and all of their sessions end. API keys are not affected. Create a password link afterwards if they should choose a new one.`
      }
      error={error}
      kind="alert"
      onConfirm={() => mutation.mutate()}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setError(undefined)
      }}
      open={open}
      pending={mutation.isPending}
      pendingLabel="Removing"
      title="Remove password?"
      variant="destructive"
    />
  )
}
