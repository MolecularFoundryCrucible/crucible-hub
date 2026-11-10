import type { ReactNode } from "react"
import { useEffect, useId, useRef, useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { ActivityTime } from "@/components/crucible/activity-time"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  CredentialName,
  CredentialTablePending,
} from "@/components/crucible/credential-table"
import {
  ApiKeyIcon,
  CreateApiKeyIcon,
  CredentialActionsIcon,
  RenameApiKeyIcon,
  RevokeApiKeyIcon,
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
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import {
  createWorkspaceApiKeyFn,
  renameWorkspaceApiKeyFn,
  revokeWorkspaceApiKeyFn,
} from "@/data/crucible/api-keys.functions"
import {
  apiKeyQueriesKey,
  apiKeysInfiniteQueryOptions,
} from "@/data/crucible/api-keys.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type {
  WorkspaceApiKey,
  WorkspaceApiKeyState,
} from "@/data/crucible/workspace-source"
import { OneTimeCredentialDialog } from "@/features/service-accounts/one-time-credential-dialog"

export type ApiKeyOwner =
  | { kind: "self"; canCreate: boolean }
  | { kind: "person"; name: string; userId: string }

const stateOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
] as const

const expiryOptions = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "1 year" },
] as const

function conflictCode(error: unknown) {
  return error instanceof HubApiClientError
    ? error.details.conflictCode
    : undefined
}

function keyName(key: WorkspaceApiKey) {
  return key.name?.trim() || `Key ending ${key.last4}`
}

export function ApiKeysSection({
  action,
  emptyActiveText,
  owner,
  scope,
}: {
  action?: ReactNode
  emptyActiveText?: string
  owner: ApiKeyOwner
  scope: IdentityScope
}) {
  const [state, setState] = useState<WorkspaceApiKeyState>("active")
  const userId = owner.kind === "person" ? owner.userId : undefined
  const query = useInfiniteQuery(
    apiKeysInfiniteQueryOptions(scope, userId, state)
  )
  const keys = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.total ?? null
  const active = state === "active"
  const anchorId = owner.kind === "self" ? "api-keys" : undefined
  const anchored = useRef(false)

  useEffect(() => {
    if (!anchorId || anchored.current || query.isPending) return
    anchored.current = true
    if (window.location.hash === `#${anchorId}`) {
      document.getElementById(anchorId)?.scrollIntoView({ block: "start" })
    }
  }, [anchorId, query.isPending])

  return (
    <SecuritySection
      action={
        <>
          <SegmentedControl
            ariaLabel="API keys to show"
            onValueChange={setState}
            options={stateOptions}
            value={state}
          />
          {owner.kind === "self" && owner.canCreate ? (
            <NewApiKeyAction scope={scope} />
          ) : null}
          {action}
        </>
      }
      id={anchorId}
      title="API keys"
    >
      {query.isError && keys.length === 0 ? (
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
          {hubErrorMessage(query.error, "API keys could not be loaded.")}
        </SecuritySectionMessage>
      ) : query.isPending ? (
        <CredentialTablePending label="Loading API keys" />
      ) : keys.length === 0 ? (
        <SecuritySectionMessage>
          {active
            ? (emptyActiveText ??
              (owner.kind === "self"
                ? "You have no active API keys."
                : "This person has no active API keys."))
            : "No expired or revoked API keys."}
        </SecuritySectionMessage>
      ) : (
        <>
          <Table aria-label={active ? "Active API keys" : "Inactive API keys"}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Name</TableHead>
                <TableHead className="hidden @xl:table-cell" kind="date">
                  Created
                </TableHead>
                <TableHead className="hidden @md:table-cell" kind="date">
                  Last used
                </TableHead>
                <TableHead
                  className={active ? undefined : "pr-(--card-spacing)"}
                  kind="date"
                >
                  {active ? "Expires" : "Ended"}
                </TableHead>
                {active ? (
                  <TableHead className="pr-(--card-spacing)" kind="action">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <ApiKeyRow
                  apiKey={key}
                  key={key.id}
                  owner={owner}
                  scope={scope}
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
                label="API keys"
                loaded={keys.length}
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

function ApiKeyRow({
  apiKey,
  owner,
  scope,
}: {
  apiKey: WorkspaceApiKey
  owner: ApiKeyOwner
  scope: IdentityScope
}) {
  const active = apiKey.status === "active"
  const ended = apiKey.status === "revoked" ? apiKey.revoked_at : null
  return (
    <TableRow>
      <TableCell className="w-full max-w-0 pl-(--card-spacing)">
        <CredentialName
          icon={<ApiKeyIcon aria-hidden="true" />}
          name={keyName(apiKey)}
          subtitle={
            <span className="font-mono whitespace-nowrap">
              <span className="sr-only">Ends in </span>
              <span aria-hidden="true">····</span>
              {apiKey.last4}
            </span>
          }
        >
          <span className="@md:hidden">
            Last used{" "}
            <ActivityTime fallback="never" value={apiKey.last_used_at} />
          </span>
        </CredentialName>
      </TableCell>
      <TableCell className="hidden @xl:table-cell" kind="date">
        <LocalDateTime dateOnly value={apiKey.created_at} />
      </TableCell>
      <TableCell className="hidden @md:table-cell" kind="date">
        <ActivityTime fallback="Never" value={apiKey.last_used_at} />
      </TableCell>
      <TableCell
        className={active ? undefined : "pr-(--card-spacing)"}
        kind="date"
      >
        {active ? (
          <LocalDateTime dateOnly fallback="Never" value={apiKey.expires_at} />
        ) : (
          <span className="flex flex-col">
            <span>{apiKey.status === "revoked" ? "Revoked" : "Expired"}</span>
            <LocalDateTime
              className="text-supporting text-muted-foreground"
              dateOnly
              fallback=""
              value={ended ?? apiKey.expires_at}
            />
          </span>
        )}
      </TableCell>
      {active ? (
        <TableCell className="pr-(--card-spacing)" kind="action">
          <ApiKeyActions apiKey={apiKey} owner={owner} scope={scope} />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function ApiKeyActions({
  apiKey,
  owner,
  scope,
}: {
  apiKey: WorkspaceApiKey
  owner: ApiKeyOwner
  scope: IdentityScope
}) {
  const [dialog, setDialog] = useState<"rename" | "revoke">()
  const name = keyName(apiKey)
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
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            {owner.kind === "self" ? (
              <DropdownMenuItem onClick={() => setDialog("rename")}>
                <RenameApiKeyIcon aria-hidden="true" />
                Rename
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => setDialog("revoke")}
              variant="destructive"
            >
              <RevokeApiKeyIcon aria-hidden="true" />
              Revoke
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === "rename" ? (
        <RenameApiKeyDialog
          apiKey={apiKey}
          onClose={() => setDialog(undefined)}
          scope={scope}
        />
      ) : null}
      {dialog === "revoke" ? (
        <RevokeApiKeyDialog
          apiKey={apiKey}
          onClose={() => setDialog(undefined)}
          owner={owner}
          scope={scope}
        />
      ) : null}
    </>
  )
}

function RenameApiKeyDialog({
  apiKey,
  onClose,
  scope,
}: {
  apiKey: WorkspaceApiKey
  onClose: () => void
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const inputId = useId()
  const [name, setName] = useState(apiKey.name ?? "")
  const [error, setError] = useState<React.ReactNode>()
  const trimmed = name.trim()
  const mutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await renameWorkspaceApiKeyFn({
          data: {
            keyId: apiKey.id,
            name: trimmed,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
    onError: (cause) =>
      setError(hubErrorMessage(cause, "The API key could not be renamed.")),
    onSuccess: () => {
      notifySuccess("API key renamed", trimmed)
      void queryClient.invalidateQueries({
        queryKey: apiKeyQueriesKey(scope, undefined),
      })
      onClose()
    },
  })
  const submit = () => {
    if (trimmed && !mutation.isPending) mutation.mutate()
  }
  return (
    <ConfirmationDialog
      confirmDisabled={!trimmed || trimmed === (apiKey.name ?? "")}
      confirmLabel="Save"
      description={`The key ending ${apiKey.last4} keeps working under its new name.`}
      error={error}
      onConfirm={submit}
      onOpenChange={(open) => !open && onClose()}
      open
      pending={mutation.isPending}
      pendingLabel="Saving"
      title="Rename API key"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Field>
          <FieldLabel htmlFor={inputId}>Name</FieldLabel>
          <Input
            autoFocus
            id={inputId}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
      </form>
    </ConfirmationDialog>
  )
}

function RevokeApiKeyDialog({
  apiKey,
  onClose,
  owner,
  scope,
}: {
  apiKey: WorkspaceApiKey
  onClose: () => void
  owner: ApiKeyOwner
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<React.ReactNode>()
  const name = keyName(apiKey)
  const userId = owner.kind === "person" ? owner.userId : undefined
  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () =>
        unwrapHubResult(
          await revokeWorkspaceApiKeyFn({ data: { keyId: apiKey.id, userId } })
        )
      ),
    onError: (cause) =>
      setError(
        hubActionError(
          cause,
          "The API key could not be revoked.",
          "Revoking another administrator's API key needs a recent sign-in.",
          () => {
            setError(undefined)
            mutation.mutate()
          }
        )
      ),
    onSuccess: () => {
      notifySuccess("API key revoked", name)
      void queryClient.invalidateQueries({
        queryKey: apiKeyQueriesKey(scope, userId),
      })
      onClose()
    },
  })
  return (
    <ConfirmationDialog
      confirmLabel="Revoke"
      description={
        owner.kind === "self"
          ? `Scripts and tools that use the key ending ${apiKey.last4}, such as nano-crucible, stop working within a minute.`
          : `Scripts and tools that ${owner.name} runs with the key ending ${apiKey.last4} stop working within a minute.`
      }
      error={error}
      kind="alert"
      onConfirm={() => mutation.mutate()}
      onOpenChange={(open) => !open && onClose()}
      open
      pending={mutation.isPending}
      pendingLabel="Revoking"
      title={`Revoke ${name}?`}
      variant="destructive"
    />
  )
}

function NewApiKeyAction({ scope }: { scope: IdentityScope }) {
  const queryClient = useQueryClient()
  const account = useQuery(accountQueryOptions(scope)).data
  const nameId = useId()
  const expiryId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [days, setDays] = useState(365)
  const [error, setError] = useState<React.ReactNode>()
  const [apiKey, setApiKey] = useState<string>()
  const trimmed = name.trim()
  const mutation = useMutation({
    mutationFn: () =>
      withReauthentication(async () =>
        unwrapHubResult(
          await createWorkspaceApiKeyFn({
            data: {
              expiresAt:
                days === 365
                  ? null
                  : new Date(Date.now() + days * 86_400_000).toISOString(),
              name: trimmed,
              scenario: fixtureScenarioFromScope(scope),
            },
          })
        )
      ),
    onError: (cause) => {
      const code = conflictCode(cause)
      setError(
        code === "too_many_keys"
          ? "You already have 10 active API keys. Revoke one before creating another."
          : code === "hub_session_required"
            ? "API keys can only be created from a Hub sign-in."
            : hubActionError(
                cause,
                "The API key could not be created.",
                "Creating an API key needs a recent sign-in.",
                () => {
                  setError(undefined)
                  mutation.mutate()
                }
              )
      )
    },
    onSuccess: (created) => {
      setOpen(false)
      setApiKey(created.api_key)
      void queryClient.invalidateQueries({
        queryKey: apiKeyQueriesKey(scope, undefined),
      })
    },
  })
  const submit = () => {
    if (trimmed && !mutation.isPending) mutation.mutate()
  }

  return (
    <>
      <Button
        onClick={() => {
          setName("")
          setDays(365)
          setError(undefined)
          setOpen(true)
        }}
        size="sm"
        variant="outline"
      >
        <CreateApiKeyIcon aria-hidden="true" data-icon="inline-start" />
        New key
      </Button>
      <ConfirmationDialog
        confirmDisabled={!trimmed}
        confirmLabel="Create key"
        description="The key is shown once, right after you create it."
        error={error}
        onConfirm={submit}
        onOpenChange={setOpen}
        open={open}
        pending={mutation.isPending}
        pendingLabel="Creating key"
        title="New API key"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input
                autoFocus
                id={nameId}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={expiryId}>Expires after</FieldLabel>
              <NativeSelect
                id={expiryId}
                onChange={(event) => setDays(Number(event.target.value))}
                value={String(days)}
              >
                {expiryOptions.map((option) => (
                  <NativeSelectOption
                    key={option.days}
                    value={String(option.days)}
                  >
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </form>
      </ConfirmationDialog>
      <OneTimeCredentialDialog
        credential={
          apiKey && account
            ? {
                api_key: apiKey,
                unique_id: account.unique_id,
                username: account.username ?? null,
              }
            : undefined
        }
        keyLabel="Your API key"
        onClose={() => setApiKey(undefined)}
        title="API key created"
      />
    </>
  )
}
