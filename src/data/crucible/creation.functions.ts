import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  createWorkspaceDatasetResource,
  createWorkspaceProjectResource,
  createWorkspaceSampleResource,
} from "./creation.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import {
  DATASET_DATA_FORMAT_MAX_LENGTH,
  DATASET_DATA_TYPE_MAX_LENGTH,
  DATASET_MEASUREMENT_MAX_LENGTH,
  DATASET_NAME_MAX_LENGTH,
  DATASET_SESSION_NAME_MAX_LENGTH,
  SAMPLE_DESCRIPTION_MAX_LENGTH,
  SAMPLE_NAME_MAX_LENGTH,
  SAMPLE_TYPE_MAX_LENGTH,
} from "./resources.functions"

export const PROJECT_ID_MAX_LENGTH = 25
export const PROJECT_TEXT_MAX_LENGTH = 255

const selectedResourceMfidSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)

const nullableTextSchema = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).nullable()

const timestampSchema = z.string().datetime({ offset: true }).nullable()

export const projectCreateInputSchema = z
  .object({
    project: z
      .object({
        organization: z.string().trim().min(1).max(PROJECT_TEXT_MAX_LENGTH),
        project_id: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,24}$/)
          .refine(
            (value) =>
              !["admin", "public", "read_only"].includes(
                value.toLocaleLowerCase()
              ),
            "This project ID is reserved."
          ),
        project_lead: z.string().trim().min(1).max(PROJECT_TEXT_MAX_LENGTH),
        title: z.string().trim().min(1).max(PROJECT_TEXT_MAX_LENGTH),
      })
      .strict(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const sampleCreateInputSchema = z
  .object({
    sample: z
      .object({
        description: nullableTextSchema(SAMPLE_DESCRIPTION_MAX_LENGTH),
        projectMfid: selectedResourceMfidSchema,
        public: z.boolean(),
        sample_name: z.string().trim().min(1).max(SAMPLE_NAME_MAX_LENGTH),
        sample_type: nullableTextSchema(SAMPLE_TYPE_MAX_LENGTH),
        timestamp: timestampSchema,
      })
      .strict(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const datasetCreateInputSchema = z
  .object({
    dataset: z
      .object({
        data_format: nullableTextSchema(DATASET_DATA_FORMAT_MAX_LENGTH),
        data_type: nullableTextSchema(DATASET_DATA_TYPE_MAX_LENGTH),
        dataset_name: z.string().trim().min(1).max(DATASET_NAME_MAX_LENGTH),
        instrumentMfid: selectedResourceMfidSchema.nullable(),
        measurement: nullableTextSchema(DATASET_MEASUREMENT_MAX_LENGTH),
        projectMfid: selectedResourceMfidSchema,
        public: z.boolean(),
        session_name: nullableTextSchema(DATASET_SESSION_NAME_MAX_LENGTH),
        timestamp: timestampSchema,
      })
      .strict(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const createWorkspaceProject = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(projectCreateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceProjectResource(
        data.project,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceSample = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(sampleCreateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceSampleResource(
        data.sample,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceDataset = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(datasetCreateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceDatasetResource(
        data.dataset,
        data.scenario,
        context.requestSignal
      )
    )
  })
