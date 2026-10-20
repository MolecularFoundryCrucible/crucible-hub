import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import { notifySuccess } from "@/components/crucible/notifications"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { updateWorkspaceResourceMetadata } from "@/data/crucible/resources.functions"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
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
import { fieldErrors, shouldShowFieldError } from "@/features/forms/field-state"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { SaveError } from "@/components/crucible/form-error"
import type { EditableResource } from "./scientific-metadata-editor"
import {
  MetadataInput,
  draftFromMetadata,
  metadataDraftResult,
  metadataDraftSchema,
} from "./metadata-input"

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
  metadata: metadataDraftSchema,
})

export function mergeScientificMetadataUpdate(
  resource: WorkspaceResourceDetail | null | undefined,
  scientificMetadata: WorkspaceScientificMetadata | null
): WorkspaceResourceDetail | null | undefined {
  if (
    !resource ||
    (resource.kind !== "dataset" &&
      resource.kind !== "sample" &&
      resource.kind !== "instrument")
  ) {
    return resource
  }
  return { ...resource, scientific_metadata: scientificMetadata }
}

export function ScientificMetadataForm({
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
      metadata: draftFromMetadata(resource.scientific_metadata),
    },
    validators: { onChange: scientificMetadataFormSchema },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const result = metadataDraftResult(value.metadata)
      if (!result.ok) return
      const update = scientificMetadataWrite(
        resource.scientific_metadata,
        result.metadata ?? {}
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
      const detailKey =
        resource.kind === "project"
          ? projectQueryOptions(scope, resource.unique_id).queryKey
          : resourceQueryOptions(scope, resource.unique_id).queryKey
      if (resource.kind === "project") {
        queryClient.setQueryData(
          projectQueryOptions(scope, resource.unique_id).queryKey,
          (current) =>
            current
              ? {
                  ...current,
                  scientific_metadata: confirmed.scientific_metadata,
                }
              : current
        )
      } else {
        queryClient.setQueryData(
          resourceQueryOptions(scope, resource.unique_id).queryKey,
          (current) =>
            mergeScientificMetadataUpdate(
              current,
              confirmed.scientific_metadata
            )
        )
      }
      if (mode === "api") {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: detailKey,
        })
        void queryClient.invalidateQueries({
          queryKey: {
            dataset: crucibleKeys.datasetLists,
            instrument: crucibleKeys.instrumentLists,
            project: crucibleKeys.projectLists,
            sample: crucibleKeys.sampleLists,
          }[resource.kind](scope),
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.searches(scope),
        })
      }
      form.reset({
        metadata: draftFromMetadata(confirmed.scientific_metadata),
      })
      notifySuccess("Scientific metadata saved")
      onSaved()
    } catch (error) {
      setSaveError(scientificMetadataSaveError(error))
    }
  }

  return (
    <>
      <Card aria-busy={isSubmitting}>
        <CardHeader actionLayout="inline">
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
                {(field) => {
                  const invalid = shouldShowFieldError(field)
                  return (
                    <Field onBlur={field.handleBlur}>
                      <MetadataInput
                        disabled={isSubmitting}
                        invalid={invalid}
                        onChange={field.handleChange}
                        value={field.state.value}
                      />
                      <FieldError errors={fieldErrors(field, { invalid })} />
                    </Field>
                  )
                }}
              </form.Field>
              <SaveError message={saveError} />
            </FieldGroup>
          </form>
        </CardContent>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isDirty]}>
          {([canSubmit, dirty]) => (
            <EditableCardActions
              canSubmit={canSubmit}
              dirty={dirty}
              formId={formId}
              onCancel={discard.requestCancel}
              pending={isSubmitting}
            />
          )}
        </form.Subscribe>
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
    <ConfirmationDialog
      cancelLabel="Keep editing"
      confirmLabel="Replace metadata"
      description="Removing a top-level field cannot be applied atomically. Saving will replace all scientific metadata with this edited JSON object."
      kind="alert"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="Replace scientific metadata?"
    />
  )
}

function scientificMetadataSaveError(error: unknown) {
  return hubErrorMessage(
    error,
    "Scientific metadata could not be saved. Your changes are still here."
  )
}
