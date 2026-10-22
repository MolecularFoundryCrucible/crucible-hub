import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { UploadFilesDialog } from "./upload-dialog"

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuery: () => ({ data: [] }),
}))
vi.mock("@/components/crucible/workspace-provider", () => ({
  useWorkspaceScope: () => ["scope"],
}))
vi.mock("./upload-batch", () => ({
  useUploadBatch: () => ({
    add: vi.fn(),
    blocked: false,
    cancel: vi.fn(),
    items: [{}],
    pendingCount: 1,
    reset: vi.fn(),
    start: vi.fn(),
    uploading: true,
  }),
}))
vi.mock("./upload-file-list", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  UploadFileList: () => <ul />,
}))
vi.mock("./upload-leave-guard", () => ({ UploadLeaveDialog: () => null }))

afterEach(cleanup)

describe("UploadFilesDialog", () => {
  it("keeps the drop zone in place and disabled while uploading", () => {
    render(<UploadFilesDialog datasetMfid="ds" onClose={() => {}} open />)
    expect(screen.getByRole("button", { name: "Choose files" })).toHaveProperty(
      "disabled",
      true
    )
    expect(
      screen.getByRole("button", { name: "Choose folder" })
    ).toHaveProperty("disabled", true)
  })
})
