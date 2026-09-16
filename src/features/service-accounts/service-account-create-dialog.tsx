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
import {
  createWorkspaceServiceAccount,
  serviceAccountUsernameSchema,
} from "@/data/crucible/service-accounts.functions"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceServiceAccountCredential } from "@/data/crucible/workspace-source"

const createServiceAccountSchema = z.object({
  unique_id: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(value),
      "Enter a 26-character MFID or leave this field empty."
    ),
  username: serviceAccountUsernameSchema,
})

export function ServiceAccountCreateDialog({
  onCreated,
  onOpenChange,
  open,
  scope,
}: {
  onCreated: (credential: WorkspaceServiceAccountCredential) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  scope: IdentityScope
}) {
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof createServiceAccountSchema>) =>
      unwrapHubResult(
        await createWorkspaceServiceAccount({
          data: {
            scenario: fixtureScenarioFromScope(scope),
            unique_id: values.unique_id || undefined,
            username: values.username,
          },
        })
      ),
  })
  const form = useForm({
    defaultValues: { unique_id: "", username: "" },
    validators: { onChange: createServiceAccountSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const credential = await mutation.mutateAsync(value)
        form.reset()
        onOpenChange(false)
        onCreated(credential)
      } catch (cause) {
        setError(
          cause instanceof HubApiClientError
            ? cause.message
            : "The service account could not be created."
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
          <DialogTitle>Create service account</DialogTitle>
        </DialogHeader>
        <form
          id="service-account-create"
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
              <form.Field name="unique_id">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name} optional>
                      MFID
                    </FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      className="font-mono text-body"
                      id={field.name}
                      maxLength={26}
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
          <Button
            disabled={pending}
            form="service-account-create"
            type="submit"
          >
            {pending ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <CreateResourceIcon data-icon="inline-start" />
            )}
            Create service account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
