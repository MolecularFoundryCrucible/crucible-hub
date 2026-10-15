import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { z } from "zod"

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
import { UsernameField } from "@/features/forms/identifier-fields"
import { useSlugConflict } from "@/features/forms/slug-availability"
import { fieldErrors, shouldShowFieldError } from "@/features/forms/field-state"
import { Input } from "@/components/ui/input"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { createWorkspaceServiceAccount } from "@/data/crucible/service-accounts.functions"
import { usernameSchema } from "@/data/crucible/slugs"
import { hubConflictFields, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceServiceAccountCredential } from "@/data/crucible/workspace-source"
import { hubActionError } from "@/components/crucible/reauthentication"

const createServiceAccountSchema = z.object({
  unique_id: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(value),
      "Enter a 26-character MFID or leave this field empty."
    ),
  username: usernameSchema,
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
  const [error, setError] = useState<React.ReactNode>()
  const usernameConflict = useSlugConflict()
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
    validators: {
      onChange: createServiceAccountSchema,
      onSubmit: createServiceAccountSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const credential = await mutation.mutateAsync(value)
        form.reset()
        onOpenChange(false)
        onCreated(credential)
      } catch (cause) {
        if (hubConflictFields(cause, ["username"]).includes("username")) {
          usernameConflict.reject(value.username)
        }
        setError(
          hubActionError(cause, "The service account could not be created.")
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
      usernameConflict.reset()
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
                  <UsernameField
                    {...usernameConflict.fieldProps}
                    autoComplete="off"
                    autoFocus
                    field={field}
                    placeholder="e.g. beamline-7-uploader"
                    required
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
                        MFID
                      </FieldLabel>
                      <Input
                        aria-invalid={invalid || undefined}
                        className="font-mono text-body"
                        id={field.name}
                        maxLength={26}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
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
          selector={(state) => usernameConflict.isTaken(state.values.username)}
        >
          {(usernameTaken) => (
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
                disabled={pending || usernameTaken}
                form="service-account-create"
                type="submit"
              >
                {pending ? (
                  <>
                    <PendingIcon data-icon="inline-start" />
                    Creating
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          )}
        </form.Subscribe>
      </DialogContent>
    </Dialog>
  )
}
