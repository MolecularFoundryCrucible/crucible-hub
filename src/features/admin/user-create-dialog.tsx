import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { z } from "zod"

import {
  CreateResourceIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
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
import { Input } from "@/components/ui/input"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import { usernameSchema } from "@/data/crucible/slugs"
import { createWorkspaceUserFn } from "@/data/crucible/users.functions"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .or(z.literal("")),
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
  const [error, setError] = useState<string>()
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
    validators: { onChange: createUserSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const user = await mutation.mutateAsync(value)
        form.reset()
        onOpenChange(false)
        onCreated(user)
      } catch (cause) {
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
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      autoFocus
                      id={field.name}
                      maxLength={24}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="e.g. jdoe"
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <div className="grid grid-cols-2 gap-4">
                <form.Field name="first_name">
                  {(field) => (
                    <Field data-invalid={!field.state.meta.isValid}>
                      <FieldLabel htmlFor={field.name}>First name</FieldLabel>
                      <Input
                        aria-invalid={!field.state.meta.isValid || undefined}
                        id={field.name}
                        maxLength={255}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="e.g. Jane"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="last_name">
                  {(field) => (
                    <Field data-invalid={!field.state.meta.isValid}>
                      <FieldLabel htmlFor={field.name}>Last name</FieldLabel>
                      <Input
                        aria-invalid={!field.state.meta.isValid || undefined}
                        id={field.name}
                        maxLength={255}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="e.g. Doe"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              </div>
              <form.Field name="email">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name} optional>
                      Email address
                    </FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      id={field.name}
                      maxLength={320}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="e.g. jdoe@lbl.gov"
                      type="email"
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="unique_id">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name} optional>
                      Crucible ID or ORCID
                    </FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
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
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
          </fieldset>
          {error ? (
            <p className="mt-4 text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={pending} form="user-create" type="submit">
            {pending ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <CreateResourceIcon data-icon="inline-start" />
            )}
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
