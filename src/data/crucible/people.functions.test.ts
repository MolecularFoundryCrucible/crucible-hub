import { describe, expect, it } from "vitest"

import { personDetailInputSchema } from "./people.functions"

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
})
