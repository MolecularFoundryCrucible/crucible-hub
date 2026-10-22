import { describe, expect, it } from "vitest"

import { Route as InstrumentData } from "./_app.instruments.$instrumentMfid.index"
import { Route as ProjectData } from "./_app.projects.$projectMfid.index"

describe("entity collection routes", () => {
  it("remount when the project or instrument changes", () => {
    expect(
      ProjectData.options.remountDeps?.({
        params: { projectMfid: "project-a" },
      } as never)
    ).toEqual({ projectMfid: "project-a" })
    expect(
      InstrumentData.options.remountDeps?.({
        params: { instrumentMfid: "instrument-a" },
      } as never)
    ).toEqual({ instrumentMfid: "instrument-a" })
  })
})
