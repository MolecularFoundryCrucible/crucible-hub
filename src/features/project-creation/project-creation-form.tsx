import { useState } from "react"
import type { AnyFormApi } from "@tanstack/react-form"
import { useForm, useStore } from "@tanstack/react-form"
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
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { createWorkspaceProject } from "@/data/crucible/creation.functions"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceAccount,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

const projectIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,24}$/
const reservedProjectIds = new Set(["admin", "public", "read_only"])

const projectCreationSchema = z.object({
  organization: z
    .string()
    .trim()
    .min(1, "Enter an organization.")
    .max(255, "Use 255 characters or fewer."),
  project_id: z
    .string()
    .trim()
    .regex(
      projectIdPattern,
      "Use 3 to 25 letters, numbers, underscores, or hyphens, starting with a letter or number."
    )
    .refine(
      (value) => !reservedProjectIds.has(value.toLocaleLowerCase()),
      "This project ID is reserved."
    ),
  project_lead: z.string().trim().min(1, "Choose a project lead."),
  title: z
    .string()
    .trim()
    .min(1, "Enter a project title.")
    .max(255, "Use 255 characters or fewer."),
})

type ProjectCreationValues = z.infer<typeof projectCreationSchema>
type ProjectCreationForm = ReturnType<typeof useProjectCreationForm>

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
                  <ProjectTextField
                    autoFocus
                    fieldName="title"
                    form={form}
                    label="Title"
                    required
                  />
                  <ProjectTextField
                    fieldName="organization"
                    form={form}
                    label="Organization"
                    required
                  />
                  <ProjectTextField
                    description="Used to identify this project in integrations."
                    fieldName="project_id"
                    form={form}
                    label="Project ID"
                    required
                  />
                  <form.Field name="project_lead">
                    {(field) => {
                      const invalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      const descriptionId = `${formId}-${field.name}-description`
                      const errorId = `${formId}-${field.name}-error`
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={field.name}>
                            Project lead
                          </FieldLabel>
                          <ResourceChooser
                            describedBy={`${descriptionId} ${errorId}`}
                            emptyLabel="Choose a project lead"
                            invalid={invalid}
                            kind="person"
                            onChange={(value) => {
                              setSelectedLead(value)
                              field.handleChange(value?.unique_id ?? "")
                            }}
                            triggerId={field.name}
                            value={selectedLead}
                          />
                          <FieldDescription id={descriptionId}>
                            Your account is selected by default.
                          </FieldDescription>
                          <FieldError
                            errors={field.state.meta.errors}
                            id={errorId}
                          />
                        </Field>
                      )
                    }}
                  </form.Field>
                </FieldGroup>
              </fieldset>
              <div aria-live="polite" className="min-h-5 pt-5 text-body">
                {saveError ? (
                  <p className="text-destructive" role="alert">
                    {saveError}
                  </p>
                ) : null}
              </div>
            </form>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              disabled={isSubmitting}
              onClick={discard.requestCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="w-40"
              disabled={isSubmitting}
              form={formId}
              type="submit"
            >
              <span className="inline-grid min-w-28 place-items-center">
                {isSubmitting ? "Creating project" : "Create project"}
              </span>
            </Button>
          </CardFooter>
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
  return useForm({
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

function ProjectTextField({
  autoFocus = false,
  description,
  fieldName,
  form,
  label,
  required = false,
}: {
  autoFocus?: boolean
  description?: string
  fieldName: "organization" | "project_id" | "title"
  form: ProjectCreationForm
  label: string
  required?: boolean
}) {
  return (
    <form.Field name={fieldName}>
      {(field) => {
        const invalid = field.state.meta.isTouched && !field.state.meta.isValid
        const descriptionId = `project-creation-${field.name}-description`
        const errorId = `project-creation-${field.name}-error`
        const hasDescription = Boolean(description)
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name} optional={!required}>
              {label}
            </FieldLabel>
            <Input
              aria-describedby={
                hasDescription ? `${descriptionId} ${errorId}` : errorId
              }
              aria-errormessage={invalid ? errorId : undefined}
              aria-invalid={invalid || undefined}
              autoFocus={autoFocus}
              id={field.name}
              maxLength={fieldName === "project_id" ? 25 : 255}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required={required}
              value={field.state.value}
            />
            {description ? (
              <FieldDescription id={descriptionId}>
                {description}
              </FieldDescription>
            ) : null}
            <FieldError errors={field.state.meta.errors} id={errorId} />
          </Field>
        )
      }}
    </form.Field>
  )
}
