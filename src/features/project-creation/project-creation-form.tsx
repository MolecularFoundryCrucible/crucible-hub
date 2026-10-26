import { useState } from "react"
import type { AnyFormApi } from "@tanstack/react-form"
import { useStore } from "@tanstack/react-form"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { personDisplayName } from "@/components/crucible/person-identity"
import { ResourceChooser } from "@/components/crucible/resource-chooser"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { fieldErrors, shouldShowFieldError } from "@/features/forms/field-state"
import { useAppForm } from "@/features/forms/app-form"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { createWorkspaceProject } from "@/data/crucible/creation.functions"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import { projectIdSchema } from "@/data/crucible/slugs"
import type {
  WorkspaceAccount,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import { ProjectIdField } from "@/features/forms/identifier-fields"
import { useSlugConflict } from "@/features/forms/slug-availability"
import { FormErrorRegion } from "@/components/crucible/form-error"
import { CreationFormActions } from "@/components/crucible/creation-form-actions"

const projectCreationSchema = z.object({
  organization: z
    .string()
    .trim()
    .min(1, "Enter an organization.")
    .max(255, "Use 255 characters or fewer."),
  project_id: projectIdSchema,
  project_lead: z.string().trim().min(1, "Choose a project lead."),
  title: z
    .string()
    .trim()
    .min(1, "Enter a project title.")
    .max(255, "Use 255 characters or fewer."),
})

type ProjectCreationValues = z.infer<typeof projectCreationSchema>

function accountAsSearchResult(
  account: WorkspaceAccount
): WorkspaceSearchResult {
  return {
    context: account.username ?? null,
    kind: "person",
    name: personDisplayName(account),
    unique_id: account.unique_id,
  }
}

function projectCreationError(error: unknown) {
  return hubErrorMessage(
    error,
    "The project could not be created. Your entries are still here."
  )
}

export function ProjectCreationForm({ scope }: { scope: IdentityScope }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const accountLead = accountAsSearchResult(account)
  const [selectedLead, setSelectedLead] = useState<
    WorkspaceSearchResult | undefined
  >(accountLead)
  const [saveError, setSaveError] = useState<string>()
  const projectIdConflict = useSlugConflict()
  const mutation = useMutation({
    mutationFn: async (value: ProjectCreationValues) =>
      unwrapHubResult(
        await createWorkspaceProject({
          data: {
            project: value,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const form = useProjectCreationForm(
    account.unique_id,
    async (value, submittedForm) => {
      setSaveError(undefined)
      try {
        const project = await mutation.mutateAsync(value)
        if (fixtureScenarioFromScope(scope)) {
          const projectQuery = projectQueryOptions(scope, project.unique_id)
          queryClient.setQueryData(projectQuery.queryKey, project)
        }
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.projectLists(scope),
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.searches(scope),
        })
        submittedForm.reset(value)
        await navigate({
          params: { projectMfid: project.unique_id },
          to: "/projects/$projectMfid",
        })
      } catch (error) {
        if (
          error instanceof HubApiClientError &&
          error.details.kind === "conflict"
        ) {
          projectIdConflict.reject(value.project_id)
        }
        setSaveError(projectCreationError(error))
      }
    }
  )
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(
    () => form.state.isDirty,
    () => {
      void navigate({ to: "/projects" })
    },
    true
  )
  const formId = "project-creation"

  return (
    <PageLayout>
      <PageHeader title="Create project" />
      <ContentBoundary width="reading">
        <Card aria-busy={isSubmitting}>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
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
              <fieldset disabled={isSubmitting}>
                <FieldGroup>
                  <form.AppField name="title">
                    {(field) => (
                      <field.TextField
                        maxLength={255}
                        autoFocus
                        label="Title"
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="organization">
                    {(field) => (
                      <field.TextField
                        maxLength={255}
                        label="Organization"
                        required
                      />
                    )}
                  </form.AppField>
                  <form.Field name="project_id">
                    {(field) => (
                      <ProjectIdField
                        {...projectIdConflict.fieldProps}
                        field={field}
                        required
                        scenario={fixtureScenarioFromScope(scope)}
                      />
                    )}
                  </form.Field>
                  <form.Field name="project_lead">
                    {(field) => {
                      const invalid = shouldShowFieldError(field)
                      const errorId = `${formId}-${field.name}-error`
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={field.name} required>
                            Project lead
                          </FieldLabel>
                          <ResourceChooser
                            describedBy={invalid ? errorId : undefined}
                            emptyLabel="Choose a project lead"
                            excludeServiceAccounts
                            invalid={invalid}
                            kind="person"
                            onChange={(value) => {
                              setSelectedLead(value)
                              field.handleChange(value?.unique_id ?? "")
                            }}
                            triggerId={field.name}
                            value={selectedLead}
                          />
                          <FieldError
                            errors={fieldErrors(field)}
                            id={errorId}
                          />
                        </Field>
                      )
                    }}
                  </form.Field>
                </FieldGroup>
              </fieldset>
              <FormErrorRegion padded>
                {saveError ? <p>{saveError}</p> : null}
              </FormErrorRegion>
            </form>
          </CardContent>
          <form.Subscribe
            selector={(state) => [
              projectIdConflict.isTaken(state.values.project_id),
              state.isSubmitting,
            ]}
          >
            {([isTaken, submitting]) => (
              <CreationFormActions
                cancelDisabled={submitting}
                formId={formId}
                label={submitting ? "Creating" : "Create"}
                onCancel={discard.requestCancel}
                pending={submitting}
                submitDisabled={isTaken || submitting}
              />
            )}
          </form.Subscribe>
        </Card>
      </ContentBoundary>
      <DiscardChangesDialog {...discard.dialog} />
    </PageLayout>
  )
}

function useProjectCreationForm(
  accountId: string,
  onSubmit: (value: ProjectCreationValues, form: AnyFormApi) => Promise<void>
) {
  return useAppForm({
    defaultValues: {
      organization: "",
      project_id: "",
      project_lead: accountId,
      title: "",
    } satisfies ProjectCreationValues,
    validators: { onChange: projectCreationSchema },
    onSubmit: ({ formApi, value }) => onSubmit(value, formApi),
  })
}
