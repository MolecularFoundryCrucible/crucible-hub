import { z } from "zod"

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD date format.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number)
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    const daysInMonth = [
      31,
      leapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ]
    return year > 0 && day >= 1 && day <= (daysInMonth[month - 1] ?? 0)
  }, "Enter a real calendar date.")

export const collectionFilterFields = {
  visibility: z.enum(["all", "public", "private"]).optional(),
  createdFrom: dateOnlySchema.optional(),
  createdTo: dateOnlySchema.optional(),
}

export const collectionFiltersSchema = z
  .object(collectionFilterFields)
  .superRefine((filters, context) => {
    if (
      filters.createdFrom &&
      filters.createdTo &&
      filters.createdFrom > filters.createdTo
    ) {
      context.addIssue({
        code: "custom",
        message: "The start date must not be after the end date.",
        path: ["createdTo"],
      })
    }
  })

export type CollectionFilters = z.infer<typeof collectionFiltersSchema>

export function normalizeCollectionFilters(
  filters: CollectionFilters = {}
): CollectionFilters {
  const parsed = collectionFiltersSchema.parse(filters)
  return {
    ...(parsed.visibility && parsed.visibility !== "all"
      ? { visibility: parsed.visibility }
      : {}),
    ...(parsed.createdFrom ? { createdFrom: parsed.createdFrom } : {}),
    ...(parsed.createdTo ? { createdTo: parsed.createdTo } : {}),
  }
}
