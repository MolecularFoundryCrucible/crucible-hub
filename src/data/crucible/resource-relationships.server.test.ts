import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { mutateWorkspaceRelationship } from "./resource-relationships.server"

describe("resource relationship source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("rejects failed API mutations and mismatched post-mutation details", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const operation = {
      action: "link" as const,
      relationship: "associated" as const,
      sourceKind: "sample" as const,
      sourceMfid: "sample-1",
      targetKind: "dataset" as const,
      targetMfid: "dataset-1",
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({}, { status: 403 }))
    )
    await expect(
      safeCrucibleCall("test-correlation", () =>
        mutateWorkspaceRelationship(operation)
      )
    ).resolves.toMatchObject({
      status: "error",
      error: { kind: "forbidden", retryable: false },
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        if (request.method !== "GET") return crucibleApiResponse(1)
        return crucibleApiResponse({
          capabilities: null,
          creation_time: null,
          links: [],
          modification_time: null,
          owner: null,
          project: null,
          public: false,
          resource_type: "sample",
          sample_name: "Sample",
          sample_type: null,
          scientific_metadata: null,
          unique_id: new URL(request.url).pathname.split("/").at(-1),
        })
      })
    )
    await expect(mutateWorkspaceRelationship(operation)).rejects.toThrow(
      "target does not have the expected kind"
    )
  })
})
