import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ThumbnailViewer } from "./thumbnail-viewer"
import type { WorkspaceDatasetThumbnail } from "@/data/crucible/workspace-source"

const thumbnails = ["Overview", "Detail", "Edge"].map(
  (thumbnail_name, id): WorkspaceDatasetThumbnail => ({
    id,
    mime_type: "image/jpeg",
    thumbnail_b64str: "AAAA",
    thumbnail_name,
  })
)

function Harness({ start }: { start: number | null }) {
  const [index, setIndex] = useState(start)
  return (
    <ThumbnailViewer
      index={index}
      onIndexChange={setIndex}
      thumbnails={thumbnails}
    />
  )
}

describe("ThumbnailViewer", () => {
  afterEach(cleanup)

  it("stays closed without a selection", () => {
    render(<Harness start={null} />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("shows the chosen image and steps through the others", async () => {
    render(<Harness start={0} />)
    const dialog = await screen.findByRole("dialog")
    expect(screen.getByRole("img", { name: "Overview" })).toBeTruthy()
    expect(screen.getByText("1 of 3")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")
    ).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("img", { name: "Detail" })).toBeTruthy()

    fireEvent.keyDown(dialog, { key: "ArrowRight" })
    expect(screen.getByRole("img", { name: "Edge" })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")
    ).toBe(true)

    fireEvent.keyDown(dialog, { key: "ArrowLeft" })
    expect(screen.getByText("2 of 3")).toBeTruthy()
  })

  it("closes from the close button", async () => {
    render(<Harness start={1} />)
    fireEvent.click(await screen.findByRole("button", { name: "Close" }))
    expect(screen.queryByRole("img", { name: "Detail" })).toBeNull()
  })
})
