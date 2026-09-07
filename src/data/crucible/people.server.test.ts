import { afterEach, describe, expect, it, vi } from "vitest"

import {
  lookupWorkspaceServiceAccount,
  readWorkspacePerson,
} from "./people.server"

describe("workspace person source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("resolves fixture people by stable identity", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      readWorkspacePerson("0000-0000-0000-0018")
    ).resolves.toMatchObject({ username: "morgan.lee" })
    await expect(readWorkspacePerson("missing-person")).resolves.toBeNull()
  })

  it("returns only public-safe fields from the API", async () => {
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
          email: "private@example.invalid",
          first_name: "Morgan",
          is_service_account: false,
          last_name: "Lee",
          unique_id: "0000-0000-0000-0018",
          username: "morgan.lee",
        })
      })
    )

    const person = await readWorkspacePerson("0000-0000-0000-0018")

    expect(person).toEqual({
      first_name: "Morgan",
      last_name: "Lee",
      unique_id: "0000-0000-0000-0018",
      username: "morgan.lee",
    })
    expect(requests[0]?.headers.get("Authorization")).toBe(
      "Bearer local-test-key"
    )
    expect(JSON.stringify(person)).not.toContain("private@example.invalid")
  })

  it("uses exact filtered lookup for a service account", async () => {
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
          items: [
            {
              first_name: "Beamline",
              is_service_account: true,
              last_name: "Collector",
              unique_id: "service-account-mfid",
              username: "beamline-collector",
            },
          ],
          limit: 1,
          offset: 0,
          total: 1,
        })
      })
    )

    await expect(
      lookupWorkspaceServiceAccount("beamline-collector")
    ).resolves.toMatchObject({ unique_id: "service-account-mfid" })
    expect(Object.fromEntries(new URL(requests[0].url).searchParams)).toEqual({
      is_service_account: "true",
      limit: "1",
      permissive: "false",
      username: "beamline-collector",
    })
  })
})
