import { z } from "zod"

export const printerIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
export const labelNameMaxLength = 120
