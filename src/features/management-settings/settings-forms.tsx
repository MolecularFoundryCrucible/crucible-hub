import { useState } from "react"
import type { FormEventHandler, ReactNode } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import {
  INSTRUMENT_DESCRIPTION_MAX_LENGTH,
  INSTRUMENT_LOCATION_MAX_LENGTH,
  INSTRUMENT_MANUFACTURER_MAX_LENGTH,
  INSTRUMENT_MODEL_MAX_LENGTH,
  INSTRUMENT_NAME_MAX_LENGTH,
  INSTRUMENT_OTHER_ID_MAX_LENGTH,
  INSTRUMENT_OTHER_ID_SOURCE_MAX_LENGTH,
  INSTRUMENT_TYPE_MAX_LENGTH,
  updateWorkspaceInstrument,
} from "@/data/crucible/instruments.functions"
import { updateWorkspaceProject } from "@/data/crucible/projects.functions"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceInstrument,
  WorkspaceInstrumentDescriptiveUpdate,
  WorkspaceInstrumentPage,
  WorkspaceProject,
  WorkspaceProjectPage,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"

type InstrumentDetail = Extract<WorkspaceResourceDetail, { kind: "instrument" }>
type ProjectDetail = WorkspaceProject & {
  organization: string
  status: string | null
}

const projectSettingsSchema = z.object({
  organization: requiredText("organization"),
  project_id: requiredText("project ID"),
  title: optionalText(255, "title"),
})

const instrumentSettingsSchema = z.object({
  description: optionalText(INSTRUMENT_DESCRIPTION_MAX_LENGTH, "description"),
  instrument_name: requiredText("instrument name"),
  instrument_type: optionalText(INSTRUMENT_TYPE_MAX_LENGTH, "instrument type"),
  location: z
    .string()
    .trim()
    .min(1, "Enter a location.")
    .max(
      INSTRUMENT_LOCATION_MAX_LENGTH,
      `Use ${INSTRUMENT_LOCATION_MAX_LENGTH.toLocaleString()} characters or fewer for location.`
    ),
  manufacturer: optionalText(
    INSTRUMENT_MANUFACTURER_MAX_LENGTH,
    "manufacturer"
  ),
  model: optionalText(INSTRUMENT_MODEL_MAX_LENGTH, "model"),
  other_id: optionalText(INSTRUMENT_OTHER_ID_MAX_LENGTH, "other ID"),
  other_id_source: optionalText(
    INSTRUMENT_OTHER_ID_SOURCE_MAX_LENGTH,
    "other ID source"
  ),
})

type ProjectSettingsValues = z.infer<typeof projectSettingsSchema>
type InstrumentSettingsValues = z.infer<typeof instrumentSettingsSchema>
type ProjectSettingsChanges = {
  organization?: string
  project_id?: string
  title?: string | null
}
type InstrumentSettingsChanges = {
  description?: string | null
  instrument_name?: string
  instrument_type?: string | null
  location?: string
  manufacturer?: string | null
  model?: string | null
  other_id?: string | null
  other_id_source?: string | null
}

function requiredText(label: string) {
  return z
    .string()
    .trim()
    .min(1, `Enter a ${label}.`)
    .max(255, `Use 255 characters or fewer for ${label}.`)
}

function optionalText(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(
      maxLength,
      `Use ${maxLength.toLocaleString()} characters or fewer for ${label}.`
    )
}

function projectValues(project: WorkspaceProject): ProjectSettingsValues {
  return {
    organization: "organization" in project ? project.organization : "",
    project_id: project.project_id,
    title: project.title ?? "",
  }
}

function instrumentValues(
  instrument: InstrumentDetail
): InstrumentSettingsValues {
  return {
    description: instrument.description ?? "",
    instrument_name: instrument.name,
    instrument_type: instrument.instrument_type ?? "",
    location: instrument.location,
    manufacturer: instrument.manufacturer ?? "",
    model: instrument.model ?? "",
    other_id: instrument.other_id ?? "",
    other_id_source: instrument.other_id_source ?? "",
  }
}

export function projectSettingsChanges(
  project: ProjectDetail,
  values: ProjectSettingsValues
): ProjectSettingsChanges {
  const normalized = projectSettingsSchema.parse(values)
  const initial = projectValues(project)
  const changes: ProjectSettingsChanges = {}
  if (normalized.organization !== initial.organization) {
    changes.organization = normalized.organization
  }
  if (normalized.project_id !== initial.project_id) {
    changes.project_id = normalized.project_id
  }
  if (normalized.title !== initial.title) {
    changes.title = normalized.title || null
  }
  return changes
}

export function instrumentSettingsChanges(
  instrument: InstrumentDetail,
  values: InstrumentSettingsValues
): InstrumentSettingsChanges {
  const normalized = instrumentSettingsSchema.parse(values)
  const initial = instrumentValues(instrument)
  const changes: InstrumentSettingsChanges = {}

  for (const field of [
    "description",
    "instrument_type",
    "manufacturer",
    "model",
    "other_id",
    "other_id_source",
  ] as const) {
    if (normalized[field] !== initial[field]) {
      changes[field] = normalized[field] || null
    }
  }
  for (const field of ["instrument_name", "location"] as const) {
    if (normalized[field] !== initial[field]) {
      changes[field] = normalized[field]
    }
  }
  return changes
}

export function mergeInstrumentSettingsUpdate(
  resource: WorkspaceResourceDetail | null | undefined,
  update: WorkspaceInstrumentDescriptiveUpdate
): WorkspaceResourceDetail | null | undefined {
  if (!resource || resource.kind !== "instrument") return resource
  return {
    ...resource,
    description: update.description,
    instrument_id: update.instrument_id,
    instrument_type: update.instrument_type,
    location: update.location,
    manufacturer: update.manufacturer,
    model: update.model,
    modification_time: update.modification_time,
    name: update.instrument_name,
    other_id: update.other_id,
    other_id_source: update.other_id_source,
  }
}

export function ProjectSettingsForm({
  mode,
  onCancel,
  onSaved,
  project,
  scope,
}: {
  mode: "api" | "fixture"
  onCancel?: () => void
  onSaved?: () => void
  project: ProjectDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (changes: ProjectSettingsChanges) =>
      unwrapHubResult(
        await updateWorkspaceProject({
          data: {
            changes,
            projectMfid: project.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const form = useForm({
    defaultValues: projectValues(project),
    validators: { onChange: projectSettingsSchema },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const changes = projectSettingsChanges(project, value)
      if (Object.keys(changes).length === 0) return
      try {
        const update = await mutation.mutateAsync(changes)
        const detailQuery = projectQueryOptions(scope, project.unique_id)
        queryClient.setQueryData<WorkspaceProject>(
          detailQuery.queryKey,
          (current) => mergeProjectSettingsUpdate(current, update)
        )
        if (mode === "fixture") {
          queryClient.setQueriesData<WorkspaceProjectPage>(
            { queryKey: crucibleKeys.projectLists(scope) },
            (page) => mergeProjectListUpdate(page, update)
          )
        } else {
          void queryClient.invalidateQueries({
            exact: true,
            queryKey: detailQuery.queryKey,
          })
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.projectLists(scope),
          })
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.searches(scope),
          })
        }
        form.reset(projectValues(update))
        onSaved?.()
      } catch (error) {
        setSaveError(saveErrorMessage(error, "project"))
      }
    },
  })

  const isDirty = useStore(form.store, (state) => state.isDirty)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(isDirty, () => {
    form.reset()
    onCancel?.()
  })
  const formId = `project-settings-${project.unique_id}`

  return (
    <>
      <SettingsFormCard
        formId={formId}
        isSubmitting={isSubmitting}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
        saveError={saveError}
        actions={
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
              />
            )}
          </form.Subscribe>
        }
        title="Edit project"
      >
        <form.Field name="title">
          {(field) => (
            <SettingsTextField field={field} label="Title" maxLength={255} />
          )}
        </form.Field>
        <form.Field name="organization">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Organization"
              maxLength={255}
              required
            />
          )}
        </form.Field>
        <form.Field name="project_id">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Project ID"
              maxLength={255}
              required
            />
          )}
        </form.Field>
      </SettingsFormCard>
      <DiscardChangesDialog {...discard.dialog} />
    </>
  )
}

export function InstrumentSettingsForm({
  instrument,
  mode,
  onCancel,
  onSaved,
  scope,
}: {
  instrument: InstrumentDetail
  mode: "api" | "fixture"
  onCancel?: () => void
  onSaved?: () => void
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (changes: InstrumentSettingsChanges) =>
      unwrapHubResult(
        await updateWorkspaceInstrument({
          data: {
            changes,
            instrumentMfid: instrument.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const form = useForm({
    defaultValues: instrumentValues(instrument),
    validators: { onChange: instrumentSettingsSchema },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const changes = instrumentSettingsChanges(instrument, value)
      if (Object.keys(changes).length === 0) return
      try {
        const update = await mutation.mutateAsync(changes)
        const detailQuery = resourceQueryOptions(scope, instrument.unique_id)
        queryClient.setQueryData(detailQuery.queryKey, (current) =>
          mergeInstrumentSettingsUpdate(current, update)
        )
        if (mode === "fixture") {
          queryClient.setQueriesData<WorkspaceInstrumentPage>(
            { queryKey: crucibleKeys.instrumentLists(scope) },
            (page) => mergeInstrumentListUpdate(page, update)
          )
        } else {
          void queryClient.invalidateQueries({
            exact: true,
            queryKey: detailQuery.queryKey,
          })
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.instrumentLists(scope),
          })
          void queryClient.invalidateQueries({
            queryKey: crucibleKeys.searches(scope),
          })
        }
        const next = mergeInstrumentSettingsUpdate(instrument, update)
        if (next?.kind === "instrument") form.reset(instrumentValues(next))
        onSaved?.()
      } catch (error) {
        setSaveError(saveErrorMessage(error, "instrument"))
      }
    },
  })

  const isDirty = useStore(form.store, (state) => state.isDirty)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(isDirty, () => {
    form.reset()
    onCancel?.()
  })
  const formId = `instrument-settings-${instrument.unique_id}`

  return (
    <>
      <SettingsFormCard
        formId={formId}
        isSubmitting={isSubmitting}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
        saveError={saveError}
        actions={
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
              />
            )}
          </form.Subscribe>
        }
        title="Edit instrument"
      >
        <form.Field name="instrument_name">
          {(field) => (
            <SettingsTextField
              autoFocus
              field={field}
              label="Name"
              maxLength={INSTRUMENT_NAME_MAX_LENGTH}
              required
            />
          )}
        </form.Field>
        <form.Field name="instrument_type">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Instrument type"
              maxLength={INSTRUMENT_TYPE_MAX_LENGTH}
            />
          )}
        </form.Field>
        <form.Field name="location">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Location"
              maxLength={INSTRUMENT_LOCATION_MAX_LENGTH}
              required
            />
          )}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <SettingsTextAreaField
              field={field}
              label="Description"
              maxLength={INSTRUMENT_DESCRIPTION_MAX_LENGTH}
            />
          )}
        </form.Field>
        <form.Field name="manufacturer">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Manufacturer"
              maxLength={INSTRUMENT_MANUFACTURER_MAX_LENGTH}
            />
          )}
        </form.Field>
        <form.Field name="model">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Model"
              maxLength={INSTRUMENT_MODEL_MAX_LENGTH}
            />
          )}
        </form.Field>
        <form.Field name="other_id">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Other ID"
              maxLength={INSTRUMENT_OTHER_ID_MAX_LENGTH}
            />
          )}
        </form.Field>
        <form.Field name="other_id_source">
          {(field) => (
            <SettingsTextField
              field={field}
              label="Other ID source"
              maxLength={INSTRUMENT_OTHER_ID_SOURCE_MAX_LENGTH}
            />
          )}
        </form.Field>
      </SettingsFormCard>
      <DiscardChangesDialog {...discard.dialog} />
    </>
  )
}

function SettingsFormCard({
  actions,
  children,
  formId,
  isSubmitting,
  onSubmit,
  saveError,
  title,
}: {
  actions: ReactNode
  children: ReactNode
  formId: string
  isSubmitting: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  saveError?: string
  title: string
}) {
  return (
    <Card aria-busy={isSubmitting}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id={formId} noValidate onSubmit={onSubmit}>
          <fieldset disabled={isSubmitting}>
            <FieldGroup>{children}</FieldGroup>
          </fieldset>
          <SaveError message={saveError} />
        </form>
      </CardContent>
      {actions}
    </Card>
  )
}

function SettingsTextField({
  autoFocus = false,
  field,
  label,
  maxLength,
  required = false,
}: {
  autoFocus?: boolean
  field: {
    handleBlur: () => void
    handleChange: (value: string) => void
    name: string
    state: {
      meta: {
        errors: Array<{ message?: string } | undefined>
        isValid: boolean
      }
      value: string
    }
  }
  label: string
  maxLength: number
  required?: boolean
}) {
  return (
    <Field data-invalid={!field.state.meta.isValid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        aria-invalid={!field.state.meta.isValid || undefined}
        autoFocus={autoFocus}
        id={field.name}
        maxLength={maxLength}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        required={required}
        value={field.state.value}
      />
      {required ? null : <FieldDescription>Optional</FieldDescription>}
      <FieldError errors={field.state.meta.errors} />
    </Field>
  )
}

function SettingsTextAreaField({
  field,
  label,
  maxLength,
}: {
  field: {
    handleBlur: () => void
    handleChange: (value: string) => void
    name: string
    state: {
      meta: {
        errors: Array<{ message?: string } | undefined>
        isValid: boolean
      }
      value: string
    }
  }
  label: string
  maxLength: number
}) {
  return (
    <Field data-invalid={!field.state.meta.isValid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Textarea
        aria-invalid={!field.state.meta.isValid || undefined}
        id={field.name}
        maxLength={maxLength}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        value={field.state.value}
      />
      <FieldDescription>Optional</FieldDescription>
      <FieldError errors={field.state.meta.errors} />
    </Field>
  )
}

function SaveError({ message }: { message?: string }) {
  return (
    <div aria-live="polite" className="min-h-5 pt-5 text-body">
      {message ? (
        <p className="text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  )
}

function mergeProjectListUpdate(
  page: WorkspaceProjectPage | undefined,
  update: WorkspaceProject
) {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((project) =>
      project.unique_id === update.unique_id
        ? mergeProjectSettingsUpdate(project, update)
        : project
    ),
  }
}

function mergeProjectSettingsUpdate(
  project: WorkspaceProject | undefined,
  update: WorkspaceProject
): WorkspaceProject {
  if (!project || !("organization" in project) || !("organization" in update)) {
    return update
  }
  return {
    ...project,
    ...update,
    ...(update.members === undefined && project.members !== undefined
      ? { members: project.members }
      : {}),
  }
}

function mergeInstrumentListUpdate(
  page: WorkspaceInstrumentPage | undefined,
  update: WorkspaceInstrumentDescriptiveUpdate
) {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((instrument) =>
      instrument.unique_id === update.unique_id
        ? mergeInstrumentListItem(instrument, update)
        : instrument
    ),
  }
}

function mergeInstrumentListItem(
  instrument: WorkspaceInstrument,
  update: WorkspaceInstrumentDescriptiveUpdate
): WorkspaceInstrument {
  return {
    ...instrument,
    description: update.description,
    instrument_id: update.instrument_id,
    instrument_name: update.instrument_name,
    instrument_type: update.instrument_type,
    location: update.location,
    manufacturer: update.manufacturer,
    model: update.model,
    modification_time: update.modification_time,
    other_id: update.other_id,
    other_id_source: update.other_id_source,
  }
}

function saveErrorMessage(error: unknown, kind: "instrument" | "project") {
  if (error instanceof HubApiClientError) return error.message
  return `The ${kind} could not be saved. Your changes are still here.`
}
