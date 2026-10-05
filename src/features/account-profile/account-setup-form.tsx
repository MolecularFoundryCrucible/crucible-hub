import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"

import { Button } from "@/components/ui/button"
import { notifyError } from "@/components/crucible/notifications"
import { FieldGroup } from "@/components/ui/field"
import { updateWorkspaceAccount } from "@/data/crucible/account.functions"
import {
  accountNeedsSetup,
  accountSetupDestination,
} from "@/data/crucible/account-setup"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import {
  ProfileField,
  accountProfileChanges,
  accountProfileSchema,
  accountProfileValues,
} from "./account-profile-fields"
import { isSlugTakenOrRejected } from "@/features/forms/slug-availability"
import { UsernameAvailability } from "./username-availability"

export function AccountSetupForm({
  account,
  returnTo,
}: {
  account: WorkspaceAccount
  returnTo?: string
}) {
  const [saveError, setSaveError] = useState<string>()
  const [liveTakenUsername, setLiveTakenUsername] = useState<string>()
  const [rejectedUsername, setRejectedUsername] = useState<string>()
  const form = useForm({
    defaultValues: accountProfileValues(account),
    validators: {
      onChange: accountProfileSchema,
      onSubmit: accountProfileSchema,
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
          setSaveError("Email and username are required to continue.")
          return
        }
        window.location.replace(accountSetupDestination(returnTo))
      } catch (error) {
        if (
          error instanceof HubApiClientError &&
          error.details.kind === "conflict"
        ) {
          setRejectedUsername(value.username.trim())
          notifyError("Username already taken")
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
              <UsernameAvailability
                currentUsername={account.username}
                field={field}
                onLiveTakenChange={setLiveTakenUsername}
                rejectedUsername={rejectedUsername}
              />
            )}
          </form.Field>
          <form.Field name="email">
            {(field) => (
              <ProfileField field={field} label="Email" required type="email" />
            )}
          </form.Field>
          <form.Field name="first_name">
            {(field) => <ProfileField field={field} label="First name" />}
          </form.Field>
          <form.Field name="last_name">
            {(field) => <ProfileField field={field} label="Last name" />}
          </form.Field>
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
          !isSlugTakenOrRejected(
            state.values.username,
            liveTakenUsername,
            rejectedUsername
          )
        }
      >
        {(canSubmit) => (
          <Button disabled={!canSubmit || submitting} size="lg" type="submit">
            {submitting ? "Saving..." : "Continue"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
