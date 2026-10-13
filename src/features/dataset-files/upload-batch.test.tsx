import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { identityScope } from "@/data/crucible/query-keys"

import {
  MAX_PARALLEL_FILES,
  uploadItemIssues,
  uploadReplaceTarget,
  useUploadBatch,
} from "./upload-batch"
import type { WorkspaceDatasetFile } from "@/data/crucible/workspace-source"
import type { UploadItem } from "./upload-batch"
import { uploadDatasetFile } from "./upload-orchestrator"

vi.mock("./upload-orchestrator", () => ({ uploadDatasetFile: vi.fn() }))
vi.mock("./upload-leave-guard", () => ({
  useUploadLeaveGuard: () => ({
    onLeave: () => undefined,
    onStay: () => undefined,
    open: false,
  }),
}))

function stored(
  filename: string,
  overrides: Partial<WorkspaceDatasetFile> = {}
): [string, WorkspaceDatasetFile] {
  return [
    filename,
    {
      dataset_id: 1,
      dataset_mfid: "d",
      etag: '"etag-1"',
      filename,
      mfid: `file-${filename}`,
      sha256_hash: "",
      size: 1,
      storage_backend: "gcs",
      ...overrides,
    },
  ]
}

function item(id: string, filename: string, size = 1): UploadItem {
  return {
    file: new File(["x".repeat(size)], filename),
    filename,
    id,
    ingestor: { kind: "none" },
    state: { status: "staged" },
  }
}

describe("upload item issues", () => {
  it("accepts a valid unique relative path", () => {
    const items = [item("a", "runs/a.h5")]
    expect(uploadItemIssues(items[0], items, new Map())).toEqual([])
  })

  it("flags duplicates within the batch and in the dataset", () => {
    const items = [item("a", "a.h5"), item("b", "a.h5")]
    expect(
      uploadItemIssues(items[0], items, new Map([stored("a.h5")]))
    ).toEqual([
      "Another file in this list has the same name.",
      "A file with this name is already in the dataset.",
    ])
  })

  it("flags empty files and invalid names", () => {
    const items = [item("a", "../a.h5", 0)]
    expect(uploadItemIssues(items[0], items, new Map())).toEqual([
      "File names must not contain dot path segments.",
      "Empty files cannot be uploaded.",
    ])
  })

  it("clears the existing-name issue only for a confirmed replacement of that file", () => {
    const existing = new Map([stored("a.h5")])
    const staged = item("a", "a.h5")
    expect(uploadReplaceTarget(staged, existing)).toEqual({
      etag: '"etag-1"',
      fileMfid: "file-a.h5",
    })
    expect(
      uploadItemIssues(
        { ...staged, replace: { etag: '"etag-1"', fileMfid: "file-a.h5" } },
        [staged],
        existing
      )
    ).toEqual([])
    expect(
      uploadItemIssues(
        { ...staged, replace: { etag: '"etag-1"', fileMfid: "other" } },
        [staged],
        existing
      )
    ).toEqual(["A file with this name is already in the dataset."])
  })

  it("never offers to replace catalog-only files or files without an etag", () => {
    const staged = item("a", "a.h5")
    expect(
      uploadReplaceTarget(
        staged,
        new Map([stored("a.h5", { storage_backend: "globus" })])
      )
    ).toBeUndefined()
    expect(
      uploadReplaceTarget(
        staged,
        new Map([stored("a.h5", { etag: undefined })])
      )
    ).toBeUndefined()
  })

  it("ignores finished uploads", () => {
    const done: UploadItem = {
      ...item("a", "a.h5"),
      state: {
        file: {
          dataset_id: 1,
          dataset_mfid: "d",
          filename: "a.h5",
          mfid: "f",
          sha256_hash: "",
          size: 1,
          storage_backend: "gcs",
        },
        status: "done",
      },
    }
    expect(uploadItemIssues(done, [done], new Map([stored("a.h5")]))).toEqual(
      []
    )
  })
})

describe("upload batch", () => {
  it("uploads at most three files at a time", async () => {
    let active = 0
    let peak = 0
    vi.mocked(uploadDatasetFile).mockImplementation(async ({ filename }) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return {
        dataset_id: 1,
        dataset_mfid: "dataset-1",
        filename,
        mfid: `file-${filename}`,
        sha256_hash: "",
        size: 1,
        storage_backend: "gcs",
      }
    })
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useUploadBatch(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <WorkspaceProvider
            mode="fixture"
            scope={identityScope("crucible-fixture:populated", "account")}
          >
            {children}
          </WorkspaceProvider>
        </QueryClientProvider>
      ),
    })

    act(() =>
      result.current.add(
        Array.from({ length: 7 }, (_, index) => ({
          file: new File(["x"], `file-${index}.h5`),
          path: `file-${index}.h5`,
        }))
      )
    )
    let complete = false
    await act(async () => {
      complete = await result.current.start("dataset-1")
    })

    expect(complete).toBe(true)
    expect(peak).toBe(MAX_PARALLEL_FILES)
    expect(uploadDatasetFile).toHaveBeenCalledTimes(7)
    expect(
      result.current.items.every((entry) => entry.state.status === "done")
    ).toBe(true)
  })
})
