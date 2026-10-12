import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { CreateResourceIcon } from "@/components/crucible/icons"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { fieldErrors, shouldShowFieldError } from "@/features/forms/field-state"
import { Input } from "@/components/ui/input"
import { checkWorkspaceUsername } from "@/data/crucible/account.functions"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  hubConflictFields,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import { USERNAME_MAX_LENGTH, usernameSchema } from "@/data/crucible/slugs"
import {
  checkWorkspaceEmail,
  createWorkspaceUserFn,
} from "@/data/crucible/users.functions"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"
import {
  isSlugTakenOrRejected,
  SlugAvailabilityField,
} from "@/features/forms/slug-availability"

const userEmailSchema = z
  .string()
  .trim()
  .max(320, "Use 320 characters or fewer for email.")
  .email("Enter a valid email address.")

const createUserSchema = z.object({
  email: userEmailSchema.or(z.literal("")),
  first_name: z.string().trim().min(1, "Enter a first name.").max(255),
  last_name: z.string().trim().min(1, "Enter a last name.").max(255),
  unique_id: z.string().trim().max(255),
  username: usernameSchema,
})

export function UserCreateDialog({
  onCreated,
  onOpenChange,
  open,
  scope,
}: {
  onCreated: (user: WorkspaceAdminUser) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string>()
  const [liveTakenUsername, setLiveTakenUsername] = useState<string>()
  const [rejectedUsername, setRejectedUsername] = useState<string>()
  const [liveTakenEmail, setLiveTakenEmail] = useState<string>()
  const [rejectedEmail, setRejectedEmail] = useState<string>()

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof createUserSchema>) =>
      unwrapHubResult(
        await createWorkspaceUserFn({
          data: {
            email: values.email ? values.email : undefined,
            first_name: values.first_name,
            last_name: values.last_name,
            scenario: fixtureScenarioFromScope(scope),
            unique_id: values.unique_id || undefined,
            username: values.username,
          },
        })
      ),
  })

  const form = useForm({
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      unique_id: "",
      username: "",
    },
    validators: {
      onChange: createUserSchema,
      onSubmit: createUserSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const user = await mutation.mutateAsync(value)
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.userAdminLists(scope),
        })
        form.reset()
        onOpenChange(false)
        onCreated(user)
      } catch (cause) {
        const conflicts = hubConflictFields(cause, ["username", "email"])
        if (conflicts.includes("username") && value.username) {
          setRejectedUsername(value.username)
        }
        if (conflicts.includes("email") && value.email) {
          setRejectedEmail(value.email)
        }
        setError(hubErrorMessage(cause, "The user could not be created."))
      }
    },
  })
  const pending = useStore(form.store, (state) => state.isSubmitting)

  function setOpen(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
    if (!nextOpen) {
      form.reset()
      setError(undefined)
      setLiveTakenUsername(undefined)
      setRejectedUsername(undefined)
      setLiveTakenEmail(undefined)
      setRejectedEmail(undefined)
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <form
          id="user-create"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <fieldset disabled={pending}>
            <FieldGroup>
              <form.Field name="username">
                {(field) => (
                  <SlugAvailabilityField
                    autoComplete="nickname"
                    autoFocus
                    checkAvailability={async (candidate, signal) => {
                      const result = await checkWorkspaceUsername({
                        data: {
                          scenario: fixtureScenarioFromScope(scope),
                          username: candidate,
                        },
                        signal,
                      })
                      return unwrapHubResult(result)
                    }}
                    entityLabel="Username"
                    field={field}
                    label="Username"
                    maxLength={USERNAME_MAX_LENGTH}
                    onLiveTakenChange={setLiveTakenUsername}
                    placeholder="e.g. jdoe"
                    rejectedValue={rejectedUsername}
                    required
                    schema={usernameSchema}
                  />
                )}
              </form.Field>
              <div className="grid grid-cols-2 gap-4">
                <form.Field name="first_name">
                  {(field) => {
                    const invalid = shouldShowFieldError(field)
                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel htmlFor={field.name} required>
                          First name
                        </FieldLabel>
                        <Input
                          aria-invalid={invalid || undefined}
                          id={field.name}
                          maxLength={255}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="e.g. Jane"
                          value={field.state.value}
                        />
                        <FieldError errors={fieldErrors(field)} />
                      </Field>
                    )
                  }}
                </form.Field>
                <form.Field name="last_name">
                  {(field) => {
                    const invalid = shouldShowFieldError(field)
                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel htmlFor={field.name} required>
                          Last name
                        </FieldLabel>
                        <Input
                          aria-invalid={invalid || undefined}
                          id={field.name}
                          maxLength={255}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="e.g. Doe"
                          value={field.state.value}
                        />
                        <FieldError errors={fieldErrors(field)} />
                      </Field>
                    )
                  }}
                </form.Field>
              </div>
              <form.Field name="email">
                {(field) => (
                  <SlugAvailabilityField
                    autoComplete="email"
                    checkAvailability={async (candidate, signal) => {
                      const result = await checkWorkspaceEmail({
                        data: {
                          email: candidate,
                          scenario: fixtureScenarioFromScope(scope),
                        },
                        signal,
                      })
                      return unwrapHubResult(result)
                    }}
                    entityLabel="Email"
                    field={field}
                    label="Email address"
                    maxLength={320}
                    onLiveTakenChange={setLiveTakenEmail}
                    placeholder="e.g. jdoe@lbl.gov"
                    rejectedValue={rejectedEmail}
                    schema={userEmailSchema}
                    type="email"
                  />
                )}
              </form.Field>
              <form.Field name="unique_id">
                {(field) => {
                  const invalid = shouldShowFieldError(field)
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={field.name} optional>
                        Crucible ID or ORCID
                      </FieldLabel>
                      <Input
                        aria-invalid={invalid || undefined}
                        className="font-mono text-body"
                        id={field.name}
                        maxLength={255}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="e.g. 0000-0002-1825-0097"
                        value={field.state.value}
                      />
                      <FieldError errors={fieldErrors(field)} />
                    </Field>
                  )
                }}
              </form.Field>
            </FieldGroup>
          </fieldset>
          {error ? (
            <p className="mt-4 text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        <form.Subscribe
          selector={(state) => [
            isSlugTakenOrRejected(
              state.values.username,
              liveTakenUsername,
              rejectedUsername
            ) ||
              isSlugTakenOrRejected(
                state.values.email,
                liveTakenEmail,
                rejectedEmail
              ),
            state.isSubmitting,
          ]}
        >
          {([isTaken, isSubmitting]) => (
            <DialogFooter>
              <Button
                disabled={isSubmitting}
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={isTaken || isSubmitting}
                form="user-create"
                type="submit"
              >
                {isSubmitting ? (
                  <PendingIcon data-icon="inline-start" />
                ) : (
                  <CreateResourceIcon data-icon="inline-start" />
                )}
                Create user
              </Button>
            </DialogFooter>
          )}
        </form.Subscribe>
      </DialogContent>
    </Dialog>
  )
}
