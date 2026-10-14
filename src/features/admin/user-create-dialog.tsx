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
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  hubConflictFields,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import { emailSchema, usernameSchema } from "@/data/crucible/slugs"
import { createWorkspaceUserFn } from "@/data/crucible/users.functions"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"
import { EmailField, UsernameField } from "@/features/forms/identifier-fields"
import { useSlugConflict } from "@/features/forms/slug-availability"

const createUserSchema = z.object({
  email: emailSchema.or(z.literal("")),
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
  const usernameConflict = useSlugConflict()
  const emailConflict = useSlugConflict()

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
        if (conflicts.includes("username"))
          usernameConflict.reject(value.username)
        if (conflicts.includes("email")) emailConflict.reject(value.email)
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
      usernameConflict.reset()
      emailConflict.reset()
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
                  <UsernameField
                    {...usernameConflict.fieldProps}
                    autoFocus
                    field={field}
                    placeholder="e.g. jdoe"
                    required
                    scenario={fixtureScenarioFromScope(scope)}
                  />
                )}
              </form.Field>
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <EmailField
                    {...emailConflict.fieldProps}
                    field={field}
                    placeholder="e.g. jdoe@lbl.gov"
                    scenario={fixtureScenarioFromScope(scope)}
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
            usernameConflict.isTaken(state.values.username) ||
              emailConflict.isTaken(state.values.email),
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
