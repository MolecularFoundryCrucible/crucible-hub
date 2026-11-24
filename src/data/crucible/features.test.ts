import { describe, expect, it } from "vitest"

import { allFeaturesEnabled, workspaceFeatures } from "./features"

describe("workspaceFeatures", () => {
  it("reads each switch and counts a missing one or a malformed body as on", () => {
    expect(workspaceFeatures({ printing: false, uploads: true })).toEqual({
      ingestion: true,
      passwords: true,
      printing: false,
      proposal_sync: true,
      uploads: true,
    })
    expect(workspaceFeatures(undefined)).toEqual(allFeaturesEnabled)
    expect(workspaceFeatures({ uploads: "no" })).toEqual(allFeaturesEnabled)
  })
})
