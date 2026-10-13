import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"
import { createQueryClient } from "@/data/query-client"
import { identityScope } from "@/data/crucible/query-keys"
import {
  getWorkspaceDatasetFiles,
  getWorkspaceResource,
  requestWorkspaceFileDownload,
} from "@/data/crucible/resources.functions"
import { datasetFilesQueryOptions } from "@/data/crucible/resources.queries"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import {
  DatasetFiles,
  FilesTable,
  initiateFileDownload,
} from "@/features/dataset-files/dataset-files-card"

import {
  isResourceOverviewPath,
  preloadResourceShell,
} from "../../features/resource-detail/resource-detail-page"

vi.mock("@/data/crucible/resources.functions", () => ({
  DATASET_DATA_FORMAT_MAX_LENGTH: 255,
  DATASET_DATA_TYPE_MAX_LENGTH: 255,
  DATASET_MEASUREMENT_MAX_LENGTH: 255,
  DATASET_NAME_MAX_LENGTH: 255,
  DATASET_SESSION_NAME_MAX_LENGTH: 255,
  SAMPLE_DESCRIPTION_MAX_LENGTH: 10_000,
  SAMPLE_NAME_MAX_LENGTH: 255,
  SAMPLE_TYPE_MAX_LENGTH: 255,
  getWorkspaceDatasetFiles: vi.fn(),
  getWorkspaceResource: vi.fn(),
  requestWorkspaceFileDownload: vi.fn(),
  updateWorkspaceDatasetDescription: vi.fn(),
  updateWorkspaceSampleDescription: vi.fn(),
}))

const scope = identityScope("crucible-fixture:populated", "0000-0000-0000-000X")
const datasetMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z7"

function renderFiles() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider mode="fixture" scope={scope}>
        <DatasetFiles canEdit={false} datasetMfid={datasetMfid} />
      </WorkspaceProvider>
    </QueryClientProvider>
  )
  return queryClient
}

describe("DatasetFiles", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.mocked(getWorkspaceDatasetFiles).mockReset()
    vi.mocked(getWorkspaceResource).mockReset()
    vi.mocked(requestWorkspaceFileDownload).mockReset()
  })

  it("preloads only shared resource detail", async () => {
    const resource = {
      capabilities: null,
      creation_time: null,
      data_format: null,
      data_type: null,
      instrument: null,
      instrument_id: null,
      kind: "dataset",
      links: [],
      measurement: null,
      modification_time: null,
      name: "Dataset",
      owner: null,
      project: null,
      project_id: null,
      public: false,
      scientific_metadata: null,
      session_name: null,
      size: null,
      timestamp: null,
      unique_id: datasetMfid,
    } satisfies WorkspaceResourceDetail
    vi.mocked(getWorkspaceResource).mockResolvedValue({
      status: "ok",
      data: resource,
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await expect(
      preloadResourceShell(queryClient, scope, datasetMfid)
    ).resolves.toEqual(resource)
    expect(getWorkspaceDatasetFiles).not.toHaveBeenCalled()
    expect(
      queryClient.getQueryState(
        datasetFilesQueryOptions(scope, datasetMfid).queryKey
      )
    ).toBeUndefined()

    vi.mocked(getWorkspaceResource).mockClear()
    const overviewClient = createQueryClient()
    await expect(
      preloadResourceShell(overviewClient, scope, datasetMfid, false, true)
    ).resolves.toEqual(resource)
    expect(getWorkspaceResource).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(getWorkspaceResource).mock.calls[0]?.[0]?.data
    ).not.toHaveProperty("projection", "summary")
  })

  it("recognizes the overview path of a resource", () => {
    expect(
      isResourceOverviewPath(`/datasets/${datasetMfid}`, datasetMfid)
    ).toBe(true)
    expect(
      isResourceOverviewPath(`/hub/datasets/${datasetMfid}/`, datasetMfid)
    ).toBe(true)
    expect(
      isResourceOverviewPath(`/datasets/${datasetMfid}/graph`, datasetMfid)
    ).toBe(false)
  })

  it("keeps resource files local and retries an initial failure", async () => {
    vi.mocked(getWorkspaceDatasetFiles)
      .mockRejectedValueOnce(new Error("file request failed"))
      .mockResolvedValueOnce({
        status: "ok",
        data: [demoWorkspace.files[0]],
      })

    renderFiles()

    await waitFor(() =>
      expect(screen.getByText("File metadata could not be loaded")).toBeTruthy()
    )
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() =>
      expect(screen.getByText(demoWorkspace.files[0].filename)).toBeTruthy()
    )
  })

  it("retains an empty panel when a refresh fails", async () => {
    vi.mocked(getWorkspaceDatasetFiles)
      .mockResolvedValueOnce({ status: "ok", data: [] })
      .mockRejectedValueOnce(new Error("file refresh failed"))

    const queryClient = renderFiles()
    await waitFor(() =>
      expect(screen.getByText("No associated files")).toBeTruthy()
    )

    await queryClient.refetchQueries({
      queryKey: [...scope, "datasets", "files", datasetMfid],
    })

    await waitFor(() =>
      expect(
        screen.getByText(
          "File metadata could not be refreshed. Showing the last available data."
        )
      ).toBeTruthy()
    )
    expect(screen.getByText("No associated files")).toBeTruthy()
  })

  it("prepares a GCS file and starts no-referrer same-tab navigation", async () => {
    const file = demoWorkspace.files[0]
    const url = "https://storage.example.test/signed-file"
    vi.mocked(getWorkspaceDatasetFiles).mockResolvedValue({
      status: "ok",
      data: [file],
    })
    vi.mocked(requestWorkspaceFileDownload).mockResolvedValue({
      status: "ok",
      data: { status: "ready", url, expiresInSeconds: 60 },
    })
    let activated:
      | {
          connected: boolean
          href: string
          referrerPolicy: string
          rel: string
          target: string
        }
      | undefined
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        activated = {
          connected: this.isConnected,
          href: this.href,
          referrerPolicy: this.referrerPolicy,
          rel: this.rel,
          target: this.target,
        }
      })

    renderFiles()
    fireEvent.click(
      await screen.findByRole("button", { name: `Download ${file.filename}` })
    )

    await waitFor(() =>
      expect(requestWorkspaceFileDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { fileMfid: file.mfid, scenario: "populated" },
          signal: expect.any(AbortSignal),
        })
      )
    )
    expect(activated).toEqual({
      connected: false,
      href: url,
      referrerPolicy: "no-referrer",
      rel: "noopener noreferrer",
      target: "_self",
    })
    expect(document.querySelector(`a[href="${url}"]`)).toBeNull()
    click.mockRestore()
  })

  it("does not request a download for a non-GCS file", async () => {
    const file = { ...demoWorkspace.files[0], storage_backend: "catalog" }
    vi.mocked(getWorkspaceDatasetFiles).mockResolvedValue({
      status: "ok",
      data: [file],
    })

    renderFiles()

    expect(
      (
        await screen.findByRole("button", {
          name: `Download unavailable for ${file.filename}`,
        })
      ).hasAttribute("disabled")
    ).toBe(true)
    expect(requestWorkspaceFileDownload).not.toHaveBeenCalled()
  })

  it("keeps a download failure local and exposes retry", async () => {
    const file = demoWorkspace.files[0]
    vi.mocked(getWorkspaceDatasetFiles).mockResolvedValue({
      status: "ok",
      data: [file],
    })
    vi.mocked(requestWorkspaceFileDownload).mockResolvedValue({
      status: "error",
      error: {
        correlationId: "safe-reference",
        kind: "upstream",
        message: "Download could not be prepared",
        retryable: true,
      },
    })

    renderFiles()
    fireEvent.click(
      await screen.findByRole("button", { name: `Download ${file.filename}` })
    )

    expect(
      await screen.findByRole("button", {
        name: `Retry download for ${file.filename}`,
      })
    ).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("safe-reference")
  })

  it("discards a prepared capability after the file row unmounts", async () => {
    const file = demoWorkspace.files[0]
    let resolveDownload: (value: {
      status: "ok"
      data: { status: "ready"; url: string; expiresInSeconds: number }
    }) => void = () => {}
    vi.mocked(getWorkspaceDatasetFiles).mockResolvedValue({
      status: "ok",
      data: [file],
    })
    vi.mocked(requestWorkspaceFileDownload).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve
        })
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    renderFiles()
    fireEvent.click(
      await screen.findByRole("button", { name: `Download ${file.filename}` })
    )
    const signal = vi.mocked(requestWorkspaceFileDownload).mock.calls[0][0]
      .signal
    cleanup()
    expect(signal?.aborted).toBe(true)
    resolveDownload({
      status: "ok",
      data: {
        status: "ready",
        url: "https://storage.example.test/late-capability",
        expiresInSeconds: 60,
      },
    })
    await Promise.resolve()

    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })

  it("sorts files by name, size, and storage on the client", () => {
    const base = demoWorkspace.files[0]
    const files = [
      {
        ...base,
        filename: "run-10.h5",
        mfid: "f-a",
        size: 30,
        storage_backend: "gcs",
      },
      {
        ...base,
        filename: "run-2.h5",
        mfid: "f-b",
        size: 10,
        storage_backend: "local",
      },
      {
        ...base,
        filename: "Notes.txt",
        mfid: "f-c",
        size: 20,
        storage_backend: "gcs",
      },
    ]
    render(
      <WorkspaceProvider mode="fixture" scope={scope}>
        <FilesTable files={files} />
      </WorkspaceProvider>
    )
    const order = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent.match(/[\w-]+\.(h5|txt)/)?.[0])

    expect(order()).toEqual(["Notes.txt", "run-2.h5", "run-10.h5"])

    fireEvent.click(
      screen.getByRole("button", { name: "Sort by size descending." })
    )
    expect(order()).toEqual(["run-10.h5", "Notes.txt", "run-2.h5"])
    fireEvent.click(
      screen.getByRole("button", {
        name: "Size, sorted descending. Sort ascending.",
      })
    )
    expect(order()).toEqual(["run-2.h5", "Notes.txt", "run-10.h5"])

    fireEvent.click(
      screen.getByRole("button", { name: "Sort by storage ascending." })
    )
    expect(order()).toEqual(["Notes.txt", "run-10.h5", "run-2.h5"])
  })

  it("shows the first ten sorted files until expanded", () => {
    const base = demoWorkspace.files[0]
    const files = Array.from({ length: 12 }, (_, index) => ({
      ...base,
      filename: `run-${index + 1}.h5`,
      mfid: `f-${index + 1}`,
      size: index + 1,
    }))
    render(
      <WorkspaceProvider mode="fixture" scope={scope}>
        <FilesTable files={files} />
      </WorkspaceProvider>
    )
    const order = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent.match(/run-\d+\.h5/)?.[0])

    expect(order()).toHaveLength(10)
    fireEvent.click(
      screen.getByRole("button", { name: "Sort by size descending." })
    )
    expect(order()[0]).toBe("run-12.h5")

    fireEvent.click(screen.getByRole("button", { name: "Show all 12 files" }))
    expect(order()).toHaveLength(12)
    expect(order()[11]).toBe("run-1.h5")
    expect(
      screen
        .getByRole("button", { name: "Show fewer files" })
        .getAttribute("aria-controls")
    ).toBe(screen.getByRole("table").id)
  })

  it("aborts and discards a pending capability when identity changes", async () => {
    const file = demoWorkspace.files[0]
    const otherScope = identityScope(
      "crucible-fixture:populated",
      "0000-0000-0000-0020"
    )
    let resolveDownload: (value: {
      status: "ok"
      data: { status: "ready"; url: string; expiresInSeconds: number }
    }) => void = () => {}
    vi.mocked(requestWorkspaceFileDownload).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve
        })
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    const view = (activeScope: typeof scope) => (
      <WorkspaceProvider mode="fixture" scope={activeScope}>
        <FilesTable files={[file]} />
      </WorkspaceProvider>
    )
    const result = render(view(scope))
    fireEvent.click(
      screen.getByRole("button", { name: `Download ${file.filename}` })
    )
    expect(
      screen
        .getByRole("button", {
          name: `Preparing download for ${file.filename}`,
        })
        .hasAttribute("disabled")
    ).toBe(true)
    const signal = vi.mocked(requestWorkspaceFileDownload).mock.calls[0][0]
      .signal

    result.rerender(view(otherScope))
    expect(signal?.aborted).toBe(true)
    resolveDownload({
      status: "ok",
      data: {
        status: "ready",
        url: "https://storage.example.test/other-identity-capability",
        expiresInSeconds: 60,
      },
    })
    await Promise.resolve()

    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })

  it("clears an unavailable row state when identity changes", async () => {
    const file = demoWorkspace.files[0]
    const otherScope = identityScope(
      "crucible-fixture:populated",
      "0000-0000-0000-0020"
    )
    vi.mocked(requestWorkspaceFileDownload).mockResolvedValue({
      status: "ok",
      data: { status: "unavailable" },
    })
    const view = (activeScope: typeof scope) => (
      <WorkspaceProvider mode="fixture" scope={activeScope}>
        <FilesTable files={[file]} />
      </WorkspaceProvider>
    )
    const result = render(view(scope))
    fireEvent.click(
      screen.getByRole("button", { name: `Download ${file.filename}` })
    )
    await screen.findByRole("button", {
      name: `Download unavailable for ${file.filename}`,
    })

    result.rerender(view(otherScope))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Download ${file.filename}` })
      ).toBeTruthy()
    )
  })
})

describe("initiateFileDownload", () => {
  it("does not retain the capability in the document", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    const url = "https://storage.example.test/ephemeral"

    initiateFileDownload(url)

    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector(`a[href="${url}"]`)).toBeNull()
    click.mockRestore()
  })
})
