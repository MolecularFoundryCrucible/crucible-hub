import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import { EditResourceIcon } from "@/components/crucible/icons"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { updateWorkspaceAccount } from "@/data/crucible/account.functions"
import { applyAccountProfileUpdate } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceAccount,
  WorkspaceAccountProfileUpdate,
} from "@/data/crucible/workspace-source"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"

const accountProfileSchema = z.object({
  email: z
    .string()
    .trim()
    .max(320, "Use 320 characters or fewer for email.")
    .refine(
      (value) =>
        value.length === 0 || z.string().email().safeParse(value).success,
      "Enter a valid email address."
    ),
  first_name: z
    .string()
    .trim()
    .min(1, "Enter a first name.")
    .max(255, "Use 255 characters or fewer for first name."),
  last_name: z
    .string()
    .trim()
    .min(1, "Enter a last name.")
    .max(255, "Use 255 characters or fewer for last name."),
  username: z
    .string()
    .trim()
    .max(24, "Use 24 characters or fewer for username.")
    .refine(
      (value) =>
        value.length === 0 || /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value),
      "Start with a lowercase letter and use lowercase letters, numbers, dots, hyphens, or underscores."
    )
    .refine(
      (value) => value.length === 0 || value.length >= 3,
      "Use at least 3 characters for username."
    ),
})

type AccountProfileValues = z.infer<typeof accountProfileSchema>

function profileValues(account: WorkspaceAccount): AccountProfileValues {
  return {
    email: account.email ?? "",
    first_name: account.first_name,
    last_name: account.last_name,
    username: account.username ?? "",
  }
}

export function accountProfileChanges(
  account: WorkspaceAccount,
  values: AccountProfileValues
): WorkspaceAccountProfileUpdate {
  const normalized = accountProfileSchema.parse(values)
  const initial = profileValues(account)
  const changes: WorkspaceAccountProfileUpdate = {}

  for (const field of ["first_name", "last_name"] as const) {
    if (normalized[field] !== initial[field]) changes[field] = normalized[field]
  }
  for (const field of ["email", "username"] as const) {
    if (normalized[field] !== initial[field]) {
      changes[field] = normalized[field] || null
    }
  }
  return changes
}

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
  const [saved, setSaved] = useState(false)
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
    defaultValues: profileValues(account),
    validators: { onChange: accountProfileSchema },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      setSaved(false)
      const changes = accountProfileChanges(account, value)
      if (Object.keys(changes).length === 0) return
      try {
        const update = await mutation.mutateAsync(changes)
        void applyAccountProfileUpdate(queryClient, scope, update)
        form.reset(profileValues(update))
        setSaved(true)
        setEditing(false)
      } catch (error) {
        setSaveError(
          hubErrorMessage(
            error,
            "Your profile could not be saved. Your changes are still here."
          )
        )
      }
    },
  })
  const isDirty = useStore(form.store, (state) => state.isDirty)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(isDirty, () => {
    form.reset()
    setSaveError(undefined)
    setEditing(false)
  })
  const formId = `account-profile-${account.unique_id}`

  if (!editing) {
    return (
      <Card>
        <CardHeader>
          <PersonIdentity person={account} presentation="avatar" size="lg" />
          <CardAction>
            <Button
              onClick={() => {
                setSaved(false)
                setEditing(true)
              }}
              variant="outline"
            >
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
          <p aria-live="polite" className="mt-4 text-body text-success">
            {saved ? "Profile saved." : null}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card aria-busy={isSubmitting}>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
          <CardDescription>
            Manage the name and contact details associated with your Crucible
            account.
          </CardDescription>
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
                  {(field) => (
                    <ProfileField field={field} label="First name" required />
                  )}
                </form.Field>
                <form.Field name="last_name">
                  {(field) => (
                    <ProfileField field={field} label="Last name" required />
                  )}
                </form.Field>
                <form.Field name="email">
                  {(field) => (
                    <ProfileField field={field} label="Email" type="email" />
                  )}
                </form.Field>
                <form.Field name="username">
                  {(field) => (
                    <ProfileField
                      description="3 to 24 lowercase characters. Dots, hyphens, and underscores may separate letters or numbers."
                      field={field}
                      label="Username"
                      maxLength={24}
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
            <p aria-live="polite" className="mt-4 text-body text-success">
              {saved ? "Profile saved." : null}
            </p>
          </form>
        </CardContent>
        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isDirty,
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

function ProfileField({
  description,
  field,
  label,
  maxLength = 255,
  required = false,
  type = "text",
}: {
  description?: string
  field: {
    handleBlur: () => void
    handleChange: (value: string) => void
    name: string
    state: {
      meta: {
        errors: Array<{ message?: string } | undefined>
        isValid: boolean
      }
      value: string
    }
  }
  label: string
  maxLength?: number
  required?: boolean
  type?: "email" | "text"
}) {
  return (
    <Field data-invalid={!field.state.meta.isValid}>
      <FieldLabel htmlFor={field.name} optional={!required}>
        {label}
      </FieldLabel>
      <Input
        aria-invalid={!field.state.meta.isValid || undefined}
        id={field.name}
        maxLength={maxLength}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        required={required}
        type={type}
        value={field.state.value}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={field.state.meta.errors} />
    </Field>
  )
}
