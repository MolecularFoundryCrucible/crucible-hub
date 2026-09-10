import { useState } from "react"
import type { AnyFormApi } from "@tanstack/react-form"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { createWorkspaceSample } from "@/data/crucible/creation.functions"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  SAMPLE_DESCRIPTION_MAX_LENGTH,
  SAMPLE_NAME_MAX_LENGTH,
  SAMPLE_TYPE_MAX_LENGTH,
} from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import { isValidLocalDateTime, localDateTimeToUtc } from "@/lib/format"

import {
  creationRelationshipDraftSchema,
  CreationRelationshipsField,
  useCreationRelationshipSubmission,
} from "./creation-relationships"
import type { CreationRelationshipDraft } from "./creation-relationships"
import { CreationFormSection } from "./creation-form-section"
import {
  creationFailureMessage,
  isUncertainCreationError,
} from "./creation-error"

const selectedProjectSchema = z.custom<WorkspaceSearchResult | null>(
  (value) =>
    value !== null &&
    typeof value === "object" &&
    (value as WorkspaceSearchResult).kind === "project",
  "Choose a project."
)

const sampleSchema = z.object({
  description: z
    .string()
    .trim()
    .max(
      SAMPLE_DESCRIPTION_MAX_LENGTH,
      `Use ${SAMPLE_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters or fewer.`
    ),
  project: selectedProjectSchema,
  relationships: z.array(creationRelationshipDraftSchema).max(10),
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
    .refine(isValidLocalDateTime, "Use a valid local date and time."),
  visibility: z.enum(["private", "public"]),
})

type SampleValues = z.infer<typeof sampleSchema>

function optionalValue(value: string) {
  return value || null
}

export function SampleCreationForm({
  initialProject,
  scope,
}: {
  initialProject?: WorkspaceSearchResult
  scope: IdentityScope
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string>()
  const [uncertainOutcome, setUncertainOutcome] = useState(false)
  const [createdSample, setCreatedSample] =
    useState<Extract<WorkspaceResourceDetail, { kind: "sample" }>>()
  const mutation = useMutation({
    mutationFn: async (value: SampleValues) =>
      unwrapHubResult(
        await createWorkspaceSample({
          data: {
            sample: {
              description: optionalValue(value.description),
              projectMfid: value.project?.unique_id ?? "",
              public: value.visibility === "public",
              sample_name: value.sample_name,
              sample_type: optionalValue(value.sample_type),
              timestamp: localDateTimeToUtc(value.timestamp),
            },
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const relationships = useCreationRelationshipSubmission({
    onApplied: (resource) => {
      if (resource.kind === "sample") setCreatedSample(resource)
    },
    resourceKind: "sample",
    scope,
  })
  const form = useSampleForm(initialProject, async (value, submittedForm) => {
    setSaveError(undefined)
    if (createdSample) {
      const complete = await relationships.apply(
        createdSample.unique_id,
        value.relationships
      )
      if (complete) {
        await navigate({
          params: { sampleMfid: createdSample.unique_id },
          to: "/samples/$sampleMfid",
        })
      }
      return
    }
    if (uncertainOutcome) return
    try {
      const resource = await mutation.mutateAsync(value)
      if (resource.kind !== "sample") {
        throw new Error("The sample creation response is invalid.")
      }
      setCreatedSample(resource)
      const resourceQuery = resourceQueryOptions(scope, resource.unique_id)
      queryClient.setQueryData(resourceQuery.queryKey, resource)
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.sampleLists(scope),
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.searches(scope),
      })
      submittedForm.reset(value)
      const complete = await relationships.apply(
        resource.unique_id,
        value.relationships
      )
      if (complete) {
        await navigate({
          params: { sampleMfid: resource.unique_id },
          to: "/samples/$sampleMfid",
        })
      }
    } catch (error) {
      const uncertain = isUncertainCreationError(error)
      setUncertainOutcome(uncertain)
      setSaveError(creationFailureMessage("sample", error))
    }
  })
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const busy = isSubmitting || mutation.isPending || relationships.isPending
  const discard = useDiscardProtection(
    () => form.state.isDirty,
    () => {
      void navigate({ to: "/data" })
    },
    true
  )
  const formId = "sample-creation"

  return (
    <PageLayout>
      <PageHeader eyebrow="Samples" title="Create sample" />
      <ContentBoundary width="reading">
        <Card aria-busy={busy}>
          <CardHeader>
            <CardTitle>Sample details</CardTitle>
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
              <fieldset disabled={busy || Boolean(createdSample)}>
                <FieldGroup>
                  <SampleTextField
                    autoFocus
                    fieldName="sample_name"
                    form={form}
                    label="Name"
                    required
                  />
                  <form.Field name="project">
                    {(field) => {
                      const invalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      const errorId = `${field.name}-error`
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={field.name}>
                            Project <span aria-hidden="true">*</span>
                          </FieldLabel>
                          <ResourceChooser
                            describedBy={errorId}
                            emptyLabel="Choose a project"
                            invalid={invalid}
                            kind="project"
                            onChange={(value) =>
                              field.handleChange(value ?? null)
                            }
                            triggerId={field.name}
                            value={field.state.value ?? undefined}
                          />
                          {invalid ? (
                            <FieldError
                              errors={field.state.meta.errors}
                              id={errorId}
                            />
                          ) : null}
                        </Field>
                      )
                    }}
                  </form.Field>
                  <form.Field name="visibility">
                    {(field) => {
                      const invalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      const descriptionId = `${field.name}-description`
                      const errorId = `${field.name}-error`
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={field.name}>
                            Visibility
                          </FieldLabel>
                          <NativeSelect
                            aria-describedby={`${descriptionId} ${errorId}`}
                            aria-errormessage={invalid ? errorId : undefined}
                            aria-invalid={invalid || undefined}
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(
                                event.target.value as SampleValues["visibility"]
                              )
                            }
                            value={field.state.value}
                          >
                            <NativeSelectOption value="private">
                              Private
                            </NativeSelectOption>
                            <NativeSelectOption value="public">
                              Public
                            </NativeSelectOption>
                          </NativeSelect>
                          <FieldDescription id={descriptionId}>
                            Public samples can be read outside their project
                            grants.
                          </FieldDescription>
                          <FieldError
                            errors={field.state.meta.errors}
                            id={errorId}
                          />
                        </Field>
                      )
                    }}
                  </form.Field>
                  <CreationFormSection title="Details">
                    <SampleTextField
                      fieldName="sample_type"
                      form={form}
                      label="Sample type"
                    />
                    <form.Field name="timestamp">
                      {(field) => {
                        const invalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        const errorId = `${field.name}-error`
                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel htmlFor={field.name}>
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
                    <form.Field name="description">
                      {(field) => {
                        const invalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        const errorId = `${field.name}-error`
                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel htmlFor={field.name}>
                              Description
                            </FieldLabel>
                            <Textarea
                              aria-describedby={errorId}
                              aria-errormessage={invalid ? errorId : undefined}
                              aria-invalid={invalid || undefined}
                              id={field.name}
                              maxLength={SAMPLE_DESCRIPTION_MAX_LENGTH}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              rows={4}
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
                  </CreationFormSection>
                  <CreationFormSection title="Relationships">
                    <form.Field name="relationships">
                      {(field) => (
                        <CreationRelationshipsField
                          disabled={busy || Boolean(createdSample)}
                          onChange={field.handleChange}
                          resourceKind="sample"
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
                {createdSample && relationships.failures.length ? (
                  <p className="text-destructive" role="alert">
                    The sample was created, but relationships with{" "}
                    {relationships.failures
                      .map((draft) => draft.target.name)
                      .join(", ")}{" "}
                    still need recovery.
                  </p>
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
              className="min-w-52"
              disabled={
                busy ||
                uncertainOutcome ||
                (Boolean(createdSample) && relationships.failures.length === 0)
              }
              form={formId}
              type="submit"
            >
              {createdSample
                ? relationships.failures.length
                  ? "Retry missing relationships"
                  : "Sample created"
                : uncertainOutcome
                  ? "Create sample"
                  : busy
                    ? "Creating sample"
                    : "Create sample"}
            </Button>
          </CardFooter>
        </Card>
      </ContentBoundary>
      <DiscardChangesDialog {...discard.dialog} />
    </PageLayout>
  )
}

function useSampleForm(
  initialProject: WorkspaceSearchResult | undefined,
  onSubmit: (value: SampleValues, form: AnyFormApi) => Promise<void>
) {
  return useForm({
    defaultValues: {
      description: "",
      project: initialProject ?? null,
      relationships: [] as CreationRelationshipDraft[],
      sample_name: "",
      sample_type: "",
      timestamp: "",
      visibility: "private" as SampleValues["visibility"],
    },
    validators: { onChange: sampleSchema },
    onSubmit: ({ formApi, value }) => onSubmit(value, formApi),
  })
}

function SampleTextField({
  autoFocus,
  fieldName,
  form,
  label,
  required = false,
}: {
  autoFocus?: boolean
  fieldName: "sample_name" | "sample_type"
  form: ReturnType<typeof useSampleForm>
  label: string
  required?: boolean
}) {
  return (
    <form.Field name={fieldName}>
      {(field) => {
        const invalid = field.state.meta.isTouched && !field.state.meta.isValid
        const errorId = `${field.name}-error`
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name}>
              {label} {required ? <span aria-hidden="true">*</span> : null}
            </FieldLabel>
            <Input
              aria-describedby={errorId}
              aria-errormessage={invalid ? errorId : undefined}
              aria-invalid={invalid || undefined}
              autoFocus={autoFocus}
              id={field.name}
              maxLength={
                fieldName === "sample_name"
                  ? SAMPLE_NAME_MAX_LENGTH
                  : SAMPLE_TYPE_MAX_LENGTH
              }
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
