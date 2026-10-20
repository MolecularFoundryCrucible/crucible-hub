import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { printWorkspaceLabel, readWorkspacePrinters } from "./print.server"

function stubApi(responses: unknown[]) {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("HUB_DATA_SOURCE", "api")
  vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
  vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
  const requests: Request[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request)
      return crucibleApiResponse(responses.shift())
    })
  )
  return requests
}

describe("label printing", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("lists printers from the API", async () => {
    const requests = stubApi([
      { printers: [{ online: true, printer_id: "spinbot", ts: 1 }] },
    ])

    expect(await readWorkspacePrinters()).toEqual([
      { online: true, printer_id: "spinbot", ts: 1 },
    ])
    expect(new URL(requests[0].url).pathname).toBe("/print/printers")
  })

  it("sends the resource MFID and label name to the chosen printer", async () => {
    const requests = stubApi([
      {
        detail: null,
        job_id: "job-1",
        mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
        name: "Activated catalyst morphology",
        printer_id: "spinbot",
        status: "ok",
        ts: 1,
      },
    ])

    const result = await printWorkspaceLabel({
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
      name: "Activated catalyst morphology",
      printerId: "spinbot",
    })

    expect(result.status).toBe("ok")
    expect(requests[0].method).toBe("POST")
    expect(new URL(requests[0].url).pathname).toBe("/print/barcode")
    expect(await requests[0].json()).toEqual({
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
      name: "Activated catalyst morphology",
      printer_id: "spinbot",
    })
  })

  it("reports an offline fixture printer as a timeout", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const result = await printWorkspaceLabel({
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
      name: "Sample",
      printerId: "glovebox",
    })

    expect(result.status).toBe("timeout")
    expect(result.detail).toMatch(/not currently online/)
  })
})
