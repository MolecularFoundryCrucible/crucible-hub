import { describe, expect, it } from "vitest"

import { sampleCreateInputSchema } from "./creation.functions"

describe("creation server inputs", () => {
  it("omits client-assigned identifiers from sample creation", () => {
    expect(
      sampleCreateInputSchema.parse({
        sample: {
          description: null,
          projectMfid: "project-mfid",
          public: false,
          sample_name: "Sample A",
          sample_type: null,
          timestamp: "2026-09-06T19:20:00.000Z",
        },
      }).sample
    ).toEqual({
      description: null,
      projectMfid: "project-mfid",
      public: false,
      sample_name: "Sample A",
      sample_type: null,
      timestamp: "2026-09-06T19:20:00.000Z",
    })
    expect(() =>
      sampleCreateInputSchema.parse({
        sample: {
          description: null,
          projectMfid: "project-mfid",
          public: false,
          sample_name: "Sample A",
          sample_type: null,
          timestamp: null,
          unique_id: "client-assigned-mfid",
        },
      })
    ).toThrow()
  })
})
