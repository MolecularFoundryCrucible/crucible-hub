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
import { createWorkspaceAccessGroupFn } from "@/data/crucible/access-groups.functions"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceAccessGroup } from "@/data/crucible/workspace-source"

const createGroupSchema = z.object({
  group_name: z
    .string()
    .trim()
    .min(2, "Group name must be at least 2 characters.")
    .max(255)
    .regex(/^[a-z0-9-_]+$/i, "Use letters, numbers, hyphens, or underscores."),
})

export function AccessGroupCreateDialog({
  onCreated,
  onOpenChange,
  open,
  scope,
}: {
  onCreated: (group: WorkspaceAccessGroup) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  scope: IdentityScope
}) {
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof createGroupSchema>) =>
      unwrapHubResult(
        await createWorkspaceAccessGroupFn({
          data: {
            group_name: values.group_name,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })

  const form = useForm({
    defaultValues: { group_name: "" },
    validators: { onChange: createGroupSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const group = await mutation.mutateAsync(value)
        form.reset()
        onOpenChange(false)
        onCreated(group)
      } catch (cause) {
        setError(
          hubErrorMessage(cause, "The access group could not be created.")
        )
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
          <DialogTitle>Create access group</DialogTitle>
        </DialogHeader>
        <form
          id="access-group-create"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <fieldset disabled={pending}>
            <FieldGroup>
              <form.Field name="group_name">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name}>Group name</FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      autoFocus
                      id={field.name}
                      maxLength={255}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="e.g. surface-science"
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
          <Button disabled={pending} form="access-group-create" type="submit">
            {pending ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <CreateResourceIcon data-icon="inline-start" />
            )}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
