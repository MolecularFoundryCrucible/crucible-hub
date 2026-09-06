import { afterEach, describe, expect, it, vi } from "vitest"

import {
  patchWorkspaceInstrument,
  readWorkspaceInstruments,
} from "./instruments.server"

describe("workspace instrument source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("paginates fixture instruments", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const first = await readWorkspaceInstruments({ limit: 1, offset: 0 })
    const second = await readWorkspaceInstruments({ limit: 1, offset: 1 })

    expect(first.items).toHaveLength(1)
    expect(second.items).toHaveLength(0)
    expect(first.total).toBe(1)
    expect(first.offset).toBe(0)
    expect(second.offset).toBe(1)
    expect(first.items[0]?.capabilities).toMatchObject({ can_edit: true })
  })

  it("preserves API capability guidance and normalizes omission", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [
            {
              capabilities: {
                can_change_status: true,
                can_edit: true,
                can_manage_access: false,
                can_transfer: false,
                max_grant_role: "editor",
              },
              instrument_name: "Operando X-ray instrument",
              location: "Beamline 1",
              other_id: "serial-01",
              other_id_source: "facility registry",
              unique_id: "instrument-with-guidance",
            },
            {
              instrument_name: "Instrument without guidance",
              location: "Beamline 2",
              unique_id: "instrument-without-guidance",
            },
          ],
          limit: 20,
          offset: 0,
          total: 2,
        })
      )
    )

    const page = await readWorkspaceInstruments({ limit: 20, offset: 0 })

    expect(page.items[0]?.capabilities).toMatchObject({
      can_edit: true,
      max_grant_role: "editor",
    })
    expect(page.items[0]).toMatchObject({
      other_id: "serial-01",
      other_id_source: "facility registry",
    })
    expect(page.items[1]).toMatchObject({ capabilities: null })
  })

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(
      readWorkspaceInstruments({ limit: 20, offset: 0 })
    ).rejects.toThrow("The Crucible API login exchange is not connected yet.")
  })

  it("returns a non-persistent fixture instrument descriptive update", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const instrumentMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z4"

    await expect(
      patchWorkspaceInstrument(instrumentMfid, {
        description: null,
        instrument_name: "Updated microprobe",
        location: "Beamline 6.1",
      })
    ).resolves.toEqual({
      description: null,
      instrument_id: "hard-xray-microprobe",
      instrument_name: "Updated microprobe",
      instrument_type: "X-ray microscope",
      location: "Beamline 6.1",
      manufacturer: "Example Instruments",
      model: "XRM-5000",
      modification_time: "2026-08-20T14:25:00Z",
      other_id: null,
      other_id_source: null,
      unique_id: instrumentMfid,
    })

    await expect(
      patchWorkspaceInstrument("missing-instrument", { description: "Missing" })
    ).rejects.toMatchObject({ status: 404 })
  })

  it("patches only supplied instrument descriptive fields and normalizes the response", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return Response.json({
          description: null,
          instrument_id: "hard-xray-microprobe",
          instrument_name: "Updated microprobe",
          instrument_type: "X-ray microscope",
          location: "Beamline 6.1",
          manufacturer: "Example Instruments",
          model: "XRM-5000",
          modification_time: "2026-09-05T18:45:00Z",
          other_id: "serial-42",
          other_id_source: "facility registry",
          status: "active",
          unique_id: "selected-instrument",
        })
      })
    )

    const result = await patchWorkspaceInstrument("selected-instrument", {
      description: null,
      location: "Beamline 6.1",
      other_id: "serial-42",
    })

    expect(result).toEqual({
      description: null,
      instrument_id: "hard-xray-microprobe",
      instrument_name: "Updated microprobe",
      instrument_type: "X-ray microscope",
      location: "Beamline 6.1",
      manufacturer: "Example Instruments",
      model: "XRM-5000",
      modification_time: "2026-09-05T18:45:00Z",
      other_id: "serial-42",
      other_id_source: "facility registry",
      unique_id: "selected-instrument",
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe("PATCH")
    expect(new URL(requests[0].url).pathname).toBe(
      "/instruments/selected-instrument"
    )
    expect(requests[0].headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )
    await expect(requests[0].json()).resolves.toEqual({
      description: null,
      location: "Beamline 6.1",
      other_id: "serial-42",
    })
  })
})
