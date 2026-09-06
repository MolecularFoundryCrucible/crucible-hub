import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  patchWorkspaceInstrument,
  readWorkspaceInstruments,
} from "./instruments.server"
import { queryCancellationMiddleware } from "./query-cancellation"
import { fixtureScenarioSchema } from "./fixture-scenarios"

export const instrumentListInputSchema = z.object({
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().min(0),
  scenario: fixtureScenarioSchema.optional(),
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

export const getWorkspaceInstruments = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(instrumentListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceInstruments(data, context.requestSignal)
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
