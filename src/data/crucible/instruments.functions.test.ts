import { describe, expect, it } from "vitest"

import {
  instrumentDescriptiveUpdateInputSchema,
  INSTRUMENT_DESCRIPTION_MAX_LENGTH,
  INSTRUMENT_NAME_MAX_LENGTH,
} from "./instruments.functions"

describe("instrument update server function input", () => {
  it("normalizes bounded descriptive changes", () => {
    expect(
      instrumentDescriptiveUpdateInputSchema.parse({
        changes: {
          description: " Updated instrument description ",
          instrument_name: " Updated instrument ",
          instrument_type: " X-ray microscope ",
          location: " Beamline 5.3.2 ",
          manufacturer: " Example Instruments ",
          model: " XRM-5000 ",
          other_id: " serial-42 ",
          other_id_source: " facility registry ",
        },
        instrumentMfid: " instrument-mfid ",
        scenario: "dense",
      })
    ).toEqual({
      changes: {
        description: "Updated instrument description",
        instrument_name: "Updated instrument",
        instrument_type: "X-ray microscope",
        location: "Beamline 5.3.2",
        manufacturer: "Example Instruments",
        model: "XRM-5000",
        other_id: "serial-42",
        other_id_source: "facility registry",
      },
      instrumentMfid: "instrument-mfid",
      scenario: "dense",
    })
  })

  it.each([
    { changes: {}, instrumentMfid: "instrument-mfid" },
    {
      changes: { instrument_name: undefined },
      instrumentMfid: "instrument-mfid",
    },
    { changes: { instrument_name: " " }, instrumentMfid: "instrument-mfid" },
    { changes: { instrument_name: null }, instrumentMfid: "instrument-mfid" },
    { changes: { location: " " }, instrumentMfid: "instrument-mfid" },
    { changes: { status: "maintenance" }, instrumentMfid: "instrument-mfid" },
    { changes: { description: "x" }, instrumentMfid: "instrument/mfid" },
    {
      changes: { instrument_name: "x".repeat(INSTRUMENT_NAME_MAX_LENGTH + 1) },
      instrumentMfid: "instrument-mfid",
    },
    {
      changes: {
        description: "x".repeat(INSTRUMENT_DESCRIPTION_MAX_LENGTH + 1),
      },
      instrumentMfid: "instrument-mfid",
    },
    {
      changes: { description: null },
      instrumentMfid: "instrument-mfid",
      extra: true,
    },
    {
      changes: { description: null },
      instrumentMfid: "instrument-mfid",
      scenario: "unknown",
    },
  ])("rejects invalid or no-op changes %#", (input) => {
    expect(() => instrumentDescriptiveUpdateInputSchema.parse(input)).toThrow()
  })
})
