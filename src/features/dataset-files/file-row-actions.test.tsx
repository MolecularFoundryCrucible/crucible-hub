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

import { FileRowActions } from "./file-row-actions"
import {
  removeDatasetFileFn,
  renameDatasetFileFn,
} from "@/data/crucible/dataset-file-actions.functions"
import type { WorkspaceDatasetFile } from "@/data/crucible/workspace-source"

vi.mock("@/components/crucible/workspace-provider", () => ({
  useWorkspaceScope: () => ["server-1", "person-1"],
}))

vi.mock("@/data/crucible/dataset-file-actions.functions", () => ({
  removeDatasetFileFn: vi.fn(),
  renameDatasetFileFn: vi.fn(),
}))

const file: WorkspaceDatasetFile = {
  dataset_id: 1,
  dataset_mfid: "dataset-1",
  filename: "scan-01.h5",
  mfid: "file-1",
  sha256_hash: "",
  size: 10,
  storage_backend: "gcs",
}

function renderActions(
  overrides: Partial<WorkspaceDatasetFile> = {},
  permissions = { canRemove: true, canRename: true, datasetMfid: "dataset-1" }
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FileRowActions
        file={{ ...file, ...overrides }}
        permissions={permissions}
      />
    </QueryClientProvider>
  )
}

describe("FileRowActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(renameDatasetFileFn).mockResolvedValue({
      data: undefined,
      status: "ok",
    })
    vi.mocked(removeDatasetFileFn).mockResolvedValue({
      data: undefined,
      status: "ok",
    })
  })
  afterEach(cleanup)

  it("renames a stored file", async () => {
    renderActions()

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for scan-01.h5" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: /Rename/ }))
    const dialog = await screen.findByRole("dialog", { name: "Rename file" })
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "scan-01-corrected.h5" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(vi.mocked(renameDatasetFileFn)).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fileMfid: "file-1",
          filename: "scan-01-corrected.h5",
        }),
      })
    )
  })

  it("explains a taken name", async () => {
    const { HubApiClientError } = await import("@/data/crucible/result")
    vi.mocked(renameDatasetFileFn).mockRejectedValue(
      new HubApiClientError({
        conflictCode: "filename_exists",
        correlationId: "c",
        kind: "conflict",
        message: "conflict",
        retryable: false,
      })
    )
    renderActions()

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for scan-01.h5" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: /Rename/ }))
    const dialog = await screen.findByRole("dialog", { name: "Rename file" })
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "scan-02.h5" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(
      await within(dialog).findByText(
        "Another file in this dataset already has that name."
      )
    ).toBeTruthy()
  })

  it("removes a file from the dataset after confirming", async () => {
    renderActions()

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for scan-01.h5" })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Remove from dataset/ })
    )
    const dialog = await screen.findByRole("alertdialog", {
      name: "Remove scan-01.h5?",
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove from dataset" })
    )

    await waitFor(() =>
      expect(vi.mocked(removeDatasetFileFn)).toHaveBeenCalledWith({
        data: expect.objectContaining({ fileMfid: "file-1" }),
      })
    )
  })

  it("offers no rename for a file stored outside Crucible", () => {
    renderActions(
      { storage_backend: "local" },
      { canRemove: false, canRename: true, datasetMfid: "dataset-1" }
    )

    expect(
      screen.queryByRole("button", { name: "Actions for scan-01.h5" })
    ).toBeNull()
  })
})
