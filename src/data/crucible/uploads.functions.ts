import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import {
  MAX_PARTS_PER_SIGN_REQUEST,
  MAX_UPLOAD_PART_NUMBER,
  MAX_UPLOAD_SIZE,
  validateUploadFilename,
} from "./uploads"
import {
  abortWorkspaceUpload,
  completeWorkspaceUpload,
  initializeWorkspaceUploadSession,
  readWorkspaceUploadSession,
  signWorkspaceUploadParts,
} from "./uploads.server"

const datasetMfidSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)

const uploadIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)

const uploadFilenameSchema = z
  .string()
  .min(1)
  .max(1024)
  .superRefine((filename, ctx) => {
    for (const issue of validateUploadFilename(filename)) {
      ctx.addIssue({ code: "custom", message: issue })
    }
  })

const uploadSha256Schema = z.string().regex(/^[0-9a-f]{64}$/)

const uploadCrc32cSchema = z.string().regex(/^[A-Za-z0-9+/]{6}==$/)

const uploadPartsSchema = z
  .array(
    z.object({
      crc32cBase64: uploadCrc32cSchema,
      partNumber: z.number().int().min(1).max(MAX_UPLOAD_PART_NUMBER),
    })
  )
  .min(1)
  .max(MAX_PARTS_PER_SIGN_REQUEST)

export const initializeWorkspaceDatasetUpload = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        datasetMfid: datasetMfidSchema,
        filename: uploadFilenameSchema,
        idempotencyKey: z.string().uuid().optional(),
        scenario: fixtureScenarioSchema.optional(),
        size: z.number().int().min(1).max(MAX_UPLOAD_SIZE),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(
      context.correlationId,
      () =>
        initializeWorkspaceUploadSession(
          {
            datasetMfid: data.datasetMfid,
            filename: data.filename,
            idempotencyKey: data.idempotencyKey,
            size: data.size,
          },
          data.scenario,
          context.requestSignal
        ),
      { operation: "initialize-dataset-upload" }
    )
  })

export const signWorkspaceDatasetUploadParts = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        datasetMfid: datasetMfidSchema,
        parts: uploadPartsSchema,
        uploadId: uploadIdSchema,
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(
      context.correlationId,
      () =>
        signWorkspaceUploadParts(
          {
            datasetMfid: data.datasetMfid,
            parts: data.parts.map((part) => ({
              crc32cBase64: part.crc32cBase64,
              partNumber: part.partNumber,
            })),
            uploadId: data.uploadId,
          },
          context.requestSignal
        ),
      { operation: "sign-upload-parts" }
    )
  })

export const readWorkspaceDatasetUpload = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        datasetMfid: datasetMfidSchema,
        uploadId: uploadIdSchema,
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(
      context.correlationId,
      () =>
        readWorkspaceUploadSession(
          {
            datasetMfid: data.datasetMfid,
            uploadId: data.uploadId,
          },
          context.requestSignal
        ),
      { operation: "read-dataset-upload" }
    )
  })

export const completeWorkspaceDatasetUpload = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        crc32cBase64: uploadCrc32cSchema,
        datasetMfid: datasetMfidSchema,
        sha256Hex: uploadSha256Schema,
        uploadId: uploadIdSchema,
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(
      context.correlationId,
      () =>
        completeWorkspaceUpload(
          {
            crc32cBase64: data.crc32cBase64,
            datasetMfid: data.datasetMfid,
            sha256Hex: data.sha256Hex,
            uploadId: data.uploadId,
          },
          context.requestSignal
        ),
      { operation: "complete-dataset-upload" }
    )
  })

export const abortWorkspaceDatasetUpload = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        datasetMfid: datasetMfidSchema,
        uploadId: uploadIdSchema,
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(
      context.correlationId,
      () =>
        abortWorkspaceUpload(
          {
            datasetMfid: data.datasetMfid,
            uploadId: data.uploadId,
          },
          context.requestSignal
        ),
      { operation: "abort-dataset-upload" }
    )
  })
