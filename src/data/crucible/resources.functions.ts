import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  createWorkspaceFileDownload,
  mutateWorkspaceDatasetThumbnails,
  mutateWorkspaceRelationship,
  requestWorkspaceFileIngestion,
  requestWorkspaceResourceDeletion,
  setWorkspaceDatasetInstrument,
  patchWorkspaceDatasetDescription,
  patchWorkspaceSampleDescription,
  reassignWorkspaceResourceProject,
  readWorkspaceDatasetFiles,
  readWorkspaceDatasetIngestionRequests,
  readWorkspaceDatasetThumbnailPreviews,
  readWorkspaceDatasetThumbnails,
  readWorkspaceIngestionClasses,
  readWorkspaceResource,
  readWorkspaceResourceGraph,
  transferWorkspaceResourceOwnership,
  writeWorkspaceResourceMetadata,
} from "./resources.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import type {
  WorkspaceDatasetThumbnailOperation,
  WorkspaceRelationshipOperation,
  WorkspaceScientificMetadata,
} from "./workspace-source"

export const resourceMfidInputSchema = z.object({
  resourceMfid: z.string().trim().min(1).max(255),
  scenario: fixtureScenarioSchema.optional(),
})

const resourceReadInputSchema = resourceMfidInputSchema.extend({
  projection: z.enum(["overview", "summary"]),
})

export const datasetFilesInputSchema = z.object({
  datasetMfid: z.string().trim().min(1).max(255),
  scenario: fixtureScenarioSchema.optional(),
})

export const THUMBNAIL_NAME_MAX_LENGTH = 255
export const THUMBNAIL_SOURCE_MAX_BYTES = 50 * 1024 * 1024
export const THUMBNAIL_SOURCE_MAX_ENCODED_CHARACTERS =
  4 * Math.ceil(THUMBNAIL_SOURCE_MAX_BYTES / 3)
export const THUMBNAIL_PREVIEW_BATCH_MAX = 100

const thumbnailNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(THUMBNAIL_NAME_MAX_LENGTH)

const thumbnailBase64Schema = z
  .string()
  .min(1)
  .max(THUMBNAIL_SOURCE_MAX_ENCODED_CHARACTERS)

export const datasetThumbnailPreviewsInputSchema = z
  .object({
    datasetMfids: z
      .array(z.string().trim().min(1).max(255))
      .max(THUMBNAIL_PREVIEW_BATCH_MAX),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const datasetThumbnailOperationInputSchema = z.discriminatedUnion(
  "action",
  [
    z
      .object({
        action: z.literal("add"),
        datasetMfid: z.string().trim().min(1).max(255),
        scenario: fixtureScenarioSchema.optional(),
        thumbnail_b64str: thumbnailBase64Schema,
        thumbnail_name: thumbnailNameSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("rename"),
        datasetMfid: z.string().trim().min(1).max(255),
        scenario: fixtureScenarioSchema.optional(),
        thumbnailId: z.number().int().positive(),
        thumbnail_name: thumbnailNameSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("delete"),
        datasetMfid: z.string().trim().min(1).max(255),
        scenario: fixtureScenarioSchema.optional(),
        thumbnailId: z.number().int().positive(),
      })
      .strict(),
  ]
)

export const fileDownloadInputSchema = z
  .object({
    fileMfid: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9_-]+$/),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const ingestionClassesInputSchema = z
  .object({ scenario: fixtureScenarioSchema.optional() })
  .strict()

export const fileIngestionInputSchema = z
  .object({
    fileMfid: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9_-]+$/),
    ingestionClass: z.string().trim().min(1).max(255).optional(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const RESOURCE_MFID_MAX_LENGTH = 255
export const SAMPLE_NAME_MAX_LENGTH = 255
export const SAMPLE_TYPE_MAX_LENGTH = 255
export const SAMPLE_DESCRIPTION_MAX_LENGTH = 10_000
export const DATASET_NAME_MAX_LENGTH = 255
export const DATASET_MEASUREMENT_MAX_LENGTH = 255
export const DATASET_DATA_FORMAT_MAX_LENGTH = 255
export const DATASET_DATA_TYPE_MAX_LENGTH = 255
export const DATASET_SESSION_NAME_MAX_LENGTH = 255
export const SCIENTIFIC_METADATA_KEY_MAX_LENGTH = 1024
export const SCIENTIFIC_METADATA_MAX_DEPTH = 64
export const SCIENTIFIC_METADATA_MAX_FIELDS = 10_000
export const SCIENTIFIC_METADATA_MAX_SERIALIZED_BYTES = 1_048_576

const canonicalResourceMfidSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESOURCE_MFID_MAX_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/)

export function scientificMetadataValidationError(
  value: unknown
): string | null {
  const ancestors = new Set<object>()
  let fields = 0

  function visit(current: unknown, depth: number): string | null {
    if (
      current === null ||
      typeof current === "boolean" ||
      typeof current === "string"
    ) {
      return null
    }
    if (typeof current === "number") {
      return Number.isFinite(current)
        ? null
        : "Metadata numbers must be finite."
    }
    if (typeof current !== "object") {
      return "Metadata values must be JSON-safe."
    }
    if (depth > SCIENTIFIC_METADATA_MAX_DEPTH) {
      return `Metadata nesting cannot exceed ${SCIENTIFIC_METADATA_MAX_DEPTH} levels.`
    }
    if (ancestors.has(current)) {
      return "Metadata cannot contain circular references."
    }
    if (
      !Array.isArray(current) &&
      Object.getPrototypeOf(current) !== Object.prototype &&
      Object.getPrototypeOf(current) !== null
    ) {
      return "Metadata objects must be plain JSON objects."
    }

    ancestors.add(current)
    if (Array.isArray(current)) {
      for (const nested of current) {
        const error = visit(nested, depth + 1)
        if (error) {
          ancestors.delete(current)
          return error
        }
      }
    } else {
      for (const [key, nested] of Object.entries(current)) {
        if (key.trim().length === 0) {
          ancestors.delete(current)
          return "Metadata keys must not be blank."
        }
        if (key.length > SCIENTIFIC_METADATA_KEY_MAX_LENGTH) {
          ancestors.delete(current)
          return `Metadata keys cannot exceed ${SCIENTIFIC_METADATA_KEY_MAX_LENGTH} characters.`
        }
        fields += 1
        if (fields > SCIENTIFIC_METADATA_MAX_FIELDS) {
          ancestors.delete(current)
          return `Metadata cannot contain more than ${SCIENTIFIC_METADATA_MAX_FIELDS} fields.`
        }
        const error = visit(nested, depth + 1)
        if (error) {
          ancestors.delete(current)
          return error
        }
      }
    }
    ancestors.delete(current)
    return null
  }

  const error = visit(value, 0)
  if (error) return error
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    return "Metadata must be JSON serializable."
  }
  if (
    new TextEncoder().encode(serialized).byteLength >
    SCIENTIFIC_METADATA_MAX_SERIALIZED_BYTES
  ) {
    return `Metadata cannot exceed ${SCIENTIFIC_METADATA_MAX_SERIALIZED_BYTES} serialized bytes.`
  }
  return null
}

const scientificMetadataSchema = z
  .record(z.string(), z.unknown())
  .superRefine((metadata, context) => {
    const error = scientificMetadataValidationError(metadata)
    if (error) context.addIssue({ code: z.ZodIssueCode.custom, message: error })
  })
  .transform((metadata) => metadata as WorkspaceScientificMetadata)

const scientificMetadataWriteSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("merge"),
      metadata: scientificMetadataSchema,
    })
    .strict()
    .refine(
      (update) => Object.keys(update.metadata).length > 0,
      "Merge metadata must contain at least one field."
    ),
  z
    .object({
      kind: z.literal("replace"),
      metadata: scientificMetadataSchema,
    })
    .strict(),
])

export const resourceScientificMetadataUpdateInputSchema = z
  .object({
    resourceKind: z.enum(["sample", "dataset"]),
    resourceMfid: canonicalResourceMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
    update: scientificMetadataWriteSchema,
  })
  .strict()

const sampleNameChangeSchema = z
  .string()
  .trim()
  .min(1)
  .max(SAMPLE_NAME_MAX_LENGTH)

const timestampChangeSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()

export const sampleDescriptiveUpdateInputSchema = z
  .object({
    changes: z
      .object({
        description: z
          .string()
          .trim()
          .min(1)
          .max(SAMPLE_DESCRIPTION_MAX_LENGTH)
          .nullable()
          .optional(),
        sample_name: sampleNameChangeSchema.optional(),
        sample_type: z
          .string()
          .trim()
          .min(1)
          .max(SAMPLE_TYPE_MAX_LENGTH)
          .nullable()
          .optional(),
        timestamp: timestampChangeSchema,
      })
      .strict()
      .refine(
        (changes) =>
          changes.description !== undefined ||
          changes.sample_name !== undefined ||
          changes.sample_type !== undefined ||
          changes.timestamp !== undefined,
        "At least one sample change is required."
      ),
    resourceMfid: canonicalResourceMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

const datasetNameChangeSchema = z
  .string()
  .trim()
  .min(1)
  .max(DATASET_NAME_MAX_LENGTH)

const nullableDatasetTextChangeSchema = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).nullable().optional()

export const datasetDescriptiveUpdateInputSchema = z
  .object({
    changes: z
      .object({
        data_format: nullableDatasetTextChangeSchema(
          DATASET_DATA_FORMAT_MAX_LENGTH
        ),
        data_type: nullableDatasetTextChangeSchema(
          DATASET_DATA_TYPE_MAX_LENGTH
        ),
        dataset_name: datasetNameChangeSchema.optional(),
        measurement: nullableDatasetTextChangeSchema(
          DATASET_MEASUREMENT_MAX_LENGTH
        ),
        session_name: nullableDatasetTextChangeSchema(
          DATASET_SESSION_NAME_MAX_LENGTH
        ),
        timestamp: timestampChangeSchema,
      })
      .strict()
      .refine(
        (changes) =>
          changes.data_format !== undefined ||
          changes.data_type !== undefined ||
          changes.dataset_name !== undefined ||
          changes.measurement !== undefined ||
          changes.session_name !== undefined ||
          changes.timestamp !== undefined,
        "At least one dataset change is required."
      ),
    resourceMfid: canonicalResourceMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const resourceDeletionRequestInputSchema = z
  .object({
    reason: z.string().trim().min(1).max(2000).optional(),
    resourceMfid: canonicalResourceMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

const ownershipTransferInputSchema = z
  .object({
    newOwner: z.string().trim().min(1).max(255),
    resourceMfid: canonicalResourceMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

const projectReassignmentInputSchema = z
  .object({
    projectMfid: canonicalResourceMfidSchema,
    resourceMfid: canonicalResourceMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

const datasetInstrumentAssignmentInputSchema = z
  .object({
    datasetMfid: canonicalResourceMfidSchema,
    instrumentMfid: canonicalResourceMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

const relationshipOperationFields = {
  action: z.enum(["link", "unlink"]),
  scenario: fixtureScenarioSchema.optional(),
  sourceMfid: canonicalResourceMfidSchema,
  targetMfid: canonicalResourceMfidSchema,
}
const relationshipTypeSchema = z
  .enum(["is_derived_from", "is_part_of"])
  .nullable()
  .optional()

export const workspaceRelationshipOperationInputSchema = z
  .union([
    z
      .object({
        ...relationshipOperationFields,
        relationship: z.enum(["parent", "child"]),
        relationshipType: relationshipTypeSchema,
        sourceKind: z.literal("sample"),
        targetKind: z.literal("sample"),
      })
      .strict(),
    z
      .object({
        ...relationshipOperationFields,
        relationship: z.enum(["parent", "child"]),
        relationshipType: relationshipTypeSchema,
        sourceKind: z.literal("dataset"),
        targetKind: z.literal("dataset"),
      })
      .strict(),
    z
      .object({
        ...relationshipOperationFields,
        relationship: z.literal("associated"),
        sourceKind: z.literal("sample"),
        targetKind: z.literal("dataset"),
      })
      .strict(),
    z
      .object({
        ...relationshipOperationFields,
        relationship: z.literal("associated"),
        sourceKind: z.literal("dataset"),
        targetKind: z.literal("sample"),
      })
      .strict(),
  ])
  .superRefine((operation, context) => {
    if (operation.sourceMfid === operation.targetMfid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A resource cannot be linked to itself.",
        path: ["targetMfid"],
      })
    }
  })

export const getWorkspaceResource = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(resourceReadInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceResource(
        data.resourceMfid,
        data.scenario,
        context.requestSignal,
        data.projection
      )
    )
  })

export const getWorkspaceDatasetFiles = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(datasetFilesInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDatasetFiles(
        data.datasetMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const getWorkspaceDatasetIngestionRequests = createServerFn({
  method: "GET",
})
  .middleware([queryCancellationMiddleware])
  .validator(datasetFilesInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDatasetIngestionRequests(
        data.datasetMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const getWorkspaceIngestionClasses = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(ingestionClassesInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceIngestionClasses(data.scenario, context.requestSignal)
    )
  })

export const requestWorkspaceIngestion = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(fileIngestionInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      requestWorkspaceFileIngestion(
        data.fileMfid,
        data.ingestionClass,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const getWorkspaceDatasetThumbnails = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(datasetFilesInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDatasetThumbnails(
        data.datasetMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const getWorkspaceDatasetThumbnailPreviews = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(datasetThumbnailPreviewsInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDatasetThumbnailPreviews(
        data.datasetMfids,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const mutateWorkspaceDatasetThumbnail = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(datasetThumbnailOperationInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      mutateWorkspaceDatasetThumbnails(
        data satisfies WorkspaceDatasetThumbnailOperation,
        context.requestSignal
      )
    )
  })

export const getWorkspaceResourceGraph = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(resourceMfidInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceResourceGraph(
        data.resourceMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const requestWorkspaceFileDownload = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(fileDownloadInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceFileDownload(
        data.fileMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceSampleDescription = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(sampleDescriptiveUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceSampleDescription(
        data.resourceMfid,
        data.changes,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceDatasetDescription = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(datasetDescriptiveUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceDatasetDescription(
        data.resourceMfid,
        data.changes,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceResourceMetadata = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(resourceScientificMetadataUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      writeWorkspaceResourceMetadata(
        data.resourceMfid,
        data.resourceKind,
        data.update,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceResourceDeletionRequest = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(resourceDeletionRequestInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      requestWorkspaceResourceDeletion(
        data.resourceMfid,
        data.reason,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const previewWorkspaceResourceOwnership = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(ownershipTransferInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      transferWorkspaceResourceOwnership(
        data.resourceMfid,
        data.newOwner,
        false,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const confirmWorkspaceResourceOwnership = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(ownershipTransferInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      transferWorkspaceResourceOwnership(
        data.resourceMfid,
        data.newOwner,
        true,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const previewWorkspaceResourceProjectAssignment = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(projectReassignmentInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      reassignWorkspaceResourceProject(
        data.resourceMfid,
        data.projectMfid,
        false,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const confirmWorkspaceResourceProjectAssignment = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(projectReassignmentInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      reassignWorkspaceResourceProject(
        data.resourceMfid,
        data.projectMfid,
        true,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const assignWorkspaceDatasetInstrument = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(datasetInstrumentAssignmentInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      setWorkspaceDatasetInstrument(
        data.datasetMfid,
        data.instrumentMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const mutateWorkspaceResourceRelationship = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(workspaceRelationshipOperationInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      mutateWorkspaceRelationship(
        data satisfies WorkspaceRelationshipOperation,
        context.requestSignal
      )
    )
  })
