import { describe, expect, it } from "vitest"

import {
  personDetailInputSchema,
  serviceAccountLookupInputSchema,
} from "./people.functions"

describe("person server-function inputs", () => {
  it("accepts a stable person identifier", () => {
    expect(
      personDetailInputSchema.safeParse({ personId: "0000-0000-0000-0018" })
        .success
    ).toBe(true)
  })

  it("rejects an empty person identifier", () => {
    expect(personDetailInputSchema.safeParse({ personId: " " }).success).toBe(
      false
    )
  })

  it("normalizes an exact service-account reference", () => {
    expect(
      serviceAccountLookupInputSchema.parse({
        reference: " beamline-collector ",
      })
    ).toEqual({ reference: "beamline-collector" })
  })
})
