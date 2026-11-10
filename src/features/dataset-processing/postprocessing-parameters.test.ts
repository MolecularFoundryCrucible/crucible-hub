import { describe, expect, it } from "vitest"

import {
  pipelineDescription,
  pipelineLabel,
  pipelineParameterFields,
  pipelineParameters,
} from "./postprocessing-parameters"

describe("pipeline parameters", () => {
  it("reads simple schema properties into fields", () => {
    expect(
      pipelineParameterFields({
        properties: {
          mode: { enum: ["fast", "full"], type: "string" },
          tiles: { title: "Tile count", type: "integer" },
          label: { description: "Shown on the plot", type: "string" },
          overwrite: { type: "boolean" },
        },
        required: ["tiles"],
        type: "object",
      })
    ).toEqual([
      {
        description: undefined,
        kind: "choice",
        label: "Mode",
        name: "mode",
        options: ["fast", "full"],
        required: false,
      },
      {
        description: undefined,
        kind: "integer",
        label: "Tile count",
        name: "tiles",
        required: true,
      },
      {
        description: "Shown on the plot",
        kind: "text",
        label: "Label",
        name: "label",
        required: false,
      },
      {
        description: undefined,
        kind: "boolean",
        label: "Overwrite",
        name: "overwrite",
        required: false,
      },
    ])
  })

  it("has no fields for a pipeline without parameters", () => {
    expect(pipelineParameterFields({ properties: {}, type: "object" })).toEqual(
      []
    )
    expect(pipelineParameterFields({})).toEqual([])
  })

  it("refuses shapes the form cannot show", () => {
    expect(
      pipelineParameterFields({
        properties: { region: { type: "object" } },
      })
    ).toBeNull()
  })

  it("converts values, drops empty optional ones and rejects bad ones", () => {
    const fields = pipelineParameterFields({
      properties: {
        label: { type: "string" },
        overwrite: { type: "boolean" },
        tiles: { type: "integer" },
      },
      required: ["tiles"],
    })!
    expect(pipelineParameters(fields, { label: " ", tiles: "4" })).toEqual({
      overwrite: false,
      tiles: 4,
    })
    expect(pipelineParameters(fields, { tiles: "" })).toBeNull()
    expect(pipelineParameters(fields, { tiles: "2.5" })).toBeNull()
  })

  it("names pipelines for people", () => {
    expect(pipelineLabel("mosaic_stitch")).toBe("Mosaic stitch")
    expect(
      pipelineDescription("Postprocessing: stitch image tiles into a mosaic.")
    ).toBe("Stitch image tiles into a mosaic.")
  })
})
