import { z } from "zod"

export const preferencesSearchSchema = z.object({
  tab: z.enum(["browsing", "history"]).optional().catch(undefined),
})
