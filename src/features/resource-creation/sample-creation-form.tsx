import type { AnyFormApi } from "@tanstack/react-form"
import { useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import {
  ContentBoundary,
  ContentGrid,
} from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceChooser } from "@/components/crucible/resource-chooser"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { fieldErrors, shouldShowFieldError } from "@/features/forms/field-state"
import { useAppForm } from "@/features/forms/app-form"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
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
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"
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
import { useStagedCreation } from "./creation-submission"
import { FormErrorRegion } from "@/components/crucible/form-error"
import { CreationFormActions } from "@/components/crucible/creation-form-actions"
import {
  CreationMetadataCard,
  creationMetadataSchema,
  emptyCreationMetadata,
  useCreationMetadataSubmission,
} from "./creation-metadata"
import { FacetCombobox } from "@/components/crucible/facet-combobox"

const sampleSchema = z.object({
  description: z
    .string()
    .trim()
    .max(
      SAMPLE_DESCRIPTION_MAX_LENGTH,
      `Use ${SAMPLE_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters or fewer.`
    ),
  project: workspaceSelectionOf("project").nullable(),
  metadata: creationMetadataSchema,
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
  const mutation = useMutation({
    mutationFn: async (value: SampleValues) =>
      unwrapHubResult(
        await createWorkspaceSample({
          data: {
            sample: {
              description: optionalValue(value.description),
              projectMfid: value.project?.unique_id ?? null,
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
  const metadata = useCreationMetadataSubmission({
    resourceKind: "sample",
    scope,
  })
  const relationships = useCreationRelationshipSubmission({
    onApplied: (resource) => {
      if (resource.kind === "sample") setCreated(resource)
    },
    resourceKind: "sample",
    scope,
  })
  const {
    created: createdSample,
    saveError,
    setCreated,
    submit,
    uncertainOutcome,
  } = useStagedCreation<SampleValues>({
    create: (value) => mutation.mutateAsync(value),
    kind: "sample",
    onCreated: (resource) => {
      if (resource.kind !== "sample") return
      queryClient.setQueryData(
        resourceQueryOptions(scope, resource.unique_id).queryKey,
        resource
      )
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.sampleLists(scope),
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.searches(scope),
      })
    },
    metadata,
    relationships,
  })
  const form = useSampleForm(initialProject, async (value) => {
    await submit(value, async (resource) => {
      await navigate({
        params: { sampleMfid: resource.unique_id },
        to: "/samples/$sampleMfid",
      })
    })
  })
  useCreationTimestampDefault(form)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const busy =
    isSubmitting ||
    mutation.isPending ||
    metadata.isPending ||
    relationships.isPending
  const incompleteStages = metadata.failed || relationships.failures.length > 0
  const discard = useDiscardProtection(
    () => form.state.isDirty && !createdSample,
    () => {
      void navigate({ to: "/data" })
    },
    true
  )
  const formId = "sample-creation"
  const projectMfid = useStore(
    form.store,
    (state) => state.values.project?.unique_id
  )
  const formDisabled = busy || Boolean(createdSample)

  return (
    <PageLayout>
      <PageHeader title="Create sample" />
      <ContentBoundary>
        <ContentGrid variant="split">
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
                <fieldset disabled={formDisabled}>
                  <FieldGroup>
                    <form.AppField name="sample_name">
                      {(field) => (
                        <field.TextField
                          label="Name"
                          required
                          autoFocus
                          maxLength={SAMPLE_NAME_MAX_LENGTH}
                        />
                      )}
                    </form.AppField>
                    <form.Field name="project">
                      {(field) => {
                        const invalid = shouldShowFieldError(field)
                        const errorId = `${field.name}-error`
                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel htmlFor={field.name} optional>
                              Project
                            </FieldLabel>
                            <ResourceChooser
                              describedBy={invalid ? errorId : undefined}
                              emptyLabel="Choose a project"
                              invalid={invalid}
                              kind="project"
                              onChange={(value) =>
                                field.handleChange(value ?? null)
                              }
                              triggerId={field.name}
                              value={field.state.value ?? undefined}
                            />
                            <FieldError
                              errors={fieldErrors(field)}
                              id={errorId}
                            />
                          </Field>
                        )
                      }}
                    </form.Field>
                    <form.Field name="visibility">
                      {(field) => {
                        const invalid = shouldShowFieldError(field)
                        const errorId = `${field.name}-error`
                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel htmlFor={field.name} required>
                              Visibility
                            </FieldLabel>
                            <NativeSelect
                              aria-describedby={invalid ? errorId : undefined}
                              aria-errormessage={invalid ? errorId : undefined}
                              aria-invalid={invalid || undefined}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(
                                  event.target
                                    .value as SampleValues["visibility"]
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
                            <FieldError
                              errors={fieldErrors(field)}
                              id={errorId}
                            />
                          </Field>
                        )
                      }}
                    </form.Field>
                    <CreationFormSection title="Details">
                      <form.Field name="sample_type">
                        {(field) => {
                          const invalid = shouldShowFieldError(field)
                          const errorId = `${field.name}-error`
                          return (
                            <Field data-invalid={invalid}>
                              <FieldLabel htmlFor={field.name} optional>
                                Sample type
                              </FieldLabel>
                              <FacetCombobox
                                describedBy={invalid ? errorId : undefined}
                                disabled={formDisabled}
                                errorId={invalid ? errorId : undefined}
                                field="sample_type"
                                id={field.name}
                                invalid={invalid}
                                kind="sample"
                                label="Sample type"
                                maxLength={SAMPLE_TYPE_MAX_LENGTH}
                                name={field.name}
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                projectMfid={projectMfid}
                                scope={scope}
                                value={field.state.value}
                              />
                              <FieldError
                                errors={fieldErrors(field)}
                                id={errorId}
                              />
                            </Field>
                          )
                        }}
                      </form.Field>
                      <form.AppField name="timestamp">
                        {(field) => (
                          <field.TextField
                            label="Local date and time"
                            required
                            type="datetime-local"
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="description">
                        {(field) => (
                          <field.TextAreaField
                            label="Description"
                            maxLength={SAMPLE_DESCRIPTION_MAX_LENGTH}
                            rows={4}
                          />
                        )}
                      </form.AppField>
                    </CreationFormSection>
                  </FieldGroup>
                </fieldset>
                <FormErrorRegion padded>
                  {saveError ? <p>{saveError}</p> : null}
                  {createdSample && incompleteStages ? (
                    <p>
                      The sample was created, but{" "}
                      {[
                        metadata.failed ? "scientific metadata" : null,
                        relationships.failures.length
                          ? `relationships with ${relationships.failures
                              .map((draft) => draft.target.name)
                              .join(", ")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" and ")}{" "}
                      still need recovery.
                    </p>
                  ) : null}
                </FormErrorRegion>
              </form>
            </CardContent>
            <CreationFormActions
              cancelDisabled={busy}
              formId={formId}
              label={
                createdSample
                  ? incompleteStages
                    ? "Retry missing stages"
                    : "Created"
                  : busy
                    ? "Creating"
                    : "Create"
              }
              onCancel={discard.requestCancel}
              pending={busy}
              submitDisabled={
                busy ||
                uncertainOutcome ||
                (Boolean(createdSample) && !incompleteStages)
              }
            />
          </Card>
          <div className="flex min-w-0 flex-col gap-page-section">
            <Card aria-busy={busy}>
              <CardHeader>
                <CardTitle>Relationships</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
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
              </CardContent>
            </Card>
            <form.Field name="metadata">
              {(field) => (
                <CreationMetadataCard
                  busy={busy}
                  disabled={busy || Boolean(createdSample)}
                  errors={fieldErrors(field)}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </div>
        </ContentGrid>
      </ContentBoundary>
      <DiscardChangesDialog {...discard.dialog} />
    </PageLayout>
  )
}

function useSampleForm(
  initialProject: WorkspaceSearchResult | undefined,
  onSubmit: (value: SampleValues, form: AnyFormApi) => Promise<void>
) {
  return useAppForm({
    defaultValues: {
      description: "",
      project: initialProject ?? null,
      metadata: emptyCreationMetadata(),
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
