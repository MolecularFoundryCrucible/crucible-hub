import { afterEach, describe, expect, it, vi } from "vitest"

import {
  patchAccountPreferences,
  readAccountPreferences,
} from "./preferences.server"

function stubApiMode(enabled = true) {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("HUB_DATA_SOURCE", "api")
  vi.stubEnv("HUB_ACCOUNT_PREFERENCES_ENABLED", enabled ? "true" : "false")
  vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
  vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
}

function apiDocument(revision: number, preferences: object) {
  return Response.json(
    {
      preferences,
      revision,
      schema_version: 1,
      updated_at: revision ? "2026-10-14T12:00:00Z" : null,
    },
    {
      headers: { "Crucible-Privilege-Mode": "normal", ETag: `"p${revision}"` },
    }
  )
}

describe("account preferences transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("keeps fixture preferences with increasing revisions", async () => {
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    const initial = await readAccountPreferences()
    const saved = await patchAccountPreferences(
      { default_record_kind: "datasets" },
      initial.etag
    )
    expect(saved.state).toBe("saved")
    expect(saved.document.revision).toBe(initial.revision + 1)
    expect(saved.document.preferences.default_record_kind).toBe("datasets")
    const removed = await patchAccountPreferences(
      { default_record_kind: null },
      saved.document.etag
    )
    expect(removed.document.preferences.default_record_kind).toBeUndefined()
  })

  it("refuses API calls until preferences are enabled", async () => {
    stubApiMode(false)
    await expect(readAccountPreferences()).rejects.toThrow(
      "Account preferences are not enabled"
    )
  })

  it("reads the document and its ETag from the API", async () => {
    stubApiMode()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        requests.push(new Request(input, init))
        return apiDocument(3, { theme: "dark" })
      })
    )

    await expect(readAccountPreferences()).resolves.toEqual({
      etag: '"p3"',
      preferences: { theme: "dark" },
      revision: 3,
      updatedAt: "2026-10-14T12:00:00Z",
    })
    expect(requests[0].url).toBe("https://api.example.test/account/preferences")
    expect(requests[0].headers.get("authorization")).toBe(
      "Bearer local-test-key"
    )
  })

  it("sends the changed keys as a merge patch with If-Match", async () => {
    stubApiMode()
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        requests.push(new Request(input, init))
        return apiDocument(4, { default_record_kind: "datasets" })
      })
    )

    const update = await patchAccountPreferences(
      { default_record_kind: "datasets" },
      '"p3"'
    )
    expect(update.state).toBe("saved")
    expect(requests[0].method).toBe("PATCH")
    expect(requests[0].headers.get("if-match")).toBe('"p3"')
    await expect(requests[0].json()).resolves.toEqual({
      default_record_kind: "datasets",
    })
  })

  it("reapplies the change once on top of a newer revision", async () => {
    stubApiMode()
    const matches: (string | null)[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const request = new Request(input, init)
        if (request.method === "GET") return apiDocument(7, { theme: "light" })
        matches.push(request.headers.get("if-match"))
        return matches.length === 1
          ? Response.json(
              { detail: { code: "etag_mismatch", etag: '"p7"' } },
              { status: 412 }
            )
          : apiDocument(8, { theme: "light", default_record_kind: "datasets" })
      })
    )

    const update = await patchAccountPreferences(
      { default_record_kind: "datasets" },
      '"p3"'
    )
    expect(matches).toEqual(['"p3"', '"p7"'])
    expect(update.state).toBe("changed")
    expect(update.document.preferences).toEqual({
      default_record_kind: "datasets",
      theme: "light",
    })
  })

  it("surfaces validation errors without retrying", async () => {
    stubApiMode()
    const fetchMock = vi.fn(async () =>
      Response.json({ detail: [{ msg: "invalid" }] }, { status: 422 })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      patchAccountPreferences({ theme: "dark" }, '"p1"')
    ).rejects.toMatchObject({ status: 422 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
