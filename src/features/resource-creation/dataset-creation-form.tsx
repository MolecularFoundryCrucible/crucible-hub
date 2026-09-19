import { useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import type { AnyFormApi } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { ResourceChooser } from "@/components/crucible/resource-chooser"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { createWorkspaceDataset } from "@/data/crucible/creation.functions"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import {
  DATASET_DATA_FORMAT_MAX_LENGTH,
  DATASET_DATA_TYPE_MAX_LENGTH,
  DATASET_MEASUREMENT_MAX_LENGTH,
  DATASET_NAME_MAX_LENGTH,
  DATASET_SESSION_NAME_MAX_LENGTH,
} from "@/data/crucible/resources.functions"
import { isValidLocalDateTime, localDateTimeToUtc } from "@/lib/format"

import {
  creationRelationshipDraftSchema,
  CreationRelationshipsField,
  useCreationRelationshipSubmission,
} from "./creation-relationships"
import type { CreationRelationshipDraft } from "./creation-relationships"
import {
  CreationFormSection,
  useCreationTimestampDefault,
  workspaceSelectionOf,
} from "./creation-form"
import {
  creationFailureMessage,
  isUncertainCreationError,
} from "./creation-error"

const datasetFormSchema = z.object({
  data_format: optionalText(DATASET_DATA_FORMAT_MAX_LENGTH, "data format"),
  data_type: optionalText(DATASET_DATA_TYPE_MAX_LENGTH, "data type"),
  dataset_name: z
    .string()
    .trim()
    .min(1, "Enter a dataset name.")
    .max(
      DATASET_NAME_MAX_LENGTH,
      `Use ${DATASET_NAME_MAX_LENGTH.toLocaleString()} characters or fewer.`
    ),
  instrument: workspaceSelectionOf("instrument").optional(),
  measurement: optionalText(DATASET_MEASUREMENT_MAX_LENGTH, "measurement"),
  project: workspaceSelectionOf("project").optional(),
  public: z.boolean(),
  relationships: z.array(creationRelationshipDraftSchema).max(10),
  session_name: optionalText(DATASET_SESSION_NAME_MAX_LENGTH, "session name"),
  timestamp: z
    .string()
    .refine(isValidLocalDateTime, "Enter a valid date and time."),
})

type DatasetFormValues = z.infer<typeof datasetFormSchema>
type DatasetResource = Extract<WorkspaceResourceDetail, { kind: "dataset" }>

export function DatasetCreationForm({
  initialInstrument,
  initialProject,
  mode,
  scope,
}: {
  initialInstrument?: WorkspaceSearchResult
  initialProject?: WorkspaceSearchResult
  mode: "api" | "fixture"
  scope: IdentityScope
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uncertainOutcome, setUncertainOutcome] = useState(false)
  const [createdDataset, setCreatedDataset] = useState<DatasetResource>()
  const [saveError, setSaveError] = useState<string>()
  const createMutation = useMutation({
    mutationFn: async (value: DatasetFormValues) =>
      unwrapHubResult(
        await createWorkspaceDataset({
          data: {
            dataset: {
              data_format: optionalValue(value.data_format),
              data_type: optionalValue(value.data_type),
              dataset_name: value.dataset_name.trim(),
              instrumentMfid: value.instrument?.unique_id ?? null,
              measurement: optionalValue(value.measurement),
              projectMfid: value.project?.unique_id ?? null,
              public: value.public,
              session_name: optionalValue(value.session_name),
              timestamp: value.timestamp
                ? localDateTimeToUtc(value.timestamp)
                : null,
            },
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const relationships = useCreationRelationshipSubmission({
    onApplied: (resource) => {
      if (resource.kind === "dataset") setCreatedDataset(resource)
    },
    resourceKind: "dataset",
    scope,
  })
  const form = useDatasetForm(
    {
      data_format: "",
      data_type: "",
      dataset_name: "",
      instrument: initialInstrument,
      measurement: "",
      project: initialProject,
      public: false,
      relationships: [] as CreationRelationshipDraft[],
      session_name: "",
      timestamp: "",
    },
    async ({ formApi, value }) => {
      setSaveError(undefined)
      if (createdDataset) {
        const complete = await relationships.apply(
          createdDataset.unique_id,
          value.relationships
        )
        if (complete) await openCreatedDataset(createdDataset.unique_id)
        return
      }
      if (uncertainOutcome) {
        return
      }
      try {
        const created = await createMutation.mutateAsync(value)
        if (created.kind !== "dataset") {
          throw new Error("The dataset creation response is invalid.")
        }
        setCreatedDataset(created)
        cacheDataset(created)
        formApi.reset(value)
        const complete = await relationships.apply(
          created.unique_id,
          value.relationships
        )
        if (complete) await openCreatedDataset(created.unique_id)
      } catch (error) {
        setUncertainOutcome(isUncertainCreationError(error))
        setSaveError(creationFailureMessage("dataset", error))
      }
    }
  )
  useCreationTimestampDefault(form)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(
    () => form.state.isDirty,
    () => {
      void navigate({ search: { kind: "datasets" }, to: "/data" })
    },
    true
  )
  const busy =
    isSubmitting || createMutation.isPending || relationships.isPending
  const formId = "dataset-creation"

  function cacheDataset(dataset: DatasetResource) {
    queryClient.setQueryData(
      resourceQueryOptions(scope, dataset.unique_id).queryKey,
      dataset
    )
    if (mode === "api") {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: resourceQueryOptions(scope, dataset.unique_id).queryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.datasetLists(scope),
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.searches(scope),
      })
    }
  }

  async function openCreatedDataset(datasetMfid: string) {
    await navigate({
      params: { datasetMfid },
      to: "/datasets/$datasetMfid",
    })
  }

  return (
    <>
      <ContentBoundary width="reading">
        <Card aria-busy={busy}>
          <CardHeader>
            <CardTitle>Dataset details</CardTitle>
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
              <fieldset disabled={busy || Boolean(createdDataset)}>
                <FieldGroup>
                  <form.Field name="dataset_name">
                    {(field) => {
                      const invalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      const errorId = `${field.name}-error`
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={field.name}>
                            Name <span aria-hidden="true">*</span>
                          </FieldLabel>
                          <Input
                            aria-describedby={errorId}
                            aria-errormessage={invalid ? errorId : undefined}
                            autoFocus
                            aria-invalid={invalid || undefined}
                            id={field.name}
                            maxLength={DATASET_NAME_MAX_LENGTH}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            required
                            value={field.state.value}
                          />
                          <FieldError
                            errors={field.state.meta.errors}
                            id={errorId}
                          />
                        </Field>
                      )
                    }}
                  </form.Field>
                  <form.Field name="project">
                    {(field) => {
                      const invalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field
                          data-invalid={invalid}
                          data-disabled={Boolean(createdDataset)}
                        >
                          <FieldLabel
                            htmlFor="dataset-project-trigger"
                            optional
                          >
                            Project
                          </FieldLabel>
                          <ResourceChooser
                            describedBy="dataset-project-error"
                            emptyLabel="Not selected"
                            invalid={invalid}
                            kind="project"
                            onChange={field.handleChange}
                            triggerId="dataset-project-trigger"
                            value={field.state.value}
                          />
                          <FieldError
                            id="dataset-project-error"
                            errors={field.state.meta.errors}
                          />
                        </Field>
                      )
                    }}
                  </form.Field>
                  <form.Field name="public">
                    {(field) => {
                      const descriptionId = `${field.name}-description`
                      return (
                        <Field data-disabled={Boolean(createdDataset)}>
                          <FieldLabel htmlFor={field.name}>
                            Visibility
                          </FieldLabel>
                          <NativeSelect
                            aria-describedby={descriptionId}
                            id={field.name}
                            name={field.name}
                            onChange={(event) =>
                              field.handleChange(
                                event.target.value === "public"
                              )
                            }
                            value={field.state.value ? "public" : "private"}
                          >
                            <NativeSelectOption value="private">
                              Private
                            </NativeSelectOption>
                            <NativeSelectOption value="public">
                              Public
                            </NativeSelectOption>
                          </NativeSelect>
                          <FieldDescription id={descriptionId}>
                            Public datasets can be read outside their project
                            grants.
                          </FieldDescription>
                        </Field>
                      )
                    }}
                  </form.Field>
                  <CreationFormSection title="Acquisition">
                    <form.Field name="instrument">
                      {(field) => (
                        <Field data-disabled={Boolean(createdDataset)}>
                          <FieldLabel
                            htmlFor="dataset-instrument-trigger"
                            optional
                          >
                            Acquisition instrument
                          </FieldLabel>
                          <ResourceChooser
                            emptyLabel="Not selected"
                            kind="instrument"
                            onChange={field.handleChange}
                            triggerId="dataset-instrument-trigger"
                            value={field.state.value}
                          />
                        </Field>
                      )}
                    </form.Field>
                    <DatasetTextField
                      fieldName="measurement"
                      form={form}
                      label="Measurement"
                      maxLength={DATASET_MEASUREMENT_MAX_LENGTH}
                    />
                    <form.Field name="timestamp">
                      {(field) => {
                        const invalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        const errorId = `${field.name}-error`
                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel htmlFor={field.name} optional>
                              Local date and time
                            </FieldLabel>
                            <Input
                              aria-describedby={errorId}
                              aria-errormessage={invalid ? errorId : undefined}
                              aria-invalid={invalid || undefined}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              type="datetime-local"
                              value={field.state.value}
                            />
                            <FieldError
                              errors={field.state.meta.errors}
                              id={errorId}
                            />
                          </Field>
                        )
                      }}
                    </form.Field>
                    <DatasetTextField
                      fieldName="session_name"
                      form={form}
                      label="Session name"
                      maxLength={DATASET_SESSION_NAME_MAX_LENGTH}
                    />
                  </CreationFormSection>
                  <CreationFormSection title="Data">
                    <DatasetTextField
                      fieldName="data_format"
                      form={form}
                      label="Data format"
                      maxLength={DATASET_DATA_FORMAT_MAX_LENGTH}
                    />
                    <DatasetTextField
                      fieldName="data_type"
                      form={form}
                      label="Data type"
                      maxLength={DATASET_DATA_TYPE_MAX_LENGTH}
                    />
                  </CreationFormSection>
                  <CreationFormSection title="Relationships">
                    <form.Field name="relationships">
                      {(field) => (
                        <CreationRelationshipsField
                          disabled={busy || Boolean(createdDataset)}
                          onChange={field.handleChange}
                          resourceKind="dataset"
                          scope={scope}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                  </CreationFormSection>
                </FieldGroup>
              </fieldset>
              <div aria-live="polite" className="min-h-5 pt-5 text-body">
                {saveError ? (
                  <p className="text-destructive" role="alert">
                    {saveError}
                  </p>
                ) : null}
                {createdDataset && relationships.failures.length ? (
                  <div className="flex flex-col gap-2" role="alert">
                    <p className="text-destructive">
                      The dataset was created, but relationships with{" "}
                      {relationships.failures
                        .map((draft) => draft.target.name)
                        .join(", ")}{" "}
                      still need recovery.
                    </p>
                  </div>
                ) : null}
              </div>
            </form>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              disabled={busy}
              onClick={discard.requestCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              aria-disabled={
                busy ||
                uncertainOutcome ||
                (Boolean(createdDataset) && relationships.failures.length === 0)
              }
              disabled={
                busy ||
                uncertainOutcome ||
                (Boolean(createdDataset) && relationships.failures.length === 0)
              }
              className="min-w-52"
              form={formId}
              type="submit"
            >
              {createdDataset
                ? relationships.failures.length
                  ? "Retry missing relationships"
                  : "Dataset created"
                : uncertainOutcome
                  ? "Create dataset"
                  : isSubmitting || createMutation.isPending
                    ? "Creating dataset"
                    : "Create dataset"}
            </Button>
          </CardFooter>
        </Card>
      </ContentBoundary>
      <DiscardChangesDialog {...discard.dialog} />
    </>
  )
}

function DatasetTextField({
  fieldName,
  form,
  label,
  maxLength,
}: {
  fieldName: "data_format" | "data_type" | "measurement" | "session_name"
  form: ReturnType<typeof useDatasetForm>
  label: string
  maxLength: number
}) {
  return (
    <form.Field name={fieldName}>
      {(field) => {
        const invalid = field.state.meta.isTouched && !field.state.meta.isValid
        const errorId = `${field.name}-error`
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name} optional>
              {label}
            </FieldLabel>
            <Input
              aria-describedby={errorId}
              aria-errormessage={invalid ? errorId : undefined}
              aria-invalid={invalid || undefined}
              id={field.name}
              maxLength={maxLength}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            <FieldError errors={field.state.meta.errors} id={errorId} />
          </Field>
        )
      }}
    </form.Field>
  )
}

function useDatasetForm(
  defaultValues: DatasetFormValues,
  onSubmit: (args: {
    formApi: AnyFormApi
    value: DatasetFormValues
  }) => Promise<void>
) {
  return useForm({
    defaultValues,
    validators: { onChange: datasetFormSchema },
    onSubmit,
  })
}

function optionalText(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(maxLength, `Use ${maxLength.toLocaleString()} characters or fewer.`)
    .describe(label)
}

function optionalValue(value: string) {
  return value.trim() || null
}
