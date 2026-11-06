import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"

import orcidIdUrl from "@/assets/orcid-id.svg"
import { ActivityTime } from "@/components/crucible/activity-time"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  CredentialList,
  CredentialRow,
} from "@/components/crucible/credential-row"
import {
  AddSignInMethodIcon,
  CredentialActionsIcon,
  RemoveSignInMethodIcon,
  SignInMethodIcon,
  VerifiedCredentialIcon,
} from "@/components/crucible/icons"
import { notifyError, notifySuccess } from "@/components/crucible/notifications"
import { OrcidValue } from "@/components/crucible/orcid-value"
import { hubActionError } from "@/components/crucible/reauthentication"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
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
  userIdentitiesQueryOptions,
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
    <SignInMethodsCard
      action={
        addable.length > 0 ? <AddSignInMethodMenu methods={addable} /> : null
      }
      emptyText="You have no sign-in methods."
      errorText="Your sign-in methods could not be loaded."
      query={identities}
      renderActions={(identity) => (
        <RemoveSignInMethodAction
          identity={identity}
          removable={list.length > 1}
          scope={scope}
        />
      )}
    >
      {linkOutcome === "pending" ? (
        <PendingLinkDialog onDone={onLinkOutcomeHandled} scope={scope} />
      ) : null}
    </SignInMethodsCard>
  )
}

export function PersonSignInMethodsCard({
  scope,
  userId,
}: {
  scope: IdentityScope
  userId: string
}) {
  const identities = useQuery(userIdentitiesQueryOptions(scope, userId))
  if (conflictCode(identities.error) === "identity_lookup_off") return null
  return (
    <SignInMethodsCard
      emptyText="This person has no sign-in methods."
      errorText="This person's sign-in methods could not be loaded."
      query={identities}
    />
  )
}

function SignInMethodsCard({
  action,
  children,
  emptyText,
  errorText,
  query,
  renderActions,
}: {
  action?: React.ReactNode
  children?: React.ReactNode
  emptyText: string
  errorText: string
  query: UseQueryResult<WorkspaceAccountIdentity[]>
  renderActions?: (identity: WorkspaceAccountIdentity) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SignInMethodIcon aria-hidden="true" />
          Sign-in methods
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        {query.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-muted-foreground" role="alert">
              {hubErrorMessage(query.error, errorText)}
            </p>
            <Button
              onClick={() => void query.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : query.isPending ? (
          <CredentialList>
            <li className="flex items-center gap-3" role="status">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <span className="sr-only">Loading sign-in methods</span>
            </li>
          </CredentialList>
        ) : query.data.length === 0 ? (
          <p className="text-body text-muted-foreground">{emptyText}</p>
        ) : (
          <CredentialList>
            {query.data.map((identity) => (
              <SignInMethodRow
                actions={renderActions?.(identity)}
                identity={identity}
                key={identity.id}
              />
            ))}
          </CredentialList>
        )}
      </CardContent>
      {children}
    </Card>
  )
}

function SignInMethodRow({
  actions,
  identity,
}: {
  actions?: React.ReactNode
  identity: WorkspaceAccountIdentity
}) {
  const verified = identity.verified_at !== null
  return (
    <CredentialRow
      actions={actions}
      badge={
        verified ? (
          <Badge variant="success">
            <VerifiedCredentialIcon
              aria-hidden="true"
              data-icon="inline-start"
            />
            Verified
          </Badge>
        ) : (
          <Badge variant="outline">Not verified</Badge>
        )
      }
      details={
        <>
          {verified ? "Verified " : "Added "}
          <ActivityTime
            fallback=""
            value={verified ? identity.verified_at : identity.created_at}
          />
          {" · "}
          {identity.last_used_at ? (
            <>
              Last used{" "}
              <ActivityTime fallback="" value={identity.last_used_at} />
            </>
          ) : (
            "Never used"
          )}
        </>
      }
      icon={
        identity.orcid && verified ? (
          <img alt="" className="size-5" src={orcidIdUrl} />
        ) : (
          <SignInMethodIcon className="size-4" />
        )
      }
      subtitle={
        identity.orcid ? (
          <OrcidValue orcid={identity.orcid} plain verified={verified} />
        ) : identity.label ? (
          <span className="text-body break-words text-muted-foreground">
            {identity.label}
          </span>
        ) : null
      }
      title={identity.provider_name}
    />
  )
}

function RemoveSignInMethodAction({
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${name}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <CredentialActionsIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem
            disabled={!removable}
            onClick={() => setConfirming(true)}
            variant="destructive"
          >
            <RemoveSignInMethodIcon aria-hidden="true" />
            {removable ? "Remove" : "Remove (your only sign-in method)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    </>
  )
}

function AddSignInMethodMenu({
  methods,
}: {
  methods: readonly SignInMethod[]
}) {
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
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={mutation.isPending}
          render={<Button size="sm" variant="outline" />}
        >
          <AddSignInMethodIcon aria-hidden="true" data-icon="inline-start" />
          Add sign-in method
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Sign in with</DropdownMenuLabel>
            {methods.map((method) => (
              <DropdownMenuItem
                key={method.key}
                onClick={() => {
                  setError(undefined)
                  mutation.mutate(method.key)
                }}
              >
                {method.is_orcid ? (
                  <img alt="" className="size-4" src={orcidIdUrl} />
                ) : (
                  <SignInMethodIcon aria-hidden="true" />
                )}
                {method.display_name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p
          className="max-w-xs text-right text-body text-destructive"
          role="alert"
        >
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
