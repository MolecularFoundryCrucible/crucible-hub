import { describe, expect, it } from "vitest"

import { ingestionStatusLabel } from "./ingestion-status"

describe("ingestionStatusLabel", () => {
  it("sentence-cases API statuses", () => {
    expect(ingestionStatusLabel("in_progress")).toBe("In progress")
    expect(ingestionStatusLabel(" COMPLETE ")).toBe("Complete")
    expect(ingestionStatusLabel("queued")).toBe("Queued")
  })
})
