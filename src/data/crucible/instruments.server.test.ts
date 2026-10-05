import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  addWorkspaceInstrumentOperator,
  checkWorkspaceInstrumentIdExactMatch,
  createWorkspaceInstrumentResource,
  patchWorkspaceInstrument,
  readWorkspaceInstrumentOperators,
  readWorkspaceInstruments,
  removeWorkspaceInstrumentOperator,
  setWorkspaceInstrumentStatus,
} from "./instruments.server"

describe("workspace instrument source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("paginates fixture instruments", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const first = await readWorkspaceInstruments({ limit: 1 })
    const second = await readWorkspaceInstruments({
      cursor: "fixture:1",
      limit: 1,
    })

    expect(first.items).toHaveLength(1)
    expect(second.items).toHaveLength(0)
    expect(first.total).toBe(1)
    expect(first.nextCursor).toBeNull()
    expect(second.nextCursor).toBeNull()
    expect(first.items[0]?.capabilities).toMatchObject({ can_edit: true })
  })

  it("filters fixture instruments by lifecycle status before pagination", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      readWorkspaceInstruments({
        limit: 20,
        status: "maintenance",
      })
    ).resolves.toEqual({ items: [], limit: 20, nextCursor: null, total: 0 })
  })

  it("preserves API capability guidance and normalizes omission", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
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

    const page = await readWorkspaceInstruments({ limit: 20 })

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

  it("sends the selected lifecycle status to the instrument collection", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          items: [],
          limit: 20,
          offset: 0,
          total: 0,
        })
      })
    )

    await readWorkspaceInstruments({
      limit: 20,
      status: "decommissioned",
    })

    expect(Object.fromEntries(new URL(requests[0].url).searchParams)).toEqual({
      include_owner: "true",
      include_total: "true",
      limit: "20",
      status: "decommissioned",
    })
  })

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(readWorkspaceInstruments({ limit: 20 })).rejects.toThrow(
      "The Crucible API login exchange is not connected yet."
    )
  })

  it("returns a non-persistent fixture instrument descriptive update", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const instrumentMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z4"

    await expect(
      patchWorkspaceInstrument(instrumentMfid, {
        description: null,
        instrument_id: "renamed-microprobe",
        instrument_name: "Updated microprobe",
        location: "Beamline 6.1",
      })
    ).resolves.toEqual({
      description: null,
      instrument_id: "renamed-microprobe",
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

    await expect(
      patchWorkspaceInstrument(
        "fixture-instrument-1",
        { instrument_id: "dense-instrument-2" },
        "dense"
      )
    ).rejects.toMatchObject({ status: 409 })
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
        return crucibleApiResponse({
          description: null,
          instrument_id: "renamed-microprobe",
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
      instrument_id: "renamed-microprobe",
      location: "Beamline 6.1",
      other_id: "serial-42",
    })

    expect(result).toEqual({
      description: null,
      instrument_id: "renamed-microprobe",
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
      instrument_id: "renamed-microprobe",
      location: "Beamline 6.1",
      other_id: "serial-42",
    })
  })

  it("changes fixture instrument status without persisting the fixture", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    const instrumentMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z4"

    await expect(
      setWorkspaceInstrumentStatus(instrumentMfid, "maintenance")
    ).resolves.toMatchObject({
      status: "maintenance",
      unique_id: instrumentMfid,
    })
    await expect(
      setWorkspaceInstrumentStatus("missing-instrument", "maintenance")
    ).rejects.toMatchObject({ status: 404 })
  })

  it("uses the dedicated status operation and validates its authoritative response", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          instrument_name: "Hard X-ray Microprobe",
          location: "Beamline 5.3.2",
          modification_time: "2026-09-06T18:00:00Z",
          owner_orcid: "0000-0000-0000-000X",
          resource_type: "instrument",
          status: "maintenance",
          unique_id: "selected-instrument",
        })
      })
    )

    await expect(
      setWorkspaceInstrumentStatus("selected-instrument", "maintenance")
    ).resolves.toEqual({
      modification_time: "2026-09-06T18:00:00Z",
      status: "maintenance",
      unique_id: "selected-instrument",
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe("POST")
    const url = new URL(requests[0].url)
    expect(url.pathname).toBe("/instruments/selected-instrument/status")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "maintenance",
    })
    expect(requests[0].headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          instrument_name: "Hard X-ray Microprobe",
          location: "Beamline 5.3.2",
          owner_orcid: "0000-0000-0000-000X",
          status: "unexpected",
          unique_id: "selected-instrument",
        })
      )
    )
    await expect(
      setWorkspaceInstrumentStatus("selected-instrument", "active")
    ).rejects.toThrow("instrument status response is invalid")
  })

  it("uses the instrument operator endpoints and their complete returned lists", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse([
          {
            first_name: "Beamline",
            is_service_account: true,
            last_name: "Collector",
            role: "admin",
            unique_id: "service-account-mfid",
            username: "beamline-collector",
          },
        ])
      })
    )

    await readWorkspaceInstrumentOperators("instrument-mfid")
    await addWorkspaceInstrumentOperator(
      "instrument-mfid",
      "service-account-mfid"
    )
    await removeWorkspaceInstrumentOperator(
      "instrument-mfid",
      "service-account-mfid"
    )

    expect(requests.map((request) => request.method)).toEqual([
      "GET",
      "POST",
      "DELETE",
    ])
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/instruments/instrument-mfid/service_accounts",
      "/instruments/instrument-mfid/service_accounts/service-account-mfid",
      "/instruments/instrument-mfid/service_accounts/service-account-mfid",
    ])
  })

  it("registers an instrument without adding an owner field", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse({
          instrument_id: "new-instrument",
          instrument_name: "New instrument",
          location: "Beamline 1",
          owner_orcid: "0000-0000-0000-000X",
          resource_type: "instrument",
          unique_id: "new-instrument-mfid",
        })
      })
    )

    const result = await createWorkspaceInstrumentResource({
      instrument_id: "new-instrument",
      instrument_name: "New instrument",
      location: "Beamline 1",
    })

    expect(result).toMatchObject({
      instrument_id: "new-instrument",
      kind: "instrument",
      unique_id: "new-instrument-mfid",
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe("POST")
    expect(new URL(requests[0].url).pathname).toBe("/instruments")
    await expect(requests[0].json()).resolves.toEqual({
      instrument_id: "new-instrument",
      instrument_name: "New instrument",
      location: "Beamline 1",
    })
  })

  it("checks instrument_id availability in fixture and API mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      checkWorkspaceInstrumentIdExactMatch("hard-xray-microprobe")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceInstrumentIdExactMatch("HARD-XRAY-MICROPROBE")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceInstrumentIdExactMatch("non-existent-instrument")
    ).resolves.toBe(false)

    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(url.pathname).toBe("/instruments")
      const instrumentId = url.searchParams.get("instrument_id")
      if (instrumentId === "taken-instrument") {
        return crucibleApiResponse({
          items: [{ instrument_id: "taken-instrument", unique_id: "inst-1" }],
        })
      }
      return crucibleApiResponse({ items: [] })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      checkWorkspaceInstrumentIdExactMatch("taken-instrument")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceInstrumentIdExactMatch("available-instrument")
    ).resolves.toBe(false)
  })
})
