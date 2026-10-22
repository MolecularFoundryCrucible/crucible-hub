import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  InspectorPaneProvider,
  useInspectorPane,
  useRememberedPreviewNavigation,
} from "./inspector-pane"

vi.mock("@/lib/viewer-presentation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  writePresentationCookie: vi.fn(),
}))

vi.mock("@/lib/motion", () => ({ motionDuration: () => 180 }))

const { writePresentationCookie } = await import("@/lib/viewer-presentation")

afterEach(() => vi.mocked(writePresentationCookie).mockReset())

function wrapper({ children }: { children: ReactNode }) {
  return <InspectorPaneProvider initialOpen>{children}</InspectorPaneProvider>
}

function usePane() {
  const pane = useInspectorPane()
  const navigation = useRememberedPreviewNavigation()
  return { navigation, pane: pane! }
}

describe("InspectorPaneProvider", () => {
  it("remembers the last preview until it is closed", () => {
    const { result } = renderHook(usePane, { wrapper })
    expect(result.current.navigation).toBeNull()

    act(() =>
      result.current.pane.remember({
        identity: { kind: "sample", mfid: "sample-a", name: "Sample A" },
        mfid: "sample-a",
      })
    )
    expect(result.current.navigation?.preview).toBe("sample-a")
    expect(result.current.navigation?.previewIdentity?.name).toBe("Sample A")

    act(() => result.current.navigation?.close())
    expect(result.current.navigation).toBeNull()
  })

  it("opens related previews in the pane and goes back through them", () => {
    const { result } = renderHook(usePane, { wrapper })
    act(() => result.current.pane.remember({ mfid: "sample-a" }))

    act(() => result.current.navigation?.open("dataset-b"))
    expect(result.current.navigation?.preview).toBe("dataset-b")
    expect(result.current.navigation?.previous).toBe("sample-a")

    act(() =>
      result.current.navigation?.open("sample-a", undefined, undefined, true)
    )
    expect(result.current.navigation?.preview).toBe("sample-a")
    expect(result.current.navigation?.previous).toBeUndefined()
  })

  it("keeps the Back trail of the page it came from", () => {
    const { result } = renderHook(usePane, { wrapper })
    act(() =>
      result.current.pane.remember({
        mfid: "dataset-c",
        previous: ["sample-a", "dataset-b"],
      })
    )
    expect(result.current.navigation?.previous).toBe("dataset-b")

    act(() => result.current.pane.remember({ mfid: "dataset-c" }))
    expect(result.current.navigation?.previous).toBe("dataset-b")

    act(() =>
      result.current.navigation?.open("dataset-b", undefined, undefined, true)
    )
    expect(result.current.navigation?.preview).toBe("dataset-b")
    expect(result.current.navigation?.previous).toBe("sample-a")
  })

  it("remembers whether the pane is shown", () => {
    const { result } = renderHook(usePane, { wrapper })
    expect(result.current.pane.open).toBe(true)

    act(() => result.current.pane.setOpen(false))
    expect(result.current.pane.open).toBe(false)
    expect(writePresentationCookie).toHaveBeenCalledWith(
      "crucible_hub_inspector",
      "collapsed"
    )
  })

  it("slides previews out when hidden and keeps the pane's preview", () => {
    vi.useFakeTimers()
    const { result } = renderHook(usePane, { wrapper })
    const close = vi.fn()
    act(() => {
      result.current.pane.registerHostPreview(close)
      result.current.pane.remember({ mfid: "sample-a", previous: ["sample-b"] })
    })

    act(() => result.current.pane.setOpen(false))
    expect(result.current.pane.motion).toBe("hiding")
    expect(close).not.toHaveBeenCalled()
    act(() => vi.runAllTimers())
    expect(result.current.pane.motion).toBeNull()
    expect(close).toHaveBeenCalledOnce()

    act(() => result.current.pane.setOpen(true))
    expect(result.current.pane.motion).toBe("showing")
    expect(result.current.navigation?.preview).toBe("sample-a")
    expect(result.current.navigation?.previous).toBe("sample-b")
    vi.useRealTimers()
  })

  it("keeps a page preview when shown again before it slides out", () => {
    vi.useFakeTimers()
    const { result } = renderHook(usePane, { wrapper })
    const close = vi.fn()
    act(() => void result.current.pane.registerHostPreview(close))

    act(() => result.current.pane.setOpen(false))
    act(() => result.current.pane.setOpen(true))
    act(() => vi.runAllTimers())
    expect(close).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
