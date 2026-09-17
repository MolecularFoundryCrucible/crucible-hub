import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { ApiCredentialCard } from "@/components/crucible/api-credential-card"
import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import {
  EditResourceIcon,
  RotateCredentialIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { applyPersonProfileUpdate } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import {
  rotateWorkspaceServiceAccountKey,
  serviceAccountUsernameSchema,
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
import { OneTimeCredentialDialog } from "./one-time-credential-dialog"

const serviceAccountProfileSchema = z.object({
  first_name: z.string().trim().max(255),
  last_name: z.string().trim().max(255),
  username: serviceAccountUsernameSchema,
})

type ProfileValues = z.infer<typeof serviceAccountProfileSchema>

const assignablePlatformRoles = ["none", "contributor", "admin"] as const

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
  const [roleError, setRoleError] = useState<string>()
  const [roleUpdated, setRoleUpdated] = useState(false)
  const [selectedRole, setSelectedRole] =
    useState<WorkspaceServiceAccountPlatformRole>()
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
    setSelectedRole(
      isAssignablePlatformRole(account.platform_role)
        ? account.platform_role
        : undefined
    )
    setRoleError(undefined)
    setRoleUpdated(false)
    setRoleDialogOpen(true)
  }

  function changeRoleDialogOpen(open: boolean) {
    if (!open && roleMutation.isPending) return
    setRoleDialogOpen(open)
    if (!open) {
      setSelectedRole(undefined)
      setRoleError(undefined)
    }
  }

  async function changePlatformRole() {
    if (!selectedRole || selectedRole === account.platform_role) return
    setRoleError(undefined)
    try {
      const updated = await roleMutation.mutateAsync(selectedRole)
      queryClient.setQueryData(
        crucibleKeys.serviceAccountAdmin(scope, account.unique_id),
        updated
      )
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.serviceAccountLists(scope),
        refetchType: mode === "api" ? "active" : "none",
      })
      setRoleDialogOpen(false)
      setSelectedRole(undefined)
      setRoleUpdated(true)
    } catch (cause) {
      setRoleError(
        hubErrorMessage(cause, "The platform role could not be changed.")
      )
    }
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
                  @{account.username}
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
        <Dialog onOpenChange={changeRoleDialogOpen} open={roleDialogOpen}>
          <DialogContent showCloseButton={!roleMutation.isPending}>
            <DialogHeader>
              <DialogTitle>Change platform role</DialogTitle>
              <DialogDescription>
                Access changes may take about a minute to reach every API
                process.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="service-account-platform-role">
                  Platform role
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  disabled={roleMutation.isPending}
                  id="service-account-platform-role"
                  onChange={(event) => {
                    if (isAssignablePlatformRole(event.target.value)) {
                      setSelectedRole(event.target.value)
                    }
                  }}
                  value={selectedRole ?? ""}
                >
                  <NativeSelectOption disabled value="">
                    Select role
                  </NativeSelectOption>
                  {assignablePlatformRoles.map((role) => (
                    <NativeSelectOption key={role} value={role}>
                      {platformRoleLabel(role)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {selectedRole ? (
                <p className="text-body text-muted-foreground">
                  {platformRoleDescriptions[selectedRole]}
                </p>
              ) : null}
            </FieldGroup>
            {roleError ? (
              <p className="text-body text-destructive" role="alert">
                {roleError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={roleMutation.isPending}
                onClick={() => changeRoleDialogOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !selectedRole ||
                  selectedRole === account.platform_role ||
                  roleMutation.isPending
                }
                onClick={() => void changePlatformRole()}
                type="button"
              >
                {roleMutation.isPending ? (
                  <SavingChangesIcon
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                {roleMutation.isPending ? "Changing role" : "Change role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                      {(field) => (
                        <Field data-invalid={!field.state.meta.isValid}>
                          <FieldLabel
                            htmlFor={field.name}
                            optional={name !== "username"}
                          >
                            {profileFieldLabel(name)}
                          </FieldLabel>
                          <Input
                            aria-invalid={
                              !field.state.meta.isValid || undefined
                            }
                            id={field.name}
                            maxLength={255}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            value={field.state.value}
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </Field>
                      )}
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
      setError(hubErrorMessage(cause, "The API key could not be rotated."))
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
  return "Username"
}

function isAssignablePlatformRole(
  role: string
): role is WorkspaceServiceAccountPlatformRole {
  return assignablePlatformRoles.some((candidate) => candidate === role)
}

function platformRoleLabel(role: WorkspaceServiceAccountPlatformRole) {
  if (role === "none") return "No platform role"
  return role === "admin" ? "Admin" : "Contributor"
}
