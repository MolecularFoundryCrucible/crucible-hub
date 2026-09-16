import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import {
  CredentialIcon,
  EditResourceIcon,
  RotateCredentialIcon,
} from "@/components/crucible/icons"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { applyPersonProfileUpdate } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import {
  rotateWorkspaceServiceAccountKey,
  serviceAccountUsernameSchema,
  updateWorkspaceServiceAccount,
} from "@/data/crucible/service-accounts.functions"
import type {
  WorkspaceMode,
  WorkspaceServiceAccountCredential,
  WorkspaceServiceAccountDetail,
  WorkspaceServiceAccountProfileUpdate,
} from "@/data/crucible/workspace-source"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import { formatDate } from "@/lib/format"

import { OneTimeCredentialDialog } from "./one-time-credential-dialog"

const serviceAccountProfileSchema = z.object({
  email: z
    .string()
    .trim()
    .max(320, "Use 320 characters or fewer for email.")
    .refine(
      (value) =>
        value.length === 0 || z.string().email().safeParse(value).success,
      "Enter a valid email address."
    ),
  first_name: z.string().trim().max(255),
  last_name: z.string().trim().max(255),
  username: serviceAccountUsernameSchema,
})

type ProfileValues = z.infer<typeof serviceAccountProfileSchema>

function profileValues(account: WorkspaceServiceAccountDetail): ProfileValues {
  return {
    email: account.email ?? "",
    first_name: account.first_name,
    last_name: account.last_name,
    username: account.username,
  }
}

function profileChanges(
  account: WorkspaceServiceAccountDetail,
  values: ProfileValues
): WorkspaceServiceAccountProfileUpdate {
  const normalized = serviceAccountProfileSchema.parse(values)
  const initial = profileValues(account)
  const changes: WorkspaceServiceAccountProfileUpdate = {}
  for (const field of ["first_name", "last_name"] as const) {
    if (normalized[field] !== initial[field]) {
      changes[field] = normalized[field]
    }
  }
  if (normalized.email !== initial.email)
    changes.email = normalized.email || null
  if (normalized.username !== initial.username) {
    changes.username = normalized.username
  }
  return changes
}

export function ServiceAccountDetail({
  account,
  mode,
  scope,
}: {
  account: WorkspaceServiceAccountDetail
  mode: WorkspaceMode
  scope: IdentityScope
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <ServiceAccountIdentityCard account={account} mode={mode} scope={scope} />
      <ServiceAccountCredentialCard account={account} scope={scope} />
    </div>
  )
}

function ServiceAccountIdentityCard({
  account,
  mode,
  scope,
}: {
  account: WorkspaceServiceAccountDetail
  mode: WorkspaceMode
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (changes: WorkspaceServiceAccountProfileUpdate) =>
      unwrapHubResult(
        await updateWorkspaceServiceAccount({
          data: {
            changes,
            scenario: fixtureScenarioFromScope(scope),
            serviceAccountMfid: account.unique_id,
          },
        })
      ),
  })
  const form = useForm({
    defaultValues: profileValues(account),
    validators: { onChange: serviceAccountProfileSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const changes = profileChanges(account, value)
      if (Object.keys(changes).length === 0) return
      try {
        const updated = await mutation.mutateAsync(changes)
        queryClient.setQueryData(
          crucibleKeys.serviceAccountAdmin(scope, account.unique_id),
          updated
        )
        void Promise.all([
          applyPersonProfileUpdate(queryClient, scope, updated),
          queryClient.invalidateQueries({
            queryKey: crucibleKeys.serviceAccountLists(scope),
            refetchType: mode === "api" ? "active" : "none",
          }),
        ])
        form.reset({
          email: updated.email ?? "",
          first_name: updated.first_name,
          last_name: updated.last_name,
          username: updated.username,
        })
        setEditing(false)
      } catch (cause) {
        setError(
          cause instanceof HubApiClientError
            ? cause.message
            : "The service-account profile could not be saved."
        )
      }
    },
  })
  const dirty = useStore(form.store, (state) => state.isDirty)
  const submitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(dirty, () => {
    form.reset()
    setError(undefined)
    setEditing(false)
  })
  const formId = `service-account-profile-${account.unique_id}`

  if (!editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardAction>
            <Button onClick={() => setEditing(true)} variant="outline">
              <EditResourceIcon aria-hidden="true" data-icon="inline-start" />
              Edit profile
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PersonIdentity person={account} presentation="avatar" size="lg" />
            <PlatformRoleBadge role={account.platform_role} />
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-label text-muted-foreground">Email</dt>
              <dd className="mt-1 text-body break-words">
                {account.email ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Username</dt>
              <dd className="mt-1 text-body break-words">
                @{account.username}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-label text-muted-foreground">Crucible ID</dt>
              <dd className="mt-1">
                <MfidValue value={account.unique_id} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card aria-busy={submitting}>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <fieldset disabled={submitting}>
              <FieldGroup>
                {(
                  ["first_name", "last_name", "email", "username"] as const
                ).map((name) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <Field data-invalid={!field.state.meta.isValid}>
                        <FieldLabel
                          htmlFor={field.name}
                          optional={name !== "username"}
                        >
                          {profileFieldLabel(name)}
                        </FieldLabel>
                        <Input
                          aria-invalid={!field.state.meta.isValid || undefined}
                          id={field.name}
                          maxLength={
                            name === "email"
                              ? 320
                              : name === "username"
                                ? 255
                                : 255
                          }
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          type={name === "email" ? "email" : "text"}
                          value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                ))}
              </FieldGroup>
            </fieldset>
            {error ? (
              <p className="mt-4 text-body text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isDirty,
            state.isSubmitting,
          ]}
        >
          {([canSubmit, isDirty, isSubmitting]) => (
            <EditableCardActions
              canSubmit={canSubmit}
              dirty={isDirty}
              formId={formId}
              onCancel={discard.requestCancel}
              pending={isSubmitting}
            />
          )}
        </form.Subscribe>
      </Card>
      <DiscardChangesDialog {...discard.dialog} />
    </>
  )
}

function ServiceAccountCredentialCard({
  account,
  scope,
}: {
  account: WorkspaceServiceAccountDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [credential, setCredential] =
    useState<WorkspaceServiceAccountCredential>()
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await rotateWorkspaceServiceAccountKey({
          data: {
            scenario: fixtureScenarioFromScope(scope),
            serviceAccountMfid: account.unique_id,
          },
        })
      ),
  })
  const status = account.api_key_status

  async function rotateKey() {
    setError(undefined)
    try {
      const nextCredential = await mutation.mutateAsync()
      setConfirming(false)
      setCredential(nextCredential)
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.serviceAccountAdmin(scope, account.unique_id),
      })
    } catch (cause) {
      setError(
        cause instanceof HubApiClientError
          ? cause.message
          : "The API key could not be rotated."
      )
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CredentialIcon aria-hidden="true" />
            API credential
          </CardTitle>
          <CardAction>
            <Button onClick={() => setConfirming(true)} variant="destructive">
              <RotateCredentialIcon
                aria-hidden="true"
                data-icon="inline-start"
              />
              Rotate key
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {status ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-label text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge variant={status.valid ? "secondary" : "destructive"}>
                    {status.valid ? "Valid" : "Invalid"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">Created</dt>
                <dd className="mt-1 text-body">
                  {formatDate(status.created_at)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-label text-muted-foreground">Expires</dt>
                <dd className="mt-1 text-body">
                  {formatDate(status.expires_at)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-body text-muted-foreground">
              No API key status is available.
            </p>
          )}
        </CardContent>
      </Card>
      <ConfirmationAlertDialog
        confirmLabel="Rotate key"
        description="The current key will stop working immediately. Existing integrations must be updated with the replacement key."
        error={error}
        onConfirm={() => void rotateKey()}
        onOpenChange={setConfirming}
        open={confirming}
        pending={mutation.isPending}
        pendingLabel="Rotating key"
        title="Rotate API key?"
        variant="destructive"
      />
      <OneTimeCredentialDialog
        credential={credential}
        onClose={() => setCredential(undefined)}
        title="API key rotated"
      />
    </>
  )
}

function profileFieldLabel(field: keyof ProfileValues) {
  if (field === "first_name") return "First name"
  if (field === "last_name") return "Last name"
  return field === "email" ? "Email" : "Username"
}
