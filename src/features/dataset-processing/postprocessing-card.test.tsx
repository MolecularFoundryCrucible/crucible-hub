import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PostprocessingCard } from "./postprocessing-card"
import {
  getDatasetPostprocessingRuns,
  getWorkspacePipelines,
  startDatasetPostprocessingFn,
} from "@/data/crucible/postprocessing.functions"

const featuresOff = new Set<string>()

vi.mock("@/components/crucible/workspace-provider", () => ({
  useFeatureEnabled: (feature: string) => !featuresOff.has(feature),
  useWorkspaceScope: () => ["server-1", "person-1"],
}))

vi.mock("@/data/crucible/postprocessing.functions", () => ({
  getDatasetPostprocessingRuns: vi.fn(),
  getWorkspacePipelines: vi.fn(),
  startDatasetPostprocessingFn: vi.fn(),
}))

const run = {
  dataset_mfid: "dataset-1",
  error: "Tiles overlap.",
  finished_at: "2026-11-09T10:05:00Z",
  parameters: {},
  pipeline: "mosaic_stitch",
  requested_at: "2026-11-09T10:00:00Z",
  requested_by: "person-1",
  run_id: 7,
  started_at: "2026-11-09T10:01:00Z",
  status: "failed" as const,
}

function renderCard(canRun = true) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PostprocessingCard canRun={canRun} datasetMfid="dataset-1" />
    </QueryClientProvider>
  )
}

describe("PostprocessingCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featuresOff.clear()
    vi.mocked(getDatasetPostprocessingRuns).mockResolvedValue({
      data: { items: [run], total: 1 },
      status: "ok",
    })
    vi.mocked(getWorkspacePipelines).mockResolvedValue({
      data: [
        {
          description: "Postprocessing: stitch image tiles into a mosaic.",
          name: "mosaic_stitch",
          parameters_schema: { properties: {}, type: "object" },
        },
      ],
      status: "ok",
    })
    vi.mocked(startDatasetPostprocessingFn).mockResolvedValue({
      data: { ...run, error: null, run_id: 8, status: "requested" },
      status: "ok",
    })
  })
  afterEach(cleanup)

  it("lists runs with their status and failure", async () => {
    renderCard()

    const table = await screen.findByRole("table", {
      name: "Post-processing runs",
    })
    expect(within(table).getByText("Mosaic stitch")).toBeTruthy()
    expect(within(table).getByText("Tiles overlap.")).toBeTruthy()
  })

  it("starts a pipeline with a retry-safe key", async () => {
    renderCard()

    fireEvent.click(await screen.findByRole("button", { name: "Run pipeline" }))
    const dialog = await screen.findByRole("dialog", { name: "Run pipeline" })
    expect(
      within(dialog).getByText("Stitch image tiles into a mosaic.")
    ).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("button", { name: "Start" }))

    await waitFor(() =>
      expect(vi.mocked(startDatasetPostprocessingFn)).toHaveBeenCalledWith({
        data: expect.objectContaining({
          datasetMfid: "dataset-1",
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
          parameters: {},
          pipeline: "mosaic_stitch",
        }),
      })
    )
  })

  it("offers no run to someone who cannot edit the dataset", async () => {
    renderCard(false)

    await screen.findByRole("table", { name: "Post-processing runs" })
    expect(screen.queryByRole("button", { name: "Run pipeline" })).toBeNull()
    expect(vi.mocked(getWorkspacePipelines)).not.toHaveBeenCalled()
  })

  it("asks nothing of the API when ingestion is switched off", () => {
    featuresOff.add("ingestion")
    renderCard()

    expect(
      screen.getByText(
        "Post-processing isn't turned on for this Crucible server"
      )
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Run pipeline" })).toBeNull()
    expect(vi.mocked(getDatasetPostprocessingRuns)).not.toHaveBeenCalled()
    expect(vi.mocked(getWorkspacePipelines)).not.toHaveBeenCalled()
  })

  it("says when post-processing is off on the server", async () => {
    vi.mocked(getDatasetPostprocessingRuns).mockResolvedValue({
      error: {
        correlationId: "c",
        kind: "unavailable",
        message: "This isn't turned on for this Crucible server.",
        retryable: false,
      },
      status: "error",
    })
    renderCard()

    expect(
      await screen.findByText(
        "Post-processing isn't turned on for this Crucible server"
      )
    ).toBeTruthy()
  })
})
