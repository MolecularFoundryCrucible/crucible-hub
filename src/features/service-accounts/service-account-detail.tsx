import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { ApiCredentialCard } from "@/components/crucible/api-credential-card"
import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import {
  EditResourceIcon,
  RotateCredentialIcon,
} from "@/components/crucible/icons"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import { PlatformRoleDialog } from "@/components/crucible/platform-role-dialog"
import type { PlatformRole } from "@/components/crucible/platform-role-dialog"
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
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import {
  rotateWorkspaceServiceAccountKey,
  updateWorkspaceServiceAccount,
  updateWorkspaceServiceAccountPlatformRole,
} from "@/data/crucible/service-accounts.functions"
import type {
  WorkspaceMode,
  WorkspaceServiceAccountCredential,
  WorkspaceServiceAccountDetail,
  WorkspaceServiceAccountPlatformRole,
  WorkspaceServiceAccountProfileUpdate,
} from "@/data/crucible/workspace-source"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import { fieldErrors, shouldShowFieldError } from "@/features/forms/field-state"
import { formatUsername } from "@/lib/username"
import { USERNAME_MAX_LENGTH, usernameSchema } from "@/data/crucible/slugs"
import { OneTimeCredentialDialog } from "./one-time-credential-dialog"
import { hubActionError } from "@/components/crucible/reauthentication"

const serviceAccountProfileSchema = z.object({
  first_name: z.string().trim().max(255),
  last_name: z.string().trim().max(255),
  username: usernameSchema,
})

type ProfileValues = z.infer<typeof serviceAccountProfileSchema>

const platformRoleDescriptions = {
  admin: "Full platform administration.",
  contributor: "Platform-wide read and create access.",
  none: "No platform-wide role. Resource-specific access and the API key remain unchanged.",
} satisfies Record<WorkspaceServiceAccountPlatformRole, string>

function profileValues(account: WorkspaceServiceAccountDetail): ProfileValues {
  return {
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
  if (normalized.username !== initial.username) {
    changes.username = normalized.username
  }
  return changes
}

export function ServiceAccountDetail({
  account,
  canChangePlatformRole,
  mode,
  scope,
}: {
  account: WorkspaceServiceAccountDetail
  canChangePlatformRole: boolean
  mode: WorkspaceMode
  scope: IdentityScope
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <ServiceAccountIdentityCard
        account={account}
        canChangePlatformRole={canChangePlatformRole}
        mode={mode}
        scope={scope}
      />
      <ServiceAccountCredentialCard account={account} scope={scope} />
    </div>
  )
}

function ServiceAccountIdentityCard({
  account,
  canChangePlatformRole,
  mode,
  scope,
}: {
  account: WorkspaceServiceAccountDetail
  canChangePlatformRole: boolean
  mode: WorkspaceMode
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string>()
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleUpdated, setRoleUpdated] = useState(false)
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
          first_name: updated.first_name,
          last_name: updated.last_name,
          username: updated.username,
        })
        setEditing(false)
      } catch (cause) {
        setError(
          hubErrorMessage(
            cause,
            "The service-account profile could not be saved."
          )
        )
      }
    },
  })
  const roleMutation = useMutation({
    mutationFn: async (platformRole: WorkspaceServiceAccountPlatformRole) =>
      unwrapHubResult(
        await updateWorkspaceServiceAccountPlatformRole({
          data: {
            platformRole,
            scenario: fixtureScenarioFromScope(scope),
            serviceAccountMfid: account.unique_id,
          },
        })
      ),
  })
  const dirty = useStore(form.store, (state) => state.isDirty)
  const submitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(dirty, () => {
    form.reset()
    setError(undefined)
    setEditing(false)
  })
  const formId = `service-account-profile-${account.unique_id}`

  function openRoleDialog() {
    setRoleUpdated(false)
    setRoleDialogOpen(true)
  }

  async function changePlatformRole(role: PlatformRole) {
    const updated = await roleMutation.mutateAsync(role)
    queryClient.setQueryData(
      crucibleKeys.serviceAccountAdmin(scope, account.unique_id),
      updated
    )
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.serviceAccountLists(scope),
      refetchType: mode === "api" ? "active" : "none",
    })
  }

  if (!editing) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardAction>
              <div className="flex flex-wrap justify-end gap-2">
                {canChangePlatformRole ? (
                  <Button onClick={openRoleDialog} variant="outline">
                    Change role
                  </Button>
                ) : null}
                <Button onClick={() => setEditing(true)} variant="outline">
                  <EditResourceIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  Edit profile
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {roleUpdated ? (
              <p aria-live="polite" className="text-body text-success">
                Platform role updated. Access changes may take about a minute to
                propagate.
              </p>
            ) : null}
            <PersonIdentity person={account} presentation="avatar" size="lg" />
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-label text-muted-foreground">Username</dt>
                <dd className="mt-1 text-body break-words">
                  {formatUsername(account.username, "raw")}
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">
                  Platform role
                </dt>
                <dd className="mt-1">
                  <PlatformRoleBadge role={account.platform_role} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-label text-muted-foreground">
                  Crucible ID
                </dt>
                <dd className="mt-1">
                  <MfidValue value={account.unique_id} />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <PlatformRoleDialog
          currentRole={account.platform_role}
          id="service-account-platform-role"
          onChanged={() => setRoleUpdated(true)}
          onChange={changePlatformRole}
          onOpenChange={setRoleDialogOpen}
          open={roleDialogOpen}
          roleDescriptions={platformRoleDescriptions}
        />
      </>
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
                {(["first_name", "last_name", "username"] as const).map(
                  (name) => (
                    <form.Field key={name} name={name}>
                      {(field) => {
                        const invalid = shouldShowFieldError(field)
                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel
                              htmlFor={field.name}
                              optional={name !== "username"}
                              required={name === "username"}
                            >
                              {profileFieldLabel(name)}
                            </FieldLabel>
                            <Input
                              aria-invalid={invalid || undefined}
                              id={field.name}
                              maxLength={
                                name === "username" ? USERNAME_MAX_LENGTH : 255
                              }
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              value={field.state.value}
                            />
                            <FieldError
                              errors={fieldErrors(field, { invalid })}
                            />
                          </Field>
                        )
                      }}
                    </form.Field>
                  )
                )}
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
  const [error, setError] = useState<React.ReactNode>()
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
      setError(hubActionError(cause, "The API key could not be rotated."))
    }
  }

  return (
    <>
      <ApiCredentialCard
        action={
          <Button onClick={() => setConfirming(true)} variant="destructive">
            <RotateCredentialIcon aria-hidden="true" data-icon="inline-start" />
            Rotate key
          </Button>
        }
        status={status}
      />
      <ConfirmationDialog
        kind="alert"
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
  return "Username"
}
