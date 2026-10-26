import { useMemo, useState } from "react"
import { useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  EditableCardActions,
  EditableCardTrigger,
} from "@/components/crucible/editable-card-actions"
import { MfidValue } from "@/components/crucible/mfid-value"
import { notifySuccess } from "@/components/crucible/notifications"
import { PersonIdentity } from "@/components/crucible/person-identity"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { updateWorkspaceAccount } from "@/data/crucible/account.functions"
import { applyAccountProfileUpdate } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  hubConflictFields,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type {
  WorkspaceAccount,
  WorkspaceAccountProfileUpdate,
} from "@/data/crucible/workspace-source"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import {
  ProfileField,
  accountProfileChanges,
  accountProfileHasChanges,
  accountProfileFormSchema,
  accountProfileValues,
  matchesRejectedValue,
  profileNameMissing,
  ProfileNameHint,
} from "./account-profile-fields"
import { UsernameField } from "@/features/forms/identifier-fields"
import { useSlugConflict } from "@/features/forms/slug-availability"
import { formatUsername } from "@/lib/username"
import { useAppForm } from "@/features/forms/app-form"

export function AccountProfileForm({
  account,
  scope,
}: {
  account: WorkspaceAccount
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const usernameConflict = useSlugConflict()
  const [rejectedEmail, setRejectedEmail] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (changes: WorkspaceAccountProfileUpdate) =>
      unwrapHubResult(
        await updateWorkspaceAccount({
          data: {
            changes,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const profileSchema = useMemo(
    () => accountProfileFormSchema(account),
    [account]
  )
  const form = useAppForm({
    defaultValues: accountProfileValues(account),
    validators: {
      onChange: profileSchema,
      onSubmit: profileSchema,
    },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const changes = accountProfileChanges(account, value)
      if (Object.keys(changes).length === 0) {
        setEditing(false)
        return
      }
      try {
        const update = await mutation.mutateAsync(changes)
        void applyAccountProfileUpdate(queryClient, scope, update)
        form.reset(accountProfileValues(update))
        notifySuccess("Profile saved")
        setEditing(false)
      } catch (error) {
        const conflicts = hubConflictFields(
          error,
          changes.username ? ["username"] : []
        )
        if (conflicts.length) {
          if (conflicts.includes("username")) {
            usernameConflict.reject(changes.username)
          }
          if (conflicts.includes("email") && changes.email) {
            setRejectedEmail(changes.email)
          }
        } else {
          setSaveError(
            hubErrorMessage(
              error,
              "Your profile could not be saved. Your changes are still here."
            )
          )
        }
      }
    },
  })
  const hasChanges = useStore(form.store, (state) =>
    accountProfileHasChanges(account, state.values)
  )
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(hasChanges, () => {
    form.reset()
    setSaveError(undefined)
    usernameConflict.reset()
    setEditing(false)
  })
  const formId = `account-profile-${account.unique_id}`

  if (!editing) {
    return (
      <Card>
        <CardHeader>
          <PersonIdentity person={account} presentation="avatar" size="lg" />
          <CardAction>
            <EditableCardTrigger
              label="Edit profile"
              onClick={() => setEditing(true)}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div className="col-span-2 min-w-0 @fields:col-span-1">
              <dt className="text-label text-muted-foreground">Email</dt>
              <dd className="mt-1 text-body break-words">
                {account.email ?? "Not provided"}
              </dd>
            </div>
            <div className="col-span-2 min-w-0 @fields:col-span-1">
              <dt className="text-label text-muted-foreground">Username</dt>
              <dd className="mt-1 text-body break-words">
                {account.username ? (
                  <span className="font-mono">
                    {formatUsername(account.username, "raw")}
                  </span>
                ) : (
                  "Not provided"
                )}
              </dd>
            </div>
            <div className="col-span-2 min-w-0">
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
      <Card aria-busy={isSubmitting}>
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
            <fieldset disabled={isSubmitting}>
              <FieldGroup>
                <div className="grid gap-4 @fields:grid-cols-2">
                  <form.Field name="first_name">
                    {(field) => (
                      <ProfileField field={field} label="First name" />
                    )}
                  </form.Field>
                  <form.Field name="last_name">
                    {(field) => (
                      <ProfileField field={field} label="Last name" />
                    )}
                  </form.Field>
                </div>
                <form.Subscribe selector={profileNameMissing}>
                  {(missing) => (missing ? <ProfileNameHint /> : null)}
                </form.Subscribe>
                <form.Field name="email">
                  {(field) => (
                    <ProfileField
                      field={field}
                      label="Email"
                      rejectedMessage="This email is already used by another account."
                      rejectedValue={rejectedEmail}
                      required
                      type="email"
                    />
                  )}
                </form.Field>
                <form.Field name="username">
                  {(field) => (
                    <UsernameField
                      {...usernameConflict.fieldProps}
                      currentValue={account.username}
                      field={field}
                      required
                      scenario={fixtureScenarioFromScope(scope)}
                    />
                  )}
                </form.Field>
              </FieldGroup>
            </fieldset>
            {saveError ? (
              <p className="mt-4 text-body text-destructive" role="alert">
                {saveError}
              </p>
            ) : null}
          </form>
        </CardContent>
        <form.Subscribe
          selector={(state) => [
            state.canSubmit &&
              !matchesRejectedValue(state.values.email, rejectedEmail) &&
              !usernameConflict.isTaken(state.values.username),
            accountProfileHasChanges(account, state.values),
            state.isSubmitting,
          ]}
        >
          {([canSubmit, dirty, submitting]) => (
            <EditableCardActions
              canSubmit={canSubmit}
              dirty={dirty}
              formId={formId}
              onCancel={discard.requestCancel}
              pending={submitting}
            />
          )}
        </form.Subscribe>
      </Card>
      <DiscardChangesDialog {...discard.dialog} />
    </>
  )
}
