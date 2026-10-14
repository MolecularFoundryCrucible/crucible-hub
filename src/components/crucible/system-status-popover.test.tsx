import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SystemStatusPopover } from "./system-status-popover"
import { getSystemStatus } from "@/data/crucible/system-status.functions"
import type { SystemStatus } from "@/data/crucible/system-status"

vi.mock("@/data/crucible/system-status.functions", () => ({
  getSystemStatus: vi.fn(),
}))

const healthyStatus: SystemStatus = {
  status: "ok",
  hub: { revision: "hub-123", version: "1.0.1" },
  api: {
    status: "ok",
    url: "https://api.example.test",
    version: "1.2.3",
    commit: "api-commit-456",
    branch: "main",
    latencyMs: 12,
  },
  database: {
    status: "ok",
    latencyMs: 4,
    schemaRevisions: ["20260101_init", "20260201_update"],
  },
  timestamp: "2026-10-05T12:00:00.000Z",
}

function renderPopover(
  props: React.ComponentProps<typeof SystemStatusPopover> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SystemStatusPopover {...props} />
    </QueryClientProvider>
  )
}

describe("SystemStatusPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it("renders trigger button with API status label and closed state initially", () => {
    renderPopover()

    const trigger = screen.getByRole("button", { name: "API status" })
    expect(trigger).toBeTruthy()
    expect(screen.queryByText("System Status")).toBeNull()
  })

  it("opens popover on click and loads healthy system status", async () => {
    vi.mocked(getSystemStatus).mockResolvedValue(healthyStatus)

    renderPopover({
      build: { commit: "git-rev-test", development: false, version: "1.0.1" },
    })

    const trigger = screen.getByRole("button", { name: "API status" })
    fireEvent.click(trigger)

    expect((await screen.findAllByText("Operational")).length).toBeGreaterThan(
      0
    )
    expect(screen.getByText("API")).toBeTruthy()
    expect(screen.getByText("https://api.example.test")).toBeTruthy()
    expect(screen.getByText(/12 ms/)).toBeTruthy()
    expect(screen.getByText(/v1\.2\.3/)).toBeTruthy()
    expect(screen.getByText("Database")).toBeTruthy()
    expect(screen.getByText("Connected")).toBeTruthy()
    expect(screen.getAllByText(/20260201_update/).length).toBeGreaterThan(0)
    expect(screen.getByText(/v1\.0\.1 • git-rev-test/)).toBeTruthy()

    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
    expect(screen.getByText("Diagnostic payload")).toBeTruthy()

    const hubHealth = screen.getByRole("link", { name: /Hub health/i })
    expect(hubHealth.getAttribute("href")).toBe("/hub/health")
    expect(hubHealth.getAttribute("target")).toBe("_blank")
  })

  it("displays degraded system status when services report degradation", async () => {
    vi.mocked(getSystemStatus).mockResolvedValue({
      ...healthyStatus,
      status: "degraded",
      api: { ...healthyStatus.api, status: "degraded" },
      database: { ...healthyStatus.database, status: "error" },
    })

    renderPopover()

    fireEvent.click(screen.getByRole("button", { name: "API status" }))

    expect((await screen.findAllByText("Degraded")).length).toBeGreaterThan(0)
    expect(screen.getByText("Error")).toBeTruthy()
  })

  it("allows refreshing status bypassing cache", async () => {
    vi.mocked(getSystemStatus).mockResolvedValue(healthyStatus)

    renderPopover()

    fireEvent.click(screen.getByRole("button", { name: "API status" }))

    const refreshButton = await screen.findByRole("button", {
      name: /Refresh/i,
    })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(getSystemStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { bypassCache: true },
        })
      )
    })
  })
})
