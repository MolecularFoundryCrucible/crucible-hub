import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  CancelChangesIcon,
  EditScientificMetadataIcon,
  SaveChangesIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import {
  scientificMetadataValidationError,
  updateWorkspaceResourceMetadata,
} from "@/data/crucible/resources.functions"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceMetadataValue,
  WorkspaceResourceDetail,
  WorkspaceScientificMetadata,
  WorkspaceScientificMetadataWrite,
} from "@/data/crucible/workspace-source"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"

type EditableResource = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" | "sample" }
>

export type ScientificMetadataParseResult =
  | { metadata: WorkspaceScientificMetadata; ok: true }
  | { message: string; ok: false }

function isMetadataValue(value: unknown): value is WorkspaceMetadataValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return true
  }
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isMetadataValue)
  if (typeof value !== "object") return false
  return Object.values(value).every(isMetadataValue)
}

function isMetadataObject(
  value: unknown
): value is WorkspaceScientificMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    isMetadataValue(value)
  )
}

function metadataEqual(
  left: WorkspaceMetadataValue,
  right: WorkspaceMetadataValue
): boolean {
  if (left === right) return true
  if (typeof left !== "object" || left === null) return false
  if (typeof right !== "object" || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => metadataEqual(value, right[index]))
    )
  }
  const leftObject = left as Readonly<Record<string, WorkspaceMetadataValue>>
  const rightObject = right as Readonly<Record<string, WorkspaceMetadataValue>>
  const leftEntries = Object.entries(leftObject)
  const rightEntries = Object.entries(rightObject)
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value]) =>
        Object.hasOwn(rightObject, key) &&
        metadataEqual(value, rightObject[key])
    )
  )
}

export function prettyScientificMetadata(
  metadata: WorkspaceScientificMetadata | null
): string {
  return JSON.stringify(metadata ?? {}, null, 2)
}

export function parseScientificMetadata(
  input: string
): ScientificMetadataParseResult {
  let value: unknown
  try {
    value = JSON.parse(input)
  } catch {
    return { message: "Enter valid JSON.", ok: false }
  }
  if (!isMetadataObject(value)) {
    return {
      message:
        "Scientific metadata must be a JSON object with finite JSON values.",
      ok: false,
    }
  }
  const validationError = scientificMetadataValidationError(value)
  if (validationError) return { message: validationError, ok: false }
  return { metadata: value, ok: true }
}

export function scientificMetadataWrite(
  original: WorkspaceScientificMetadata | null,
  edited: WorkspaceScientificMetadata
): WorkspaceScientificMetadataWrite | null {
  const current = original ?? {}
  if (metadataEqual(current, edited)) return null

  if (
    Object.keys(current).some((key) => !Object.hasOwn(edited, key)) ||
    (Object.keys(current).length > 0 && Object.keys(edited).length === 0)
  ) {
    return { kind: "replace", metadata: edited }
  }

  const changed = Object.fromEntries(
    Object.entries(edited).filter(
      ([key, value]) =>
        !Object.hasOwn(current, key) || !metadataEqual(current[key], value)
    )
  ) as WorkspaceScientificMetadata
  return { kind: "merge", metadata: changed }
}

const scientificMetadataFormSchema = z.object({
  metadata: z.string().superRefine((value, context) => {
    const result = parseScientificMetadata(value)
    if (!result.ok) {
      context.addIssue({ code: "custom", message: result.message })
    }
  }),
})

export function mergeScientificMetadataUpdate(
  resource: WorkspaceResourceDetail | null | undefined,
  scientificMetadata: WorkspaceScientificMetadata | null
): WorkspaceResourceDetail | null | undefined {
  if (
    !resource ||
    (resource.kind !== "dataset" && resource.kind !== "sample")
  ) {
    return resource
  }
  return { ...resource, scientific_metadata: scientificMetadata }
}

export function ScientificMetadataEditor({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: EditableResource
  scope: IdentityScope
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <ScientificMetadataForm
        mode={mode}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        resource={resource}
        scope={scope}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scientific metadata</CardTitle>
        {resource.capabilities?.can_edit === true ? (
          <CardAction>
            <EditScientificMetadataButton onClick={() => setEditing(true)} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ScientificMetadata
          emptyMessage="This resource does not currently expose scientific metadata."
          metadata={resource.scientific_metadata}
        />
      </CardContent>
    </Card>
  )
}

function EditScientificMetadataButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Edit scientific metadata"
            onClick={onClick}
            size="icon-sm"
            variant="outline"
          />
        }
      >
        <EditScientificMetadataIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Edit scientific metadata</TooltipContent>
    </Tooltip>
  )
}

function ScientificMetadataForm({
  mode,
  onCancel,
  onSaved,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  onCancel: () => void
  onSaved: () => void
  resource: EditableResource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [pendingReplacement, setPendingReplacement] =
    useState<WorkspaceScientificMetadataWrite>()
  const [saveError, setSaveError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (update: WorkspaceScientificMetadataWrite) =>
      unwrapHubResult(
        await updateWorkspaceResourceMetadata({
          data: {
            resourceKind: resource.kind,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
            update,
          },
        })
      ),
  })
  const form = useForm({
    defaultValues: {
      metadata: prettyScientificMetadata(resource.scientific_metadata),
    },
    validators: { onChange: scientificMetadataFormSchema },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const parsed = parseScientificMetadata(value.metadata)
      if (!parsed.ok) return
      const update = scientificMetadataWrite(
        resource.scientific_metadata,
        parsed.metadata
      )
      if (!update) {
        form.reset()
        onSaved()
        return
      }
      if (update.kind === "replace") {
        setPendingReplacement(update)
        return
      }
      await save(update)
    },
  })
  const isDirty = useStore(form.store, (state) => state.isDirty)
  const formIsSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const isSubmitting = formIsSubmitting || mutation.isPending
  const discard = useDiscardProtection(isDirty, onCancel)
  const formId = `scientific-metadata-${resource.unique_id}`

  async function save(update: WorkspaceScientificMetadataWrite) {
    try {
      const confirmed = await mutation.mutateAsync(update)
      const resourceQuery = resourceQueryOptions(scope, resource.unique_id)
      queryClient.setQueryData(resourceQuery.queryKey, (current) =>
        mergeScientificMetadataUpdate(current, confirmed.scientific_metadata)
      )
      if (mode === "api") {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: resourceQuery.queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey:
            resource.kind === "sample"
              ? crucibleKeys.sampleLists(scope)
              : crucibleKeys.datasetLists(scope),
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.searches(scope),
        })
      }
      form.reset({
        metadata: prettyScientificMetadata(confirmed.scientific_metadata),
      })
      onSaved()
    } catch (error) {
      setSaveError(scientificMetadataSaveError(error))
    }
  }

  return (
    <>
      <Card aria-busy={isSubmitting}>
        <CardHeader>
          <CardTitle>Scientific metadata</CardTitle>
          <CardAction>
            <Badge variant="secondary">Editing</Badge>
          </CardAction>
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
            <FieldGroup>
              <form.Field name="metadata">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name}>
                      Scientific metadata
                    </FieldLabel>
                    <Textarea
                      aria-invalid={!field.state.meta.isValid || undefined}
                      className="h-metadata-editor-height resize-y font-mono text-supporting"
                      disabled={isSubmitting}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      spellCheck={false}
                      value={field.state.value}
                    />
                    <FieldDescription>
                      Edit the complete JSON object. Arrays, nested objects, and
                      primitive values keep their JSON types.
                    </FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <SaveError message={saveError} />
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            disabled={isSubmitting}
            onClick={discard.requestCancel}
            type="button"
            variant="outline"
          >
            <CancelChangesIcon aria-hidden="true" data-icon="inline-start" />
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isDirty]}
          >
            {([canSubmit, dirty]) => (
              <SaveScientificMetadataButton
                canSubmit={canSubmit}
                dirty={dirty}
                formId={formId}
                submitting={isSubmitting}
              />
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
      <DiscardChangesDialog {...discard.dialog} />
      <MetadataReplacementDialog
        onConfirm={() => {
          if (!pendingReplacement) return
          const update = pendingReplacement
          setPendingReplacement(undefined)
          void save(update)
        }}
        onOpenChange={(open) => !open && setPendingReplacement(undefined)}
        open={pendingReplacement !== undefined}
      />
    </>
  )
}

function SaveScientificMetadataButton({
  canSubmit,
  dirty,
  formId,
  submitting,
}: {
  canSubmit: boolean
  dirty: boolean
  formId: string
  submitting: boolean
}) {
  const label = submitting
    ? "Saving scientific metadata"
    : "Save scientific metadata"
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          aria-disabled={!canSubmit || !dirty || submitting}
          aria-label={label}
          disabled={!canSubmit || !dirty || submitting}
          form={formId}
          size="icon-sm"
          type="submit"
        >
          {submitting ? (
            <SavingChangesIcon
              aria-hidden="true"
              className="motion-safe:animate-spin"
            />
          ) : (
            <SaveChangesIcon aria-hidden="true" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function MetadataReplacementDialog({
  onConfirm,
  onOpenChange,
  open,
}: {
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace scientific metadata?</DialogTitle>
          <DialogDescription>
            Removing a top-level field cannot be applied atomically. Saving will
            replace all scientific metadata with this edited JSON object.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Keep editing
          </Button>
          <Button onClick={onConfirm}>Replace metadata</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SaveError({ message }: { message?: string }) {
  return (
    <div aria-live="polite" className="min-h-5 text-body">
      {message ? (
        <p className="text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  )
}

function scientificMetadataSaveError(error: unknown) {
  if (error instanceof HubApiClientError) return error.message
  return "Scientific metadata could not be saved. Your changes are still here."
}
