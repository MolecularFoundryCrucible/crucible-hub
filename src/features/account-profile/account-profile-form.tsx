import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import { EditResourceIcon } from "@/components/crucible/icons"
import { MfidValue } from "@/components/crucible/mfid-value"
import { notifyError, notifySuccess } from "@/components/crucible/notifications"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { Button } from "@/components/ui/button"
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
  HubApiClientError,
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
  accountProfileSchema,
  accountProfileValues,
} from "./account-profile-fields"
import { UsernameAvailability } from "./username-availability"

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
  const [liveTakenUsername, setLiveTakenUsername] = useState<string>()
  const [rejectedUsername, setRejectedUsername] = useState<string>()
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
  const form = useForm({
    defaultValues: accountProfileValues(account),
    validators: {
      onChange: accountProfileSchema,
      onSubmit: accountProfileSchema,
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
        if (
          error instanceof HubApiClientError &&
          error.details.kind === "conflict" &&
          changes.username
        ) {
          setRejectedUsername(changes.username)
          notifyError("Username already taken")
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
    setLiveTakenUsername(undefined)
    setRejectedUsername(undefined)
    setEditing(false)
  })
  const formId = `account-profile-${account.unique_id}`

  if (!editing) {
    return (
      <Card>
        <CardHeader>
          <PersonIdentity person={account} presentation="avatar" size="lg" />
          <CardAction>
            <Button onClick={() => setEditing(true)} variant="outline">
              <EditResourceIcon aria-hidden="true" data-icon="inline-start" />
              Edit profile
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
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
                {account.username ?? "Not provided"}
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
                <form.Field name="first_name">
                  {(field) => <ProfileField field={field} label="First name" />}
                </form.Field>
                <form.Field name="last_name">
                  {(field) => <ProfileField field={field} label="Last name" />}
                </form.Field>
                <form.Field name="email">
                  {(field) => (
                    <ProfileField
                      field={field}
                      label="Email"
                      required
                      type="email"
                    />
                  )}
                </form.Field>
                <form.Field name="username">
                  {(field) => (
                    <UsernameAvailability
                      currentUsername={account.username}
                      field={field}
                      onLiveTakenChange={setLiveTakenUsername}
                      rejectedUsername={rejectedUsername}
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
              state.values.username.trim() !== liveTakenUsername &&
              state.values.username.trim() !== rejectedUsername,
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
