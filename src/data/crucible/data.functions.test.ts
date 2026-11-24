import { describe, expect, it } from "vitest"

import {
  cursorPageInputSchema,
  datasetCursorPageInputSchema,
} from "./data.functions"

describe("dataset server function input", () => {
  it("requires a project MFID for scoped requests and defaults project reads to all", () => {
    expect(
      cursorPageInputSchema.parse({
        limit: 50,
        projectMfid: " fixture-project-1 ",
      })
    ).toMatchObject({
      projectMfid: "fixture-project-1",
      projectScope: "all",
    })
    expect(
      datasetCursorPageInputSchema.safeParse({
        limit: 50,
        projectScope: "shared",
      }).success
    ).toBe(false)
  })
})
