import { z } from "zod"

export const previewMfidSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)
export const invalidPreviewSearchValue = ""

export const resourcePreviewSearchSchema = z.object({
  preview: previewMfidSchema.optional().catch(invalidPreviewSearchValue),
})
export const resourceDetailSearchSchema = resourcePreviewSearchSchema.extend({
  fromProject: previewMfidSchema.optional().catch(undefined),
})
