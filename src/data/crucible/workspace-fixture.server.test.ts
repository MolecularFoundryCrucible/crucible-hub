import { afterEach, describe, expect, it, vi } from "vitest"

import {
  assertFixtureScenarioAvailable,
  readWorkspaceFixture,
} from "@/data/crucible/workspace-fixture.server"
import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"

describe("workspace fixture adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("serves the deterministic workspace outside production", () => {
    vi.stubEnv("NODE_ENV", "development")

    const source = readWorkspaceFixture()

    expect(source.status).toBe("ready")
  })

  it("fails closed in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    const source = readWorkspaceFixture()

    expect(source.status).toBe("unavailable")
  })

  it("allows an explicit production preview", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "true")

    const source = readWorkspaceFixture()

    expect(source.status).toBe("ready")
  })

  it("provides deterministic empty and dense development scenarios", () => {
    vi.stubEnv("NODE_ENV", "development")

    const empty = readWorkspaceFixture("empty")
    const dense = readWorkspaceFixture("dense")

    expect(empty.status).toBe("ready")
    expect(dense.status).toBe("ready")
    if (empty.status === "ready")
      expect(empty.workspace.datasets).toHaveLength(0)
    if (dense.status === "ready")
      expect(dense.workspace.datasets).toHaveLength(57)
  })

  it("orders canonical fixture datasets without mutating the source", () => {
    vi.stubEnv("NODE_ENV", "development")

    const source = readWorkspaceFixture()

    expect(source.status).toBe("ready")
    if (source.status === "ready") {
      expect(
        source.workspace.datasets.map((dataset) => dataset.unique_id)
      ).toEqual([
        "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
        "01J6Y8N4Q2R7M9K3T5V0W1X2Z8",
        "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
      ])
    }
    expect(demoWorkspace.datasets.map((dataset) => dataset.unique_id)).toEqual([
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z8",
      "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
    ])
  })

  it("rejects non-default scenarios in production previews", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "true")

    expect(readWorkspaceFixture("empty").status).toBe("unavailable")
  })

  it("injects only the failure owned by a transport scenario", () => {
    expect(() => assertFixtureScenarioAvailable("partial", "datasets")).toThrow(
      "Datasets are temporarily unavailable."
    )
    expect(() =>
      assertFixtureScenarioAvailable("degraded", "instruments")
    ).toThrow("Instruments are temporarily unavailable.")
    expect(() =>
      assertFixtureScenarioAvailable("partial", "instruments")
    ).not.toThrow()
  })
})
