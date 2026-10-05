import { describe, expect, it } from "vitest"

import {
  instrumentDescriptiveUpdateInputSchema,
  instrumentCreateInputSchema,
  instrumentLifecycleUpdateInputSchema,
  instrumentListInputSchema,
  INSTRUMENT_DESCRIPTION_MAX_LENGTH,
  INSTRUMENT_NAME_MAX_LENGTH,
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
    {
      changes: { instrument_name: undefined },
      instrumentMfid: "instrument-mfid",
    },
    { changes: { instrument_name: " " }, instrumentMfid: "instrument-mfid" },
    { changes: { instrument_name: null }, instrumentMfid: "instrument-mfid" },
    { changes: { instrument_id: " " }, instrumentMfid: "instrument-mfid" },
    { changes: { instrument_id: "ab" }, instrumentMfid: "instrument-mfid" },
    {
      changes: { instrument_id: "_invalid" },
      instrumentMfid: "instrument-mfid",
    },
    {
      changes: { instrument_id: "a".repeat(26) },
      instrumentMfid: "instrument-mfid",
    },
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

describe("instrument lifecycle server function input", () => {
  it.each(["active", "maintenance", "decommissioned"] as const)(
    "accepts the %s lifecycle status",
    (status) => {
      expect(
        instrumentLifecycleUpdateInputSchema.parse({
          instrumentMfid: " instrument-mfid ",
          scenario: "dense",
          status,
        })
      ).toEqual({
        instrumentMfid: "instrument-mfid",
        scenario: "dense",
        status,
      })
    }
  )

  it.each([
    { instrumentMfid: "instrument-mfid", status: "retired" },
    { instrumentMfid: "instrument/mfid", status: "active" },
    { instrumentMfid: "instrument-mfid" },
    { instrumentMfid: "instrument-mfid", status: "active", extra: true },
  ])("rejects an invalid lifecycle request %#", (input) => {
    expect(() => instrumentLifecycleUpdateInputSchema.parse(input)).toThrow()
  })
})

describe("instrument list server function input", () => {
  it("accepts a lifecycle status filter", () => {
    expect(
      instrumentListInputSchema.parse({
        limit: 20,
        status: "decommissioned",
      })
    ).toEqual({ limit: 20, status: "decommissioned" })
  })

  it("rejects an unknown lifecycle status filter", () => {
    expect(() =>
      instrumentListInputSchema.parse({
        limit: 20,
        status: "retired",
      })
    ).toThrow()
  })
})

describe("instrument registration server function input", () => {
  it("normalizes the supported registration fields", () => {
    expect(
      instrumentCreateInputSchema.parse({
        instrument: {
          description: null,
          instrument_id: " beamline-1 ",
          instrument_name: " New instrument ",
          location: " Beamline 1 ",
        },
      })
    ).toEqual({
      instrument: {
        description: null,
        instrument_id: "beamline-1",
        instrument_name: "New instrument",
        location: "Beamline 1",
      },
    })
  })

  it.each(["ab", "starts with spaces", "instrument/one", "x".repeat(26)])(
    "rejects invalid instrument ID %s",
    (instrumentId) => {
      expect(() =>
        instrumentCreateInputSchema.parse({
          instrument: {
            instrument_id: instrumentId,
            instrument_name: "New instrument",
            location: "Beamline 1",
          },
        })
      ).toThrow()
    }
  )
})
