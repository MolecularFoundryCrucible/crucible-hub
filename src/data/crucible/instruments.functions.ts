import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"
import {
  collectionAffiliationSchema,
  collectionCursorSchema,
} from "./collection-query"

import {
  addWorkspaceInstrumentOperator as addWorkspaceInstrumentOperatorServer,
  createWorkspaceInstrumentResource,
  patchWorkspaceInstrument,
  readWorkspaceInstrumentOperators,
  readWorkspaceInstruments,
  removeWorkspaceInstrumentOperator as removeWorkspaceInstrumentOperatorServer,
  setWorkspaceInstrumentStatus,
} from "./instruments.server"
import { instrumentStatuses } from "./instrument-status"
import { queryCancellationMiddleware } from "./query-cancellation"
import { fixtureScenarioSchema } from "./fixture-scenarios"

export const instrumentListInputSchema = z.object({
  affiliation: collectionAffiliationSchema.optional(),
  cursor: collectionCursorSchema,
  limit: z.number().int().min(1).max(100),
  scenario: fixtureScenarioSchema.optional(),
  status: z.enum(instrumentStatuses).optional(),
})

export const INSTRUMENT_MFID_MAX_LENGTH = 255
export const INSTRUMENT_NAME_MAX_LENGTH = 255
export const INSTRUMENT_TYPE_MAX_LENGTH = 255
export const INSTRUMENT_DESCRIPTION_MAX_LENGTH = 10_000
export const INSTRUMENT_LOCATION_MAX_LENGTH = 255
export const INSTRUMENT_MANUFACTURER_MAX_LENGTH = 255
export const INSTRUMENT_MODEL_MAX_LENGTH = 255
export const INSTRUMENT_OTHER_ID_MAX_LENGTH = 255
export const INSTRUMENT_OTHER_ID_SOURCE_MAX_LENGTH = 255

const canonicalInstrumentMfidSchema = z
  .string()
  .trim()
  .min(1)
  .max(INSTRUMENT_MFID_MAX_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/)

const instrumentNameChangeSchema = z
  .string()
  .trim()
  .min(1)
  .max(INSTRUMENT_NAME_MAX_LENGTH)

const instrumentLocationChangeSchema = z
  .string()
  .trim()
  .min(1)
  .max(INSTRUMENT_LOCATION_MAX_LENGTH)

const nullableInstrumentTextChangeSchema = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).nullable().optional()

const instrumentRegistrationIdSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]{2,24}$/,
    "Use 3 to 25 letters, numbers, underscores, or hyphens."
  )

function hasDefinedChange(changes: Record<string, unknown>) {
  return Object.values(changes).some((value) => value !== undefined)
}

export const instrumentDescriptiveUpdateInputSchema = z
  .object({
    changes: z
      .object({
        description: nullableInstrumentTextChangeSchema(
          INSTRUMENT_DESCRIPTION_MAX_LENGTH
        ),
        instrument_name: instrumentNameChangeSchema.optional(),
        instrument_type: nullableInstrumentTextChangeSchema(
          INSTRUMENT_TYPE_MAX_LENGTH
        ),
        location: instrumentLocationChangeSchema.optional(),
        manufacturer: nullableInstrumentTextChangeSchema(
          INSTRUMENT_MANUFACTURER_MAX_LENGTH
        ),
        model: nullableInstrumentTextChangeSchema(INSTRUMENT_MODEL_MAX_LENGTH),
        other_id: nullableInstrumentTextChangeSchema(
          INSTRUMENT_OTHER_ID_MAX_LENGTH
        ),
        other_id_source: nullableInstrumentTextChangeSchema(
          INSTRUMENT_OTHER_ID_SOURCE_MAX_LENGTH
        ),
      })
      .strict()
      .refine(hasDefinedChange, "At least one instrument change is required."),
    instrumentMfid: canonicalInstrumentMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const instrumentLifecycleUpdateInputSchema = z
  .object({
    instrumentMfid: canonicalInstrumentMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
    status: z.enum(instrumentStatuses),
  })
  .strict()

const instrumentOperatorInputSchema = z
  .object({
    instrumentMfid: canonicalInstrumentMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
    serviceAccountId: canonicalInstrumentMfidSchema,
  })
  .strict()

export const instrumentOperatorsInputSchema = z
  .object({
    instrumentMfid: canonicalInstrumentMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const instrumentCreateInputSchema = z
  .object({
    instrument: z
      .object({
        description: nullableInstrumentTextChangeSchema(
          INSTRUMENT_DESCRIPTION_MAX_LENGTH
        ),
        instrument_id: instrumentRegistrationIdSchema,
        instrument_name: instrumentNameChangeSchema,
        instrument_type: nullableInstrumentTextChangeSchema(
          INSTRUMENT_TYPE_MAX_LENGTH
        ),
        location: instrumentLocationChangeSchema,
        manufacturer: nullableInstrumentTextChangeSchema(
          INSTRUMENT_MANUFACTURER_MAX_LENGTH
        ),
        model: nullableInstrumentTextChangeSchema(INSTRUMENT_MODEL_MAX_LENGTH),
        other_id: nullableInstrumentTextChangeSchema(
          INSTRUMENT_OTHER_ID_MAX_LENGTH
        ),
        other_id_source: nullableInstrumentTextChangeSchema(
          INSTRUMENT_OTHER_ID_SOURCE_MAX_LENGTH
        ),
      })
      .strict(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const getWorkspaceInstruments = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(instrumentListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceInstruments(data, context.requestSignal)
    )
  })

export const getWorkspaceInstrumentOperators = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(instrumentOperatorsInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceInstrumentOperators(
        data.instrumentMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const addWorkspaceInstrumentOperator = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(instrumentOperatorInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      addWorkspaceInstrumentOperatorServer(
        data.instrumentMfid,
        data.serviceAccountId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const removeWorkspaceInstrumentOperator = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(instrumentOperatorInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      removeWorkspaceInstrumentOperatorServer(
        data.instrumentMfid,
        data.serviceAccountId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceInstrument = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(instrumentCreateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceInstrumentResource(
        data.instrument,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceInstrument = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(instrumentDescriptiveUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceInstrument(
        data.instrumentMfid,
        data.changes,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceInstrumentStatus = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(instrumentLifecycleUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      setWorkspaceInstrumentStatus(
        data.instrumentMfid,
        data.status,
        data.scenario,
        context.requestSignal
      )
    )
  })
