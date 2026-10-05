import { useState } from "react"
import type { AnyFormApi } from "@tanstack/react-form"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
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
import { Textarea } from "@/components/ui/textarea"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  checkWorkspaceInstrumentId,
  createWorkspaceInstrument,
} from "@/data/crucible/instruments.functions"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import {
  INSTRUMENT_ID_MAX_LENGTH,
  instrumentIdSchema,
} from "@/data/crucible/slugs"
import {
  SlugAvailabilityField,
  isSlugTakenOrRejected,
} from "@/features/forms/slug-availability"

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
  const [liveTakenInstrumentId, setLiveTakenInstrumentId] = useState<string>()
  const [rejectedInstrumentId, setRejectedInstrumentId] = useState<string>()
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
        setRejectedInstrumentId(value.instrument_id)
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
                  <RegistrationTextField
                    autoFocus
                    fieldName="instrument_name"
                    form={form}
                    label="Name"
                    required
                  />
                  <form.Field name="instrument_id">
                    {(field) => (
                      <SlugAvailabilityField
                        checkAvailability={async (candidate, signal) => {
                          const result = await checkWorkspaceInstrumentId({
                            data: {
                              instrumentId: candidate,
                              scenario: fixtureScenarioFromScope(scope),
                            },
                            signal,
                          })
                          return unwrapHubResult(result)
                        }}
                        description="Used in links and integrations."
                        entityLabel="Instrument ID"
                        field={field}
                        label="Instrument ID"
                        maxLength={INSTRUMENT_ID_MAX_LENGTH}
                        onLiveTakenChange={setLiveTakenInstrumentId}
                        rejectedValue={rejectedInstrumentId}
                        required
                        schema={instrumentIdSchema}
                      />
                    )}
                  </form.Field>
                  <RegistrationTextField
                    fieldName="location"
                    form={form}
                    label="Location"
                    required
                  />
                  <RegistrationTextField
                    fieldName="instrument_type"
                    form={form}
                    label="Instrument type"
                  />
                  <RegistrationTextField
                    fieldName="manufacturer"
                    form={form}
                    label="Manufacturer"
                  />
                  <RegistrationTextField
                    fieldName="model"
                    form={form}
                    label="Model"
                  />
                  <RegistrationTextAreaField
                    fieldName="description"
                    form={form}
                    label="Description"
                  />
                  <RegistrationTextField
                    fieldName="other_id"
                    form={form}
                    label="Other ID"
                  />
                  <RegistrationTextField
                    fieldName="other_id_source"
                    form={form}
                    label="Other ID source"
                  />
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
            <form.Subscribe
              selector={(state) => [
                isSlugTakenOrRejected(
                  state.values.instrument_id,
                  liveTakenInstrumentId,
                  rejectedInstrumentId
                ),
                state.isSubmitting,
              ]}
            >
              {([isTaken, submitting]) => (
                <Button
                  className="w-40"
                  disabled={isTaken || submitting}
                  form={formId}
                  type="submit"
                >
                  <span className="inline-grid min-w-28 place-items-center">
                    {submitting
                      ? "Registering instrument"
                      : "Register instrument"}
                  </span>
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </Card>
      </ContentBoundary>
      <DiscardChangesDialog {...discard.dialog} />
    </PageLayout>
  )
}

function useRegistrationForm(
  onSubmit: (value: RegistrationValues, form: AnyFormApi) => Promise<void>
) {
  return useForm({
    defaultValues,
    validators: { onChange: registrationSchema },
    onSubmit: ({ formApi, value }) => onSubmit(value, formApi),
  })
}

type RegistrationForm = ReturnType<typeof useRegistrationForm>

function RegistrationTextField({
  autoFocus = false,
  description,
  fieldName,
  form,
  label,
  required = false,
}: {
  autoFocus?: boolean
  description?: string
  fieldName: keyof RegistrationValues
  form: RegistrationForm
  label: string
  required?: boolean
}) {
  return (
    <form.Field name={fieldName}>
      {(field) => {
        const invalid = !field.state.meta.isValid
        const descriptionId = `instrument-registration-${field.name}-description`
        const errorId = `instrument-registration-${field.name}-error`
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
              maxLength={fieldName === "description" ? 10_000 : 255}
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

function RegistrationTextAreaField({
  fieldName,
  form,
  label,
}: {
  fieldName: "description"
  form: RegistrationForm
  label: string
}) {
  return (
    <form.Field name={fieldName}>
      {(field) => {
        const invalid = !field.state.meta.isValid
        const errorId = `instrument-registration-${field.name}-error`
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name} optional>
              {label}
            </FieldLabel>
            <Textarea
              aria-describedby={errorId}
              aria-errormessage={invalid ? errorId : undefined}
              aria-invalid={invalid || undefined}
              id={field.name}
              maxLength={10_000}
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
