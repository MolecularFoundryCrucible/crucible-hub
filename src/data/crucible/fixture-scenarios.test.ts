import { describe, expect, it } from "vitest"

import { fixtureScenarioFromScope, fixtureServerId } from "./fixture-scenarios"
import { identityScope } from "./query-keys"

describe("fixture scenario identity", () => {
  it("round-trips a fixture scenario through an identity scope", () => {
    const scope = identityScope(fixtureServerId("dense"), "account-1")

    expect(fixtureScenarioFromScope(scope)).toBe("dense")
  })

  it("does not infer scenarios from API scopes", () => {
    const scope = identityScope("crucible-hosted", "account-1")

    expect(fixtureScenarioFromScope(scope)).toBeUndefined()
  })
})
