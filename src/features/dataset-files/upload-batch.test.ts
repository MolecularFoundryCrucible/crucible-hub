import { describe, expect, it } from "vitest"

import { uploadItemIssues } from "./upload-batch"
import type { UploadItem } from "./upload-batch"

function item(id: string, filename: string, size = 1): UploadItem {
  return {
    file: new File(["x".repeat(size)], filename),
    filename,
    id,
    ingestionClass: null,
    state: { status: "staged" },
  }
}

describe("upload item issues", () => {
  it("accepts a valid unique relative path", () => {
    const items = [item("a", "runs/a.h5")]
    expect(uploadItemIssues(items[0], items, new Set())).toEqual([])
  })

  it("flags duplicates within the batch and in the dataset", () => {
    const items = [item("a", "a.h5"), item("b", "a.h5")]
    expect(uploadItemIssues(items[0], items, new Set(["a.h5"]))).toEqual([
      "Another file in this list has the same name.",
      "A file with this name is already in the dataset.",
    ])
  })

  it("flags empty files and invalid names", () => {
    const items = [item("a", "../a.h5", 0)]
    expect(uploadItemIssues(items[0], items, new Set())).toEqual([
      "File names must not contain dot path segments.",
      "Empty files cannot be uploaded.",
    ])
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
    expect(uploadItemIssues(done, [done], new Set(["a.h5"]))).toEqual([])
  })
})
