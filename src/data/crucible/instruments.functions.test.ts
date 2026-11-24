import { describe, expect, it } from "vitest"

import {
  instrumentDescriptiveUpdateInputSchema,
  instrumentListInputSchema,
} from "./instruments.functions"

describe("instrument update server function input", () => {
  it("normalizes bounded descriptive changes", () => {
    expect(
      instrumentDescriptiveUpdateInputSchema.parse({
        changes: {
          description: " Updated instrument description ",
          instrument_id: " updated-probe ",
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
        instrument_id: "updated-probe",
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
    { changes: { status: "maintenance" }, instrumentMfid: "instrument-mfid" },
  ])("rejects invalid or no-op changes %#", (input) => {
    expect(() => instrumentDescriptiveUpdateInputSchema.parse(input)).toThrow()
  })
})

describe("instrument list server function input", () => {
  it("accepts up to the API's 1,000 instruments for filter suggestions", () => {
    expect(instrumentListInputSchema.safeParse({ limit: 1000 }).success).toBe(
      true
    )
    expect(instrumentListInputSchema.safeParse({ limit: 1001 }).success).toBe(
      false
    )
  })
})
