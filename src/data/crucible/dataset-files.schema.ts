import { z } from "zod"

export const apiDatasetFileSchema = z
  .object({
    access_note: z.string().nullable().optional(),
    dataset_id: z.number().int(),
    dataset_mfid: z.string().min(1).max(255),
    etag: z.string().min(1).max(255).optional(),
    filename: z.string().min(1).max(10_000),
    mfid: z.string().min(1).max(255),
    sha256_hash: z.string(),
    size: z.number().int().nonnegative(),
    storage_backend: z.string().min(1).max(255),
    storage_path: z.string().nullable().optional(),
  })
  .passthrough()
