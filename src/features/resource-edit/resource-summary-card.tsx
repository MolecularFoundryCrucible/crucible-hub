import { useState } from "react"
import type { ReactNode } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import { EditResourceIcon } from "@/components/crucible/icons"
import { notifySuccess } from "@/components/crucible/notifications"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { SummaryFieldIcon } from "@/components/crucible/summary-field-icon"
import type { SummaryFieldType } from "@/components/crucible/summary-field-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
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
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import {
  DATASET_DATA_FORMAT_MAX_LENGTH,
  DATASET_DATA_TYPE_MAX_LENGTH,
  DATASET_MEASUREMENT_MAX_LENGTH,
  DATASET_NAME_MAX_LENGTH,
  DATASET_SESSION_NAME_MAX_LENGTH,
  SAMPLE_DESCRIPTION_MAX_LENGTH,
  SAMPLE_NAME_MAX_LENGTH,
  SAMPLE_TYPE_MAX_LENGTH,
  updateWorkspaceDatasetDescription,
  updateWorkspaceSampleDescription,
} from "@/data/crucible/resources.functions"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceCursorPage,
  WorkspaceDataset,
  WorkspaceDatasetDescriptiveUpdate,
  WorkspaceResourceDetail,
  WorkspaceSample,
  WorkspaceSampleDescriptiveUpdate,
} from "@/data/crucible/workspace-source"
import {
  formatLocalDateTime,
  isValidLocalDateTime,
  localDateTimeToUtc,
  timestampToLocalInput,
} from "@/lib/format"

type DatasetDetail = Extract<WorkspaceResourceDetail, { kind: "dataset" }>
type SampleDetail = Extract<WorkspaceResourceDetail, { kind: "sample" }>
type SummaryField = readonly [string, ReactNode, SummaryFieldType]

const sampleSummaryFormSchema = z.object({
  description: z
    .string()
    .trim()
    .max(
      SAMPLE_DESCRIPTION_MAX_LENGTH,
      `Use ${SAMPLE_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters or fewer.`
    ),
  sample_name: z
    .string()
    .trim()
    .min(1, "Enter a sample name.")
    .max(
      SAMPLE_NAME_MAX_LENGTH,
      `Use ${SAMPLE_NAME_MAX_LENGTH.toLocaleString()} characters or fewer.`
    ),
  sample_type: z
    .string()
    .trim()
    .max(
      SAMPLE_TYPE_MAX_LENGTH,
      `Use ${SAMPLE_TYPE_MAX_LENGTH.toLocaleString()} characters or fewer.`
    ),
  timestamp: z
    .string()
    .refine(isValidLocalDateTime, "Enter a valid local date and time."),
})

const datasetSummaryFormSchema = z.object({
  data_format: optionalDatasetField(
    DATASET_DATA_FORMAT_MAX_LENGTH,
    "data format"
  ),
  data_type: optionalDatasetField(DATASET_DATA_TYPE_MAX_LENGTH, "data type"),
  dataset_name: z
    .string()
    .trim()
    .min(1, "Enter a dataset name.")
    .max(
      DATASET_NAME_MAX_LENGTH,
      `Use ${DATASET_NAME_MAX_LENGTH.toLocaleString()} characters or fewer.`
    ),
  measurement: optionalDatasetField(
    DATASET_MEASUREMENT_MAX_LENGTH,
    "measurement"
  ),
  session_name: optionalDatasetField(
    DATASET_SESSION_NAME_MAX_LENGTH,
    "session name"
  ),
  timestamp: z
    .string()
    .refine(isValidLocalDateTime, "Enter a valid local date and time."),
})

type SampleSummaryFormValues = z.infer<typeof sampleSummaryFormSchema>
type SampleSummaryChanges = {
  description?: string | null
  sample_name?: string
  sample_type?: string | null
  timestamp?: string | null
}
type DatasetSummaryFormValues = z.infer<typeof datasetSummaryFormSchema>
type DatasetSummaryChanges = {
  data_format?: string | null
  data_type?: string | null
  dataset_name?: string
  measurement?: string | null
  session_name?: string | null
  timestamp?: string | null
}

const datasetFieldDefinitions = [
  {
    autoFocus: true,
    label: "Name",
    maxLength: DATASET_NAME_MAX_LENGTH,
    name: "dataset_name",
    required: true,
  },
  {
    autoFocus: false,
    label: "Measurement",
    maxLength: DATASET_MEASUREMENT_MAX_LENGTH,
    name: "measurement",
    required: false,
  },
  {
    autoFocus: false,
    label: "Data format",
    maxLength: DATASET_DATA_FORMAT_MAX_LENGTH,
    name: "data_format",
    required: false,
  },
  {
    autoFocus: false,
    label: "Data type",
    maxLength: DATASET_DATA_TYPE_MAX_LENGTH,
    name: "data_type",
    required: false,
  },
  {
    autoFocus: false,
    label: "Session",
    maxLength: DATASET_SESSION_NAME_MAX_LENGTH,
    name: "session_name",
    required: false,
  },
] as const

function optionalDatasetField(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(
      maxLength,
      `Use ${maxLength.toLocaleString()} characters or fewer for ${label}.`
    )
}

function timestampFieldDescription(timestamp: string | null) {
  if (timestamp && timestampToLocalInput(timestamp) === "") {
    return `Current nonstandard value: ${timestamp}. Choose a local date and time to replace it.`
  }
  return "Entered in your local time and stored as UTC."
}

function sampleFormValues(resource: SampleDetail): SampleSummaryFormValues {
  return {
    description: resource.description ?? "",
    sample_name: resource.name,
    sample_type: resource.sample_type ?? "",
    timestamp: timestampToLocalInput(resource.timestamp),
  }
}

function datasetFormValues(resource: DatasetDetail): DatasetSummaryFormValues {
  return {
    data_format: resource.data_format ?? "",
    data_type: resource.data_type ?? "",
    dataset_name: resource.name,
    measurement: resource.measurement ?? "",
    session_name: resource.session_name ?? "",
    timestamp: timestampToLocalInput(resource.timestamp),
  }
}

export function sampleSummaryChanges(
  resource: SampleDetail,
  values: SampleSummaryFormValues
): SampleSummaryChanges {
  const normalized = sampleSummaryFormSchema.parse(values)
  const changes: SampleSummaryChanges = {}

  if (normalized.sample_name !== resource.name) {
    changes.sample_name = normalized.sample_name
  }
  if (normalized.sample_type !== (resource.sample_type ?? "")) {
    changes.sample_type = normalized.sample_type || null
  }
  if (normalized.description !== (resource.description ?? "")) {
    changes.description = normalized.description || null
  }
  if (normalized.timestamp !== timestampToLocalInput(resource.timestamp)) {
    changes.timestamp = localDateTimeToUtc(normalized.timestamp)
  }

  return changes
}

export function datasetSummaryChanges(
  resource: DatasetDetail,
  values: DatasetSummaryFormValues
): DatasetSummaryChanges {
  const normalized = datasetSummaryFormSchema.parse(values)
  const changes: DatasetSummaryChanges = {}

  if (normalized.dataset_name !== resource.name) {
    changes.dataset_name = normalized.dataset_name
  }
  for (const field of [
    "measurement",
    "data_format",
    "data_type",
    "session_name",
  ] as const) {
    if (normalized[field] !== (resource[field] ?? "")) {
      changes[field] = normalized[field] || null
    }
  }
  if (normalized.timestamp !== timestampToLocalInput(resource.timestamp)) {
    changes.timestamp = localDateTimeToUtc(normalized.timestamp)
  }

  return changes
}

export function mergeSampleSummaryUpdate(
  resource: WorkspaceResourceDetail | null | undefined,
  update: WorkspaceSampleDescriptiveUpdate
): WorkspaceResourceDetail | null | undefined {
  if (!resource || resource.kind !== "sample") return resource
  return {
    ...resource,
    description: update.description,
    modification_time: update.modification_time,
    name: update.sample_name,
    sample_type: update.sample_type,
    timestamp: update.timestamp,
  }
}

export function mergeDatasetSummaryUpdate(
  resource: WorkspaceResourceDetail | null | undefined,
  update: WorkspaceDatasetDescriptiveUpdate
): WorkspaceResourceDetail | null | undefined {
  if (!resource || resource.kind !== "dataset") return resource
  return {
    ...resource,
    data_format: update.data_format,
    data_type: update.data_type,
    measurement: update.measurement,
    modification_time: update.modification_time,
    name: update.dataset_name,
    session_name: update.session_name,
    timestamp: update.timestamp,
  }
}

export function ResourceSummaryCard({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: WorkspaceResourceDetail
  scope: IdentityScope
}) {
  if (resource.kind === "sample") {
    return <SampleSummaryCard mode={mode} resource={resource} scope={scope} />
  }
  if (resource.kind === "dataset") {
    return <DatasetSummaryCard mode={mode} resource={resource} scope={scope} />
  }
  return <SummaryCard fields={summaryFields(resource)} />
}

function SampleSummaryCard({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: SampleDetail
  scope: IdentityScope
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <SampleSummaryForm
        mode={mode}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        resource={resource}
        scope={scope}
      />
    )
  }
  return (
    <SummaryCard
      action={
        resource.capabilities?.can_edit === true ? (
          <EditSummaryButton onClick={() => setEditing(true)} />
        ) : undefined
      }
      fields={summaryFields(resource)}
    />
  )
}

function DatasetSummaryCard({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: DatasetDetail
  scope: IdentityScope
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <DatasetSummaryForm
        mode={mode}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        resource={resource}
        scope={scope}
      />
    )
  }
  return (
    <SummaryCard
      action={
        resource.capabilities?.can_edit === true ? (
          <EditSummaryButton onClick={() => setEditing(true)} />
        ) : undefined
      }
      fields={summaryFields(resource)}
    />
  )
}

function EditSummaryButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Edit summary"
            onClick={onClick}
            size="icon-sm"
            variant="outline"
          />
        }
      >
        <EditResourceIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Edit summary</TooltipContent>
    </Tooltip>
  )
}

function SummaryCard({
  action,
  fields,
}: {
  action?: ReactNode
  fields: readonly SummaryField[]
}) {
  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Summary</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <SummaryFields fields={fields} />
      </CardContent>
    </Card>
  )
}

function SummaryFields({ fields }: { fields: readonly SummaryField[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map(([label, value, type]) => (
        <div className="min-w-0" key={label}>
          <dt className="text-label text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-body break-words">
            <SummaryFieldIcon type={type} />
            <span className="min-w-0">{value ?? "-"}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function SampleSummaryForm({
  mode,
  onCancel,
  onSaved,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  onCancel: () => void
  onSaved: () => void
  resource: SampleDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (changes: SampleSummaryChanges) =>
      unwrapHubResult(
        await updateWorkspaceSampleDescription({
          data: {
            changes,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const form = useForm({
    defaultValues: sampleFormValues(resource),
    validators: { onChange: sampleSummaryFormSchema },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const changes = sampleSummaryChanges(resource, value)
      if (Object.keys(changes).length === 0) return

      try {
        const update = await mutation.mutateAsync(changes)
        const resourceQuery = resourceQueryOptions(scope, resource.unique_id)
        queryClient.setQueryData(resourceQuery.queryKey, (current) =>
          mergeSampleSummaryUpdate(current, update)
        )
        if (mode === "api") {
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.sampleLists(scope),
          })
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.searches(scope),
          })
          void queryClient.invalidateQueries({
            exact: true,
            queryKey: resourceQuery.queryKey,
          })
        } else {
          queryClient.setQueriesData<WorkspaceCursorPage<WorkspaceSample>>(
            { queryKey: crucibleKeys.sampleLists(scope) },
            (page) => mergeSampleListUpdate(page, update)
          )
        }
        form.reset({
          description: update.description ?? "",
          sample_name: update.sample_name,
          sample_type: update.sample_type ?? "",
          timestamp: timestampToLocalInput(update.timestamp),
        })
        notifySuccess("Sample summary saved")
        onSaved()
      } catch (error) {
        setSaveError(saveErrorMessage(error, "sample"))
      }
    },
  })
  const isDirty = useStore(form.store, (state) => state.isDirty)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(isDirty, onCancel)
  const formId = `sample-summary-${resource.unique_id}`

  return (
    <>
      <Card aria-busy={isSubmitting}>
        <CardHeader actionLayout="inline">
          <CardTitle>Summary</CardTitle>
          <CardAction>
            <Badge variant="secondary">Editing</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
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
              <form.Field name="sample_name">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      autoFocus
                      disabled={isSubmitting}
                      id={field.name}
                      maxLength={SAMPLE_NAME_MAX_LENGTH}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      required
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="sample_type">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name} optional>
                      Sample type
                    </FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      disabled={isSubmitting}
                      id={field.name}
                      maxLength={SAMPLE_TYPE_MAX_LENGTH}
                      name={field.name}
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

              <form.Field name="description">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name} optional>
                      Description
                    </FieldLabel>
                    <Textarea
                      aria-invalid={!field.state.meta.isValid || undefined}
                      disabled={isSubmitting}
                      id={field.name}
                      maxLength={SAMPLE_DESCRIPTION_MAX_LENGTH}
                      name={field.name}
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

              <form.Field name="timestamp">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name} optional>
                      Timestamp
                    </FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      disabled={isSubmitting}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      step={1}
                      type="datetime-local"
                      value={field.state.value}
                    />
                    <FieldDescription>
                      {timestampFieldDescription(resource.timestamp)}
                    </FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <SaveError message={saveError} />
            </FieldGroup>
          </form>
          <SummaryFields fields={contextFields(resource)} />
        </CardContent>
        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isDirty,
            state.isSubmitting,
          ]}
        >
          {([canSubmit, formIsDirty, submitting]) => (
            <EditableCardActions
              canSubmit={canSubmit}
              dirty={formIsDirty}
              formId={formId}
              onCancel={discard.requestCancel}
              pending={submitting}
              presentation="icon"
            />
          )}
        </form.Subscribe>
      </Card>
      <DiscardChangesDialog {...discard.dialog} />
    </>
  )
}

function DatasetSummaryForm({
  mode,
  onCancel,
  onSaved,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  onCancel: () => void
  onSaved: () => void
  resource: DatasetDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (changes: DatasetSummaryChanges) =>
      unwrapHubResult(
        await updateWorkspaceDatasetDescription({
          data: {
            changes,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const form = useForm({
    defaultValues: datasetFormValues(resource),
    validators: { onChange: datasetSummaryFormSchema },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const changes = datasetSummaryChanges(resource, value)
      if (Object.keys(changes).length === 0) return

      try {
        const update = await mutation.mutateAsync(changes)
        const resourceQuery = resourceQueryOptions(scope, resource.unique_id)
        queryClient.setQueryData(resourceQuery.queryKey, (current) =>
          mergeDatasetSummaryUpdate(current, update)
        )
        if (mode === "api") {
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.datasetLists(scope),
          })
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.searches(scope),
          })
          void queryClient.invalidateQueries({
            exact: true,
            queryKey: resourceQuery.queryKey,
          })
        } else {
          queryClient.setQueriesData<WorkspaceCursorPage<WorkspaceDataset>>(
            { queryKey: crucibleKeys.datasetLists(scope) },
            (page) => mergeDatasetListUpdate(page, update)
          )
        }
        form.reset({
          data_format: update.data_format ?? "",
          data_type: update.data_type ?? "",
          dataset_name: update.dataset_name,
          measurement: update.measurement ?? "",
          session_name: update.session_name ?? "",
          timestamp: timestampToLocalInput(update.timestamp),
        })
        notifySuccess("Dataset summary saved")
        onSaved()
      } catch (error) {
        setSaveError(saveErrorMessage(error, "dataset"))
      }
    },
  })
  const isDirty = useStore(form.store, (state) => state.isDirty)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(isDirty, onCancel)
  const formId = `dataset-summary-${resource.unique_id}`

  return (
    <>
      <Card aria-busy={isSubmitting}>
        <CardHeader actionLayout="inline">
          <CardTitle>Summary</CardTitle>
          <CardAction>
            <Badge variant="secondary">Editing</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
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
              {datasetFieldDefinitions.map((definition) => (
                <form.Field key={definition.name} name={definition.name}>
                  {(field) => (
                    <Field data-invalid={!field.state.meta.isValid}>
                      <FieldLabel
                        htmlFor={field.name}
                        optional={!definition.required}
                      >
                        {definition.label}
                      </FieldLabel>
                      <Input
                        aria-invalid={!field.state.meta.isValid || undefined}
                        autoFocus={definition.autoFocus}
                        disabled={isSubmitting}
                        id={field.name}
                        maxLength={definition.maxLength}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={definition.required}
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              ))}
              <form.Field name="timestamp">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={field.name} optional>
                      Timestamp
                    </FieldLabel>
                    <Input
                      aria-invalid={!field.state.meta.isValid || undefined}
                      disabled={isSubmitting}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      step={1}
                      type="datetime-local"
                      value={field.state.value}
                    />
                    <FieldDescription>
                      {timestampFieldDescription(resource.timestamp)}
                    </FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <SaveError message={saveError} />
            </FieldGroup>
          </form>
          <SummaryFields fields={contextFields(resource)} />
        </CardContent>
        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isDirty,
            state.isSubmitting,
          ]}
        >
          {([canSubmit, formIsDirty, submitting]) => (
            <EditableCardActions
              canSubmit={canSubmit}
              dirty={formIsDirty}
              formId={formId}
              onCancel={discard.requestCancel}
              pending={submitting}
              presentation="icon"
            />
          )}
        </form.Subscribe>
      </Card>
      <DiscardChangesDialog {...discard.dialog} />
    </>
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

function saveErrorMessage(error: unknown, kind: "dataset" | "sample") {
  return hubErrorMessage(
    error,
    `The ${kind} could not be saved. Your changes are still here.`
  )
}

function mergeSampleListUpdate(
  page: WorkspaceCursorPage<WorkspaceSample> | undefined,
  update: WorkspaceSampleDescriptiveUpdate
) {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((sample) =>
      sample.unique_id === update.unique_id
        ? {
            ...sample,
            modification_time: update.modification_time,
            sample_name: update.sample_name,
            sample_type: update.sample_type,
            timestamp: update.timestamp,
          }
        : sample
    ),
  }
}

function mergeDatasetListUpdate(
  page: WorkspaceCursorPage<WorkspaceDataset> | undefined,
  update: WorkspaceDatasetDescriptiveUpdate
) {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((dataset) =>
      dataset.unique_id === update.unique_id
        ? {
            ...dataset,
            dataset_name: update.dataset_name,
            measurement: update.measurement,
            modification_time: update.modification_time,
            timestamp: update.timestamp,
          }
        : dataset
    ),
  }
}

function summaryFields(
  resource: WorkspaceResourceDetail
): readonly SummaryField[] {
  if (resource.kind === "dataset") {
    return [
      ["Measurement", resource.measurement, "measurement"],
      ["Data format", resource.data_format, "data-format"],
      ["Data type", resource.data_type, "data-type"],
      ["Session", resource.session_name, "session"],
      ...contextFields(resource),
      ["Timestamp", formatLocalDateTime(resource.timestamp), "timestamp"],
    ]
  }
  if (resource.kind === "sample") {
    return [
      ["Description", resource.description, "description"],
      ["Sample type", resource.sample_type, "type"],
      ...contextFields(resource),
      ["Timestamp", formatLocalDateTime(resource.timestamp), "timestamp"],
    ]
  }
  if (resource.kind === "instrument") {
    return [
      ["Instrument type", resource.instrument_type, "type"],
      ["Location", resource.location, "location"],
      ["Manufacturer", resource.manufacturer, "manufacturer"],
      ["Model", resource.model, "model"],
      ["Status", resource.status, "status"],
    ]
  }
  return [
    ["Project ID", resource.project_id, "project"],
    ["Organization", resource.organization, "organization"],
    ["Status", resource.status, "status"],
  ]
}

function contextFields(
  resource: DatasetDetail | SampleDetail
): readonly SummaryField[] {
  const project = resource.project ? (
    <ResourceIdentityLink
      context={resource.project.project_id}
      kind="project"
      mfid={resource.project.unique_id}
      name={resource.project.title ?? resource.project.project_id}
    >
      <span className="text-label group-hover/resource:underline">
        {resource.project.title ?? resource.project.project_id}
      </span>
    </ResourceIdentityLink>
  ) : (
    resource.project_id
  )
  if (resource.kind === "sample") return [["Project", project, "project"]]
  const instrument = resource.instrument ? (
    <ResourceIdentityLink
      context={resource.instrument.instrument_id}
      kind="instrument"
      mfid={resource.instrument.unique_id}
      name={resource.instrument.instrument_name}
    >
      <span className="text-label group-hover/resource:underline">
        {resource.instrument.instrument_name}
      </span>
    </ResourceIdentityLink>
  ) : (
    resource.instrument_id
  )
  return [
    ["Project", project, "project"],
    ["Instrument", instrument, "instrument"],
  ]
}
