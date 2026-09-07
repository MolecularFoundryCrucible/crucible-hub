import { describe, expect, it, vi } from "vitest"

import { readWorkspaceFromApi } from "@/data/crucible/workspace-api.server"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("API workspace adapter", () => {
  it("loads the browser workspace with a server-side bearer credential", async () => {
    const requests: Request[] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      const path = new URL(request.url).pathname

      if (path === "/account/profile") {
        return json({
          unique_id: "0000-0000-0000-0001",
          username: "researcher",
          first_name: "Ada",
          last_name: "Lovelace",
          email: "private@example.invalid",
          is_service_account: false,
        })
      }
      return json({}, 404)
    })

    const source = await readWorkspaceFromApi({
      baseUrl: "https://api.example.test",
      bearerToken: "test-token",
      fetch,
      now: () => new Date("2026-09-03T12:00:00Z"),
    })

    expect(source.status).toBe("ready")
    if (source.status !== "ready") return

    expect(source.mode).toBe("api")
    expect(source.workspace.account).toEqual({
      unique_id: "0000-0000-0000-0001",
      username: "researcher",
      first_name: "Ada",
      is_service_account: false,
      last_name: "Lovelace",
    })
    expect(source.workspace.projects).toEqual([])
    expect(source.workspace.samples).toEqual([])
    expect(source.workspace.datasets).toEqual([])
    expect(requests).toHaveLength(1)
    expect(
      requests.every(
        (request) =>
          request.headers.get("Authorization") === "Bearer test-token"
      )
    ).toBe(true)
    expect(JSON.stringify(source)).not.toContain("test-token")
    expect(JSON.stringify(source)).not.toContain("private@example.invalid")
  })

  it("returns a browser-safe unavailable state for an API rejection", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(json({ detail: "sensitive upstream detail" }, 401))
    )

    const source = await readWorkspaceFromApi({
      baseUrl: "https://api.example.test",
      bearerToken: "test-token",
      fetch,
    })

    expect(source).toEqual({
      status: "unavailable",
      reason: "The Crucible API rejected the account request (401).",
    })
    expect(JSON.stringify(source)).not.toContain("sensitive upstream detail")
  })

  it("propagates caller cancellation to the upstream request", async () => {
    const controller = new AbortController()
    const upstreamSignals: AbortSignal[] = []
    const fetch = vi.fn<typeof globalThis.fetch>((input, init) => {
      const request = new Request(input, init)
      upstreamSignals.push(request.signal)
      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener(
          "abort",
          () => reject(request.signal.reason),
          { once: true }
        )
      })
    })

    const sourcePromise = readWorkspaceFromApi({
      baseUrl: "https://api.example.test",
      bearerToken: "test-token",
      fetch,
      signal: controller.signal,
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    controller.abort(new DOMException("Query cancelled", "AbortError"))
    const source = await sourcePromise

    expect(upstreamSignals).toHaveLength(1)
    expect(upstreamSignals[0]?.aborted).toBe(true)
    expect(source).toEqual({
      status: "unavailable",
      reason: "The local Hub server could not reach the Crucible API.",
    })
  })

  it("propagates the bounded timeout to the upstream request", async () => {
    const timeoutController = new AbortController()
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal)
    const upstreamSignals: AbortSignal[] = []
    const fetch = vi.fn<typeof globalThis.fetch>((input, init) => {
      const request = new Request(input, init)
      upstreamSignals.push(request.signal)
      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener(
          "abort",
          () => reject(request.signal.reason),
          { once: true }
        )
      })
    })

    const sourcePromise = readWorkspaceFromApi({
      baseUrl: "https://api.example.test",
      bearerToken: "test-token",
      fetch,
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    timeoutController.abort(new DOMException("Timed out", "TimeoutError"))
    const source = await sourcePromise

    expect(AbortSignal.timeout).toHaveBeenCalledWith(15_000)
    expect(upstreamSignals).toHaveLength(1)
    expect(upstreamSignals[0]?.aborted).toBe(true)
    expect(source).toEqual({
      status: "unavailable",
      reason: "The Crucible API did not respond before the local timeout.",
    })
  })
})
