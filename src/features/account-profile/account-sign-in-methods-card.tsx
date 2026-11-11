import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { QueryKey, UseQueryResult } from "@tanstack/react-query"

import orcidIdUrl from "@/assets/orcid-id.svg"
import { ActivityTime } from "@/components/crucible/activity-time"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  CredentialName,
  CredentialTablePending,
} from "@/components/crucible/credential-table"
import {
  AddSignInMethodIcon,
  ChangePasswordIcon,
  CredentialActionsIcon,
  PasswordIcon,
  PasswordLinkIcon,
  RemoveSignInMethodIcon,
  SignInMethodIcon,
  VerifiedCredentialIcon,
} from "@/components/crucible/icons"
import { useFeatureEnabled } from "@/components/crucible/workspace-provider"
import { notifyError, notifySuccess } from "@/components/crucible/notifications"
import { OrcidValue } from "@/components/crucible/orcid-value"
import { LocalDateTime } from "@/components/crucible/local-date-time"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  cancelWorkspaceAccountLinkFn,
  confirmWorkspaceAccountLinkFn,
  removeWorkspaceAccountIdentityFn,
  removeWorkspaceUserIdentityFn,
  startWorkspaceAccountLinkFn,
} from "@/data/crucible/account-identities.functions"
import {
  accountIdentitiesQueryOptions,
  accountPendingLinkQueryOptions,
  signInMethodsQueryOptions,
  userIdentitiesQueryOptions,
} from "@/data/crucible/account-identities.queries"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import type { HubConflictCode } from "@/data/crucible/errors"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type { HubResult } from "@/data/crucible/result"
import type { WorkspaceAccountIdentity } from "@/data/crucible/workspace-source"

import {
  PasswordLinkDialog,
  RemovePasswordDialog,
  SetPasswordDialog,
  useIssuePasswordLink,
} from "./password-actions"

export type AccountLinkOutcome =
  "pending" | "retry" | "cancelled" | "expired" | "failed"

type SignInMethod = {
  display_name: string
  is_orcid: boolean
  key: string
  kind?: "oidc" | "password"
}

function passwordsOffered(methods: readonly SignInMethod[] | null | undefined) {
  return methods?.some((method) => method.kind === "password") ?? false
}

function hasPasswordFrom(signInMethods: readonly string[] | null | undefined) {
  return signInMethods ? signInMethods.includes("password") : null
}

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
    (method) =>
      method.kind !== "password" &&
      !linked.has(method.key) &&
      !(method.is_orcid && hasOrcid)
  )
}

export function AccountSignInMethodsSection({
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
  const account = useQuery(accountQueryOptions(scope)).data
  const announced = useRef(false)
  const [settingPassword, setSettingPassword] = useState(false)
  const [removingPassword, setRemovingPassword] = useState(false)
  const passwordsEnabled = useFeatureEnabled("passwords")

  useEffect(() => {
    if (!linkOutcome || linkOutcome === "pending" || announced.current) return
    announced.current = true
    notifyError("Sign-in method not added", linkOutcomeMessages[linkOutcome])
    onLinkOutcomeHandled()
  }, [linkOutcome, onLinkOutcomeHandled])

  const lookupOff = conflictCode(identities.error) === "identity_lookup_off"
  useEffect(() => {
    if (!lookupOff || linkOutcome !== "pending") return
    void cancelWorkspaceAccountLinkFn().catch(() => undefined)
    onLinkOutcomeHandled()
  }, [linkOutcome, lookupOff, onLinkOutcomeHandled])

  if (lookupOff) return null

  const list = identities.data ?? []
  const addable = identities.data
    ? addableSignInMethods(methods.data, list)
    : []
  const hasPassword = hasPasswordFrom(account?.sign_in_methods)
  const canSetPassword =
    passwordsEnabled &&
    passwordsOffered(methods.data) &&
    hasPassword !== true &&
    account?.is_service_account !== true
  const ways = list.length + (hasPassword ? 1 : 0)

  return (
    <SignInMethodsSection
      action={
        addable.length > 0 || canSetPassword ? (
          <AddSignInMethodMenu
            methods={addable}
            onSetPassword={
              canSetPassword ? () => setSettingPassword(true) : undefined
            }
          />
        ) : null
      }
      emptyText="You have no sign-in methods."
      errorText="Your sign-in methods could not be loaded."
      passwordRow={
        hasPassword ? (
          <PasswordRow
            actions={
              <PasswordRowMenu>
                {passwordsEnabled ? (
                  <DropdownMenuItem onClick={() => setSettingPassword(true)}>
                    <ChangePasswordIcon aria-hidden="true" />
                    Change password
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  disabled={list.length === 0}
                  onClick={() => setRemovingPassword(true)}
                  variant="destructive"
                >
                  <RemoveSignInMethodIcon aria-hidden="true" />
                  Remove
                </DropdownMenuItem>
              </PasswordRowMenu>
            }
          />
        ) : null
      }
      query={identities}
      renderActions={(identity) => (
        <RemoveSignInMethodAction
          identity={identity}
          invalidate={accountIdentitiesQueryOptions(scope).queryKey}
          owner={{ kind: "self" }}
          remove={() =>
            removeWorkspaceAccountIdentityFn({
              data: { identityId: identity.id },
            })
          }
          removable={ways > 1}
        />
      )}
    >
      {linkOutcome === "pending" ? (
        <PendingLinkDialog onDone={onLinkOutcomeHandled} scope={scope} />
      ) : null}
      <SetPasswordDialog
        hasPassword={hasPassword}
        key={String(hasPassword)}
        onOpenChange={setSettingPassword}
        open={settingPassword}
        scope={scope}
        username={account?.username ?? null}
      />
      {account ? (
        <RemovePasswordDialog
          invalidate={[
            crucibleKeys.accountProfile(scope),
            crucibleKeys.accountSessions(scope),
          ]}
          onOpenChange={setRemovingPassword}
          open={removingPassword}
          owner={{ kind: "self" }}
          userId={account.unique_id}
        />
      ) : null}
    </SignInMethodsSection>
  )
}

export type PersonPasswordState = {
  canHavePassword: boolean
  signInMethods: readonly string[] | null | undefined
}

export function PersonSignInMethodsSection({
  password,
  personName,
  scope,
  userId,
}: {
  password?: PersonPasswordState
  personName: string
  scope: IdentityScope
  userId: string
}) {
  const identities = useQuery(userIdentitiesQueryOptions(scope, userId))
  const methods = useQuery(signInMethodsQueryOptions(scope))
  const link = useIssuePasswordLink(scope, userId)
  const [removingPassword, setRemovingPassword] = useState(false)
  const passwordsEnabled = useFeatureEnabled("passwords")
  if (conflictCode(identities.error) === "identity_lookup_off") return null
  const hasPassword = hasPasswordFrom(password?.signInMethods)
  const count = (identities.data?.length ?? 0) + (hasPassword ? 1 : 0)
  const own = userId === scope[2]
  const managesPasswords =
    passwordsEnabled &&
    password?.canHavePassword === true &&
    passwordsOffered(methods.data)
  return (
    <SignInMethodsSection
      action={
        managesPasswords && hasPassword === false ? (
          <div className="flex flex-col items-end gap-2">
            <Button
              disabled={link.pending}
              onClick={link.issue}
              size="sm"
              variant="outline"
            >
              <PasswordLinkIcon aria-hidden="true" data-icon="inline-start" />
              Password setup link
            </Button>
            {link.error ? (
              <p
                className="max-w-xs text-right text-body text-destructive"
                role="alert"
              >
                {link.error}
              </p>
            ) : null}
          </div>
        ) : null
      }
      emptyText="This person has no sign-in methods."
      errorText="This person's sign-in methods could not be loaded."
      passwordRow={
        hasPassword ? (
          <PasswordRow
            actions={
              managesPasswords ? (
                <PasswordRowMenu>
                  <DropdownMenuItem
                    disabled={link.pending}
                    onClick={link.issue}
                  >
                    <PasswordLinkIcon aria-hidden="true" />
                    Password reset link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setRemovingPassword(true)}
                    variant="destructive"
                  >
                    <RemoveSignInMethodIcon aria-hidden="true" />
                    Remove
                  </DropdownMenuItem>
                </PasswordRowMenu>
              ) : null
            }
            error={link.error}
          />
        ) : null
      }
      query={identities}
      renderActions={(identity) => (
        <RemoveSignInMethodAction
          identity={identity}
          invalidate={userIdentitiesQueryOptions(scope, userId).queryKey}
          owner={own ? { kind: "self" } : { kind: "person", name: personName }}
          remove={() =>
            own
              ? removeWorkspaceAccountIdentityFn({
                  data: { identityId: identity.id },
                })
              : removeWorkspaceUserIdentityFn({
                  data: { identityId: identity.id, userId },
                })
          }
          removable={count > 1}
        />
      )}
    >
      <PasswordLinkDialog
        link={link.link}
        onClose={link.clear}
        personName={own ? "yourself" : personName}
      />
      <RemovePasswordDialog
        invalidate={[
          crucibleKeys.userAdminDetail(scope, userId),
          crucibleKeys.userSessions(scope, userId),
          crucibleKeys.accountProfile(scope),
        ]}
        onOpenChange={setRemovingPassword}
        open={removingPassword}
        owner={{ kind: "person", name: personName }}
        userId={userId}
      />
    </SignInMethodsSection>
  )
}

function PasswordRowMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Actions for Password"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <CredentialActionsIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PasswordRow({
  actions,
  error,
}: {
  actions: React.ReactNode
  error?: React.ReactNode
}) {
  return (
    <TableRow>
      <TableCell className="w-full max-w-0 pl-(--card-spacing)">
        <CredentialName
          icon={<PasswordIcon aria-hidden="true" />}
          name="Password"
          subtitle={
            error ? (
              <span className="text-destructive" role="alert">
                {error}
              </span>
            ) : undefined
          }
        />
      </TableCell>
      <TableCell className="hidden @xl:table-cell" kind="date" />
      <TableCell className="hidden @md:table-cell" kind="date" />
      <TableCell className="pr-(--card-spacing)" kind="action">
        {actions}
      </TableCell>
    </TableRow>
  )
}

function SignInMethodsSection({
  action,
  children,
  emptyText,
  errorText,
  passwordRow,
  query,
  renderActions,
}: {
  action?: React.ReactNode
  children?: React.ReactNode
  emptyText: string
  errorText: string
  passwordRow?: React.ReactNode
  query: UseQueryResult<WorkspaceAccountIdentity[]>
  renderActions: (identity: WorkspaceAccountIdentity) => React.ReactNode
}) {
  return (
    <SecuritySection action={action} title="Sign-in methods">
      {query.isError ? (
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
          {hubErrorMessage(query.error, errorText)}
        </SecuritySectionMessage>
      ) : query.isPending ? (
        <CredentialTablePending label="Loading sign-in methods" />
      ) : query.data.length === 0 && !passwordRow ? (
        <SecuritySectionMessage>{emptyText}</SecuritySectionMessage>
      ) : (
        <Table aria-label="Sign-in methods">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Method</TableHead>
              <TableHead className="hidden @xl:table-cell" kind="date">
                Added
              </TableHead>
              <TableHead className="hidden @md:table-cell" kind="date">
                Last used
              </TableHead>
              <TableHead className="pr-(--card-spacing)" kind="action">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {passwordRow}
            {query.data.map((identity) => (
              <SignInMethodRow
                actions={renderActions(identity)}
                identity={identity}
                key={identity.id}
              />
            ))}
          </TableBody>
        </Table>
      )}
      {children}
    </SecuritySection>
  )
}

function SignInMethodRow({
  actions,
  identity,
}: {
  actions: React.ReactNode
  identity: WorkspaceAccountIdentity
}) {
  const verified = identity.verified_at !== null
  return (
    <TableRow>
      <TableCell className="w-full max-w-0 pl-(--card-spacing)">
        <CredentialName
          icon={
            identity.orcid && verified ? (
              <img alt="" className="size-icon-label" src={orcidIdUrl} />
            ) : (
              <SignInMethodIcon aria-hidden="true" />
            )
          }
          name={
            <>
              {identity.provider_name}
              {verified ? (
                <VerifiedCredentialIcon
                  aria-label="Verified"
                  className="size-icon-label shrink-0 text-success"
                  role="img"
                />
              ) : null}
            </>
          }
          subtitle={
            identity.orcid ? (
              <OrcidValue
                orcid={identity.orcid}
                plain={verified}
                verified={verified}
              />
            ) : (
              identity.label
            )
          }
        >
          <span className="@md:hidden">
            Last used{" "}
            <ActivityTime fallback="never" value={identity.last_used_at} />
          </span>
        </CredentialName>
      </TableCell>
      <TableCell className="hidden @xl:table-cell" kind="date">
        <LocalDateTime dateOnly value={identity.created_at} />
      </TableCell>
      <TableCell className="hidden @md:table-cell" kind="date">
        <ActivityTime fallback="Never" value={identity.last_used_at} />
      </TableCell>
      <TableCell className="pr-(--card-spacing)" kind="action">
        {actions}
      </TableCell>
    </TableRow>
  )
}

type RemovalOwner = { kind: "self" } | { kind: "person"; name: string }

function removalCopy(owner: RemovalOwner, name: string) {
  if (owner.kind === "self") {
    return {
      description: `You won't be able to sign in with ${name} any more, and your Hub sessions on other browsers and devices will end. If anyone can register with this provider, signing in with it again later creates a new, separate Crucible account.`,
      last: "This is your only way to sign in, so it can't be removed.",
    }
  }
  return {
    description: `${owner.name} won't be able to sign in with ${name} any more, and all of their Hub sessions will end. If anyone can register with this provider, signing in with it again later creates a new, separate Crucible account.`,
    last: "This is their only way to sign in, so it can't be removed.",
    unavailable: "Remove (their only sign-in method)",
  }
}

function RemoveSignInMethodAction({
  identity,
  invalidate,
  owner,
  remove,
  removable,
}: {
  identity: WorkspaceAccountIdentity
  invalidate: QueryKey
  owner: RemovalOwner
  remove: () => Promise<HubResult<unknown>>
  removable: boolean
}) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<React.ReactNode>()
  const name = identityName({
    label: identity.label,
    providerName: identity.provider_name,
  })
  const copy = removalCopy(owner, name)
  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () => unwrapHubResult(await remove())),
    onError: (cause) =>
      setError(
        conflictCode(cause) === "last_sign_in_method"
          ? copy.last
          : hubActionError(
              cause,
              "The sign-in method could not be removed.",
              "Removing a sign-in method needs a recent sign-in.",
              () => {
                setError(undefined)
                mutation.mutate()
              }
            )
      ),
    onSuccess: () => {
      setConfirming(false)
      setError(undefined)
      notifySuccess("Sign-in method removed", name)
      void queryClient.invalidateQueries({ queryKey: invalidate })
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
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationDialog
        confirmLabel="Remove"
        description={copy.description}
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
  onSetPassword,
}: {
  methods: readonly SignInMethod[]
  onSetPassword?: () => void
}) {
  const [error, setError] = useState<React.ReactNode>()
  const mutation = useMutation({
    mutationFn: (providerKey: string) =>
      withReauthentication(async () =>
        unwrapHubResult(
          await startWorkspaceAccountLinkFn({ data: { providerKey } })
        )
      ),
    onError: (cause, providerKey) =>
      setError(
        conflictCode(cause) === "too_many_links"
          ? "You've started too many sign-in links. Try again in about 10 minutes."
          : hubActionError(
              cause,
              "The sign-in method could not be added.",
              "Adding a sign-in method needs a recent sign-in.",
              () => {
                setError(undefined)
                mutation.mutate(providerKey)
              }
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
            {onSetPassword ? (
              <DropdownMenuItem
                onClick={() => {
                  setError(undefined)
                  onSetPassword()
                }}
              >
                <PasswordIcon aria-hidden="true" />
                Password
              </DropdownMenuItem>
            ) : null}
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
