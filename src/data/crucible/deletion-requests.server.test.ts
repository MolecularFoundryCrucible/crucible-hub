import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { readWorkspaceDeletionAudit } from "./deletion-requests.server"

describe("workspace deletion audit source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("reads approved deletions of every deletable resource type", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const audit = (id: number, resource_type: string) => ({
      deleted_at: "2026-08-21T16:31:00Z",
      id,
      requester: null,
      requester_id: "requester",
      resource_id: `resource-${id}`,
      resource_type,
      reviewer: null,
      reviewer_id: "reviewer",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse({
          items: [
            audit(1, "dataset"),
            audit(2, "sample"),
            audit(3, "project"),
            audit(4, "instrument"),
          ],
          limit: 50,
        })
      )
    )

    const page = await readWorkspaceDeletionAudit({
      direction: "desc",
      limit: 50,
      scope: "submitted",
    })

    expect(page.items.map((item) => item.resource_type)).toEqual([
      "dataset",
      "sample",
      "project",
      "instrument",
    ])
  })
})
