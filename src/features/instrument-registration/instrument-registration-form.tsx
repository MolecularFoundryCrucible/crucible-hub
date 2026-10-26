import { useState } from "react"
import type { AnyFormApi } from "@tanstack/react-form"
import { useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import { FieldGroup } from "@/components/ui/field"
import { useAppForm } from "@/features/forms/app-form"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { createWorkspaceInstrument } from "@/data/crucible/instruments.functions"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import { instrumentIdSchema } from "@/data/crucible/slugs"
import { InstrumentIdField } from "@/features/forms/identifier-fields"
import { useSlugConflict } from "@/features/forms/slug-availability"
import { FormErrorRegion } from "@/components/crucible/form-error"
import { CreationFormActions } from "@/components/crucible/creation-form-actions"

const registrationSchema = z.object({
  description: z.string().trim().max(10_000, "Use 10,000 characters or fewer."),
  instrument_id: instrumentIdSchema,
  instrument_name: z
    .string()
    .trim()
    .min(1, "Enter an instrument name.")
    .max(255, "Use 255 characters or fewer."),
  instrument_type: z.string().trim().max(255, "Use 255 characters or fewer."),
  location: z
    .string()
    .trim()
    .min(1, "Enter a location.")
    .max(255, "Use 255 characters or fewer."),
  manufacturer: z.string().trim().max(255, "Use 255 characters or fewer."),
  model: z.string().trim().max(255, "Use 255 characters or fewer."),
  other_id: z.string().trim().max(255, "Use 255 characters or fewer."),
  other_id_source: z.string().trim().max(255, "Use 255 characters or fewer."),
})

type RegistrationValues = z.infer<typeof registrationSchema>

const defaultValues: RegistrationValues = {
  description: "",
  instrument_id: "",
  instrument_name: "",
  instrument_type: "",
  location: "",
  manufacturer: "",
  model: "",
  other_id: "",
  other_id_source: "",
}

function optionalValue(value: string) {
  return value || null
}

function registrationError(error: unknown) {
  return hubErrorMessage(
    error,
    "The instrument could not be registered. Your entries are still here."
  )
}

export function InstrumentRegistrationForm({
  scope,
}: {
  scope: IdentityScope
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string>()
  const instrumentIdConflict = useSlugConflict()
  const mutation = useMutation({
    mutationFn: async (value: RegistrationValues) =>
      unwrapHubResult(
        await createWorkspaceInstrument({
          data: {
            instrument: {
              description: optionalValue(value.description),
              instrument_id: value.instrument_id,
              instrument_name: value.instrument_name,
              instrument_type: optionalValue(value.instrument_type),
              location: value.location,
              manufacturer: optionalValue(value.manufacturer),
              model: optionalValue(value.model),
              other_id: optionalValue(value.other_id),
              other_id_source: optionalValue(value.other_id_source),
            },
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const form = useRegistrationForm(async (value, submittedForm) => {
    setSaveError(undefined)
    try {
      const resource = await mutation.mutateAsync(value)
      if (resource.kind !== "instrument") {
        throw new Error("The instrument registration response is invalid.")
      }
      const resourceQuery = resourceQueryOptions(scope, resource.unique_id)
      queryClient.setQueryData(resourceQuery.queryKey, resource)
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.instrumentLists(scope),
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.searches(scope),
      })
      submittedForm.reset(value)
      await navigate({
        params: { instrumentMfid: resource.unique_id },
        to: "/instruments/$instrumentMfid",
      })
    } catch (error) {
      if (
        error instanceof HubApiClientError &&
        error.details.kind === "conflict"
      ) {
        instrumentIdConflict.reject(value.instrument_id)
      }
      setSaveError(registrationError(error))
    }
  })
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const discard = useDiscardProtection(
    () => form.state.isDirty,
    () => {
      void navigate({ to: "/instruments" })
    },
    true
  )
  const formId = "instrument-registration"

  return (
    <PageLayout>
      <PageHeader title="Register instrument" />
      <ContentBoundary width="reading">
        <Card aria-busy={isSubmitting}>
          <CardHeader>
            <CardTitle>Instrument details</CardTitle>
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
                  <form.AppField name="instrument_name">
                    {(field) => (
                      <field.TextField
                        maxLength={255}
                        autoFocus
                        label="Name"
                        required
                      />
                    )}
                  </form.AppField>
                  <form.Field name="instrument_id">
                    {(field) => (
                      <InstrumentIdField
                        {...instrumentIdConflict.fieldProps}
                        field={field}
                        required
                        scenario={fixtureScenarioFromScope(scope)}
                      />
                    )}
                  </form.Field>
                  <form.AppField name="location">
                    {(field) => (
                      <field.TextField
                        maxLength={255}
                        label="Location"
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="instrument_type">
                    {(field) => (
                      <field.TextField
                        maxLength={255}
                        label="Instrument type"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="manufacturer">
                    {(field) => (
                      <field.TextField maxLength={255} label="Manufacturer" />
                    )}
                  </form.AppField>
                  <form.AppField name="model">
                    {(field) => (
                      <field.TextField maxLength={255} label="Model" />
                    )}
                  </form.AppField>
                  <form.AppField name="description">
                    {(field) => (
                      <field.TextAreaField
                        maxLength={10_000}
                        label="Description"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="other_id">
                    {(field) => (
                      <field.TextField maxLength={255} label="Other ID" />
                    )}
                  </form.AppField>
                  <form.AppField name="other_id_source">
                    {(field) => (
                      <field.TextField
                        maxLength={255}
                        label="Other ID source"
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </fieldset>
              <FormErrorRegion padded>
                {saveError ? <p>{saveError}</p> : null}
              </FormErrorRegion>
            </form>
          </CardContent>
          <form.Subscribe
            selector={(state) => [
              instrumentIdConflict.isTaken(state.values.instrument_id),
              state.isSubmitting,
            ]}
          >
            {([isTaken, submitting]) => (
              <CreationFormActions
                cancelDisabled={submitting}
                formId={formId}
                label={submitting ? "Registering" : "Register"}
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

function useRegistrationForm(
  onSubmit: (value: RegistrationValues, form: AnyFormApi) => Promise<void>
) {
  return useAppForm({
    defaultValues,
    validators: { onChange: registrationSchema },
    onSubmit: ({ formApi, value }) => onSubmit(value, formApi),
  })
}
