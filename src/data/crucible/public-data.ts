import { z } from "zod"

export const publicDataSearchSchema = z.enum(["include", "exclude"])

export type PublicDataChoice = z.infer<typeof publicDataSearchSchema>

export function effectivePublicData(
  publicData: PublicDataChoice | undefined,
  includePublicByDefault: boolean
) {
  return publicData === undefined
    ? includePublicByDefault
    : publicData === "include"
}

export function publicDataSearchValue(
  include: boolean,
  includePublicByDefault: boolean
): PublicDataChoice | undefined {
  if (include === includePublicByDefault) return undefined
  return include ? "include" : "exclude"
}

export function resolveCollectionAffiliation({
  elevated,
  includePublicByDefault,
  ownership,
  publicData,
}: {
  elevated: boolean
  includePublicByDefault: boolean
  ownership?: "owner"
  publicData?: PublicDataChoice
}): "owner" | "member" | undefined {
  if (ownership) return ownership
  if (elevated) return undefined
  return effectivePublicData(publicData, includePublicByDefault)
    ? undefined
    : "member"
}
