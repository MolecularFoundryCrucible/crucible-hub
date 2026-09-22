import { z } from "zod"

export const workspacePersonSchema = z
  .object({
    first_name: z.string(),
    is_service_account: z.boolean().optional().default(false),
    last_name: z.string(),
    unique_id: z.string().min(1),
    username: z.string().nullable().optional().default(null),
  })
  .passthrough()
