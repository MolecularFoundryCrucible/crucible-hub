import { z } from "zod"

import type { IdentityScope } from "./query-keys"

export const fixtureScenarioSchema = z.enum([
  "populated",
  "empty",
  "restricted",
  "dense",
  "partial",
  "degraded",
])

export type FixtureScenario = z.infer<typeof fixtureScenarioSchema>

export const defaultFixtureScenario: FixtureScenario = "populated"

const fixtureServerPrefix = "crucible-fixture:"

export function fixtureServerId(scenario: FixtureScenario) {
  return `${fixtureServerPrefix}${scenario}`
}

export function fixtureScenarioFromScope(
  scope: IdentityScope
): FixtureScenario | undefined {
  if (!scope[1].startsWith(fixtureServerPrefix)) return undefined
  const result = fixtureScenarioSchema.safeParse(
    scope[1].slice(fixtureServerPrefix.length)
  )
  return result.success ? result.data : undefined
}
