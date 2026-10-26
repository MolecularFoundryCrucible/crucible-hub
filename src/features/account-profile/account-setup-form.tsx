import { useMemo, useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"

import { PendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { updateWorkspaceAccount } from "@/data/crucible/account.functions"
import {
  accountNeedsSetup,
  accountSetupDestination,
} from "@/data/crucible/account-setup"
import {
  hubConflictFields,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import {
  ProfileField,
  accountProfileChanges,
  accountProfileFormSchema,
  accountProfileValues,
  matchesRejectedValue,
  profileNameMissing,
  ProfileNameHint,
} from "./account-profile-fields"
import { UsernameField } from "@/features/forms/identifier-fields"
import { useSlugConflict } from "@/features/forms/slug-availability"

export function AccountSetupForm({
  account,
  returnTo,
}: {
  account: WorkspaceAccount
  returnTo?: string
}) {
  const [saveError, setSaveError] = useState<string>()
  const usernameConflict = useSlugConflict()
  const [rejectedEmail, setRejectedEmail] = useState<string>()
  const profileSchema = useMemo(
    () => accountProfileFormSchema(account),
    [account]
  )
  const form = useForm({
    defaultValues: accountProfileValues(account),
    validators: {
      onChange: profileSchema,
      onSubmit: profileSchema,
    },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      try {
        const changes = accountProfileChanges(account, value)
        const updated =
          Object.keys(changes).length > 0
            ? unwrapHubResult(
                await updateWorkspaceAccount({ data: { changes } })
              )
            : account
        if (accountNeedsSetup(updated)) {
          setSaveError("A username is required to continue.")
          return
        }
        window.location.replace(accountSetupDestination(returnTo))
      } catch (error) {
        const conflicts = hubConflictFields(error, ["username"])
        if (conflicts.length) {
          if (conflicts.includes("username")) {
            usernameConflict.reject(value.username.trim())
          }
          if (conflicts.includes("email")) setRejectedEmail(value.email.trim())
        } else {
          setSaveError(
            hubErrorMessage(
              error,
              "Your account could not be updated. Try again."
            )
          )
        }
      }
    },
  })
  const submitting = useStore(form.store, (state) => state.isSubmitting)

  return (
    <form
      aria-busy={submitting}
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <fieldset disabled={submitting}>
        <FieldGroup>
          <form.Field name="username">
            {(field) => (
              <UsernameField
                {...usernameConflict.fieldProps}
                currentValue={account.username}
                field={field}
                required
              />
            )}
          </form.Field>
          <form.Field name="email">
            {(field) => (
              <ProfileField
                field={field}
                label="Email"
                rejectedMessage={
                  "This email is already used by another account."
                }
                rejectedValue={rejectedEmail}
                required
                type="email"
              />
            )}
          </form.Field>
          <div className="grid gap-4 @fields:grid-cols-2">
            <form.Field name="first_name">
              {(field) => <ProfileField field={field} label="First name" />}
            </form.Field>
            <form.Field name="last_name">
              {(field) => <ProfileField field={field} label="Last name" />}
            </form.Field>
          </div>
          <form.Subscribe selector={profileNameMissing}>
            {(missing) => (missing ? <ProfileNameHint /> : null)}
          </form.Subscribe>
        </FieldGroup>
      </fieldset>
      {saveError ? (
        <p className="text-body text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}
      <form.Subscribe
        selector={(state) =>
          state.canSubmit &&
          !matchesRejectedValue(state.values.email, rejectedEmail) &&
          !usernameConflict.isTaken(state.values.username)
        }
      >
        {(canSubmit) => (
          <Button disabled={!canSubmit || submitting} size="lg" type="submit">
            {submitting ? (
              <>
                <PendingIcon data-icon="inline-start" />
                Saving
              </>
            ) : (
              "Continue"
            )}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
