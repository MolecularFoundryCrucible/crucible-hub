import { z } from "zod"

import { resolveCollectionAffiliation } from "./public-data"
import type { PublicDataChoice } from "./public-data"

export const instrumentDatasetAccessSchema = z.literal("personal")

export type InstrumentDatasetAccess = z.infer<
  typeof instrumentDatasetAccessSchema
>

/**
 * The dataset query for an instrument page. Members of the instrument read
 * every dataset on it, so they see all of them unless they ask for only the
 * datasets they reach through their own grants.
 */
export function instrumentDatasetScope({
  access,
  elevated,
  includePublicByDefault,
  publicData,
  role,
}: {
  access?: InstrumentDatasetAccess
  elevated: boolean
  includePublicByDefault: boolean
  publicData?: PublicDataChoice
  role: string | null | undefined
}): {
  affiliation: "member" | undefined
  includeInstrumentAccess?: true
  member: boolean
} {
  const member = Boolean(role) && !elevated
  if (member && access !== "personal") {
    return { affiliation: "member", includeInstrumentAccess: true, member }
  }
  const affiliation = resolveCollectionAffiliation({
    elevated,
    includePublicByDefault,
    publicData,
  })
  return {
    affiliation: affiliation === "owner" ? undefined : affiliation,
    member,
  }
}
