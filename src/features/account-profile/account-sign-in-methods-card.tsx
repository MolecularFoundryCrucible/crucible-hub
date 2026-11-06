import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import orcidIdUrl from "@/assets/orcid-id.svg"
import { ActivityTime } from "@/components/crucible/activity-time"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { notifyError, notifySuccess } from "@/components/crucible/notifications"
import { OrcidValue } from "@/components/crucible/orcid-value"
import { hubActionError } from "@/components/crucible/reauthentication"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  cancelWorkspaceAccountLinkFn,
  confirmWorkspaceAccountLinkFn,
  removeWorkspaceAccountIdentityFn,
  startWorkspaceAccountLinkFn,
} from "@/data/crucible/account-identities.functions"
import {
  accountIdentitiesQueryOptions,
  accountPendingLinkQueryOptions,
  signInMethodsQueryOptions,
} from "@/data/crucible/account-identities.queries"
import type { HubConflictCode } from "@/data/crucible/errors"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type { WorkspaceAccountIdentity } from "@/data/crucible/workspace-source"

export type AccountLinkOutcome =
  "pending" | "retry" | "cancelled" | "expired" | "failed"

type SignInMethod = { display_name: string; is_orcid: boolean; key: string }

const linkOutcomeMessages: Record<
  Exclude<AccountLinkOutcome, "pending">,
  string
> = {
  retry:
    "The provider didn't ask you to sign in again, which adding a sign-in method requires. Try again.",
  cancelled: "Signing in with the provider was cancelled.",
  expired: "The request expired or was started in another session. Try again.",
  failed: "The sign-in method could not be added. Try again.",
}

const refusals: Partial<Record<HubConflictCode | "unknown", string>> = {
  linked_elsewhere:
    "This login already belongs to another Crucible account, so it can't be added to yours.",
  second_orcid:
    "Your account already has an ORCID, and an account can have only one.",
  orcid_of_another:
    "This ORCID is the ID of another Crucible account, so it can't be added to yours. If both accounts are yours, ask an administrator.",
  link_expired:
    "This request expired or was already used. Add the sign-in method again.",
  unknown: "This login can't be added to your account.",
}

function conflictCode(error: unknown) {
  return error instanceof HubApiClientError
    ? error.details.conflictCode
    : undefined
}

function identityName(identity: {
  label?: string | null
  providerName: string
}) {
  return identity.label
    ? `${identity.providerName} (${identity.label})`
    : identity.providerName
}

export function addableSignInMethods(
  methods: readonly SignInMethod[] | null | undefined,
  identities: readonly WorkspaceAccountIdentity[]
) {
  const linked = new Set(
    identities.flatMap((identity) =>
      identity.provider_key ? [identity.provider_key] : []
    )
  )
  const hasOrcid = identities.some((identity) => identity.orcid)
  return (methods ?? []).filter(
    (method) => !linked.has(method.key) && !(method.is_orcid && hasOrcid)
  )
}

export function AccountSignInMethodsCard({
  linkOutcome,
  onLinkOutcomeHandled,
  scope,
}: {
  linkOutcome?: AccountLinkOutcome
  onLinkOutcomeHandled: () => void
  scope: IdentityScope
}) {
  const identities = useQuery(accountIdentitiesQueryOptions(scope))
  const methods = useQuery(signInMethodsQueryOptions(scope))
  const announced = useRef(false)

  useEffect(() => {
    if (!linkOutcome || linkOutcome === "pending" || announced.current) return
    announced.current = true
    notifyError("Sign-in method not added", linkOutcomeMessages[linkOutcome])
    onLinkOutcomeHandled()
  }, [linkOutcome, onLinkOutcomeHandled])

  if (conflictCode(identities.error) === "identity_lookup_off") return null

  const list = identities.data ?? []
  const addable = identities.data
    ? addableSignInMethods(methods.data, list)
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in methods</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {identities.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-body text-destructive" role="alert">
              {hubErrorMessage(
                identities.error,
                "Your sign-in methods could not be loaded."
              )}
            </p>
            <Button
              onClick={() => void identities.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : identities.isPending ? (
          <p className="text-body text-muted-foreground" role="status">
            Loading sign-in methods
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {list.map((identity) => (
              <SignInMethodRow
                identity={identity}
                key={identity.id}
                removable={list.length > 1}
                scope={scope}
              />
            ))}
          </ul>
        )}
        {addable.length > 0 ? <AddSignInMethods methods={addable} /> : null}
      </CardContent>
      {linkOutcome === "pending" ? (
        <PendingLinkDialog onDone={onLinkOutcomeHandled} scope={scope} />
      ) : null}
    </Card>
  )
}

function SignInMethodRow({
  identity,
  removable,
  scope,
}: {
  identity: WorkspaceAccountIdentity
  removable: boolean
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<React.ReactNode>()
  const name = identityName({
    label: identity.label,
    providerName: identity.provider_name,
  })
  const mutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await removeWorkspaceAccountIdentityFn({
          data: { identityId: identity.id },
        })
      ),
    onError: (cause) =>
      setError(
        conflictCode(cause) === "last_sign_in_method"
          ? "This is your only way to sign in, so it can't be removed."
          : hubActionError(
              cause,
              "The sign-in method could not be removed.",
              "Removing a sign-in method needs a recent sign-in."
            )
      ),
    onSuccess: () => {
      setConfirming(false)
      setError(undefined)
      notifySuccess("Sign-in method removed", name)
      void queryClient.invalidateQueries({
        queryKey: accountIdentitiesQueryOptions(scope).queryKey,
      })
    },
  })

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-label">{name}</span>
        {identity.orcid ? (
          <OrcidValue
            orcid={identity.orcid}
            verified={identity.verified_at !== null}
          />
        ) : null}
        <span className="text-supporting text-muted-foreground">
          {identity.verified_at ? (
            <>
              Verified <ActivityTime fallback="" value={identity.verified_at} />
              {" · "}
            </>
          ) : null}
          Last used{" "}
          <ActivityTime fallback="never" value={identity.last_used_at} />
        </span>
      </div>
      <Button
        disabled={!removable}
        onClick={() => setConfirming(true)}
        size="sm"
        title={
          removable ? undefined : "Your only way to sign in can't be removed."
        }
        variant="outline"
      >
        Remove
      </Button>
      <ConfirmationDialog
        confirmLabel="Remove"
        description={`You won't be able to sign in with ${name} any more, and your Hub sessions on other browsers and devices will end. If anyone can register with this provider, signing in with it again later creates a new, separate Crucible account.`}
        error={error}
        kind="alert"
        onConfirm={() => mutation.mutate()}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) setError(undefined)
        }}
        open={confirming}
        pending={mutation.isPending}
        pendingLabel="Removing"
        title={`Remove ${name}?`}
        variant="destructive"
      />
    </li>
  )
}

function AddSignInMethods({ methods }: { methods: readonly SignInMethod[] }) {
  const [error, setError] = useState<React.ReactNode>()
  const mutation = useMutation({
    mutationFn: async (providerKey: string) =>
      unwrapHubResult(
        await startWorkspaceAccountLinkFn({ data: { providerKey } })
      ),
    onError: (cause) =>
      setError(
        hubActionError(
          cause,
          "The sign-in method could not be added.",
          "Adding a sign-in method needs a recent sign-in."
        )
      ),
    onSuccess: ({ authorizationUrl }) => {
      window.location.assign(authorizationUrl)
    },
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <Button
            disabled={mutation.isPending}
            key={method.key}
            onClick={() => {
              setError(undefined)
              mutation.mutate(method.key)
            }}
            size="sm"
            variant="outline"
          >
            {method.is_orcid ? (
              <img
                alt=""
                aria-hidden="true"
                className="size-icon-label"
                data-icon="inline-start"
                src={orcidIdUrl}
              />
            ) : null}
            Add {method.display_name}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function PendingLinkDialog({
  onDone,
  scope,
}: {
  onDone: () => void
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const preview = useQuery(accountPendingLinkQueryOptions(scope))
  const [open, setOpen] = useState(true)
  const [refusal, setRefusal] = useState<string>()

  function close(cancel: boolean) {
    setOpen(false)
    if (cancel) void cancelWorkspaceAccountLinkFn().catch(() => undefined)
    queryClient.removeQueries({
      queryKey: accountPendingLinkQueryOptions(scope).queryKey,
    })
    onDone()
  }

  const confirm = useMutation({
    mutationFn: async () =>
      unwrapHubResult(await confirmWorkspaceAccountLinkFn()),
    onError: (cause) => {
      const code = conflictCode(cause)
      setRefusal(
        (code && refusals[code]) ??
          hubErrorMessage(cause, "The sign-in method could not be added.")
      )
    },
    onSuccess: () => {
      notifySuccess("Sign-in method added")
      void queryClient.invalidateQueries({
        queryKey: accountIdentitiesQueryOptions(scope).queryKey,
      })
      close(false)
    },
  })

  if (preview.isPending) return null
  const data = preview.data
  const loadRefusal = preview.isError
    ? ((conflictCode(preview.error) &&
        refusals[conflictCode(preview.error)!]) ??
      hubErrorMessage(preview.error, "The sign-in method could not be added."))
    : !data
      ? refusals.link_expired
      : data.status === "available" || data.status === "already_yours"
        ? undefined
        : refusals[data.status]
  const message = refusal ?? loadRefusal

  if (message || !data) {
    return (
      <Dialog onOpenChange={(next) => !next && close(true)} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign-in method not added</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const name = identityName(data)
  const alreadyYours = data.status === "already_yours"
  return (
    <ConfirmationDialog
      confirmLabel={alreadyYours ? "Mark as verified" : "Add sign-in method"}
      description={
        alreadyYours
          ? `${name} is already one of your sign-in methods. Confirm to mark it verified.`
          : `Add ${name} as a way to sign in to your Crucible account?`
      }
      onConfirm={() => confirm.mutate()}
      onOpenChange={(next) => {
        if (!next) close(true)
      }}
      open={open}
      pending={confirm.isPending}
      pendingLabel={alreadyYours ? "Marking as verified" : "Adding"}
      title={alreadyYours ? "Mark this login verified?" : "Add sign-in method?"}
    >
      {data.orcid ? <OrcidValue orcid={data.orcid} verified /> : null}
    </ConfirmationDialog>
  )
}
