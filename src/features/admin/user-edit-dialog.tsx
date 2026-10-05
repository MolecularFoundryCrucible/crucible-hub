import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { z } from "zod"

import {
  EditResourceIcon,
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
import { updateWorkspaceUser } from "@/data/crucible/users.functions"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"

const editUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .or(z.literal("")),
  first_name: z.string().trim().min(1, "Enter a first name.").max(255),
  last_name: z.string().trim().min(1, "Enter a last name.").max(255),
  username: usernameSchema,
})

export function UserEditDialog({
  onOpenChange,
  onUpdated,
  open,
  scope,
  user,
}: {
  onOpenChange: (open: boolean) => void
  onUpdated: (user: WorkspaceAdminUser) => void
  open: boolean
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof editUserSchema>) =>
      unwrapHubResult(
        await updateWorkspaceUser({
          data: {
            changes: {
              email: values.email || null,
              first_name: values.first_name,
              last_name: values.last_name,
              username: values.username,
            },
            scenario: fixtureScenarioFromScope(scope),
            userId: user.unique_id,
          },
        })
      ),
  })

  const form = useForm({
    defaultValues: {
      email: user.email ?? "",
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username ?? "",
    },
    validators: { onChange: editUserSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const updated = await mutation.mutateAsync(value)
        onOpenChange(false)
        onUpdated(updated)
      } catch (cause) {
        setError(hubErrorMessage(cause, "User details could not be updated."))
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
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        <form
          id="user-edit"
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
                      type="email"
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
          <Button disabled={pending} form="user-edit" type="submit">
            {pending ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <EditResourceIcon data-icon="inline-start" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
