import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createResourcePreviewOwnerMarker,
  globalDataPreviewOrigin,
  isDirectCanonicalNavigation,
  isPlainPreviewNavigation,
  resolveResourcePreview,
  resolveResourcePreviewTrail,
  resourcePreviewSearchSchema,
  updateResourcePreviewTrail,
} from "./resource-preview-navigation"

const origin = "01J6Y8N4Q2R7M9K3T5V0W1X2Z5"

afterEach(() => vi.unstubAllGlobals())

describe("resource preview ownership", () => {
  it("creates fresh markers without requiring randomUUID", () => {
    let fill = 0
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(fill)
      fill += 1
      return bytes
    })
    vi.stubGlobal("crypto", { getRandomValues })

    const first = createResourcePreviewOwnerMarker()
    const second = createResourcePreviewOwnerMarker()

    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(second).toMatch(/^[0-9a-f]{32}$/)
    expect(second).not.toBe(first)
    expect(getRandomValues).toHaveBeenCalledTimes(2)
  })
})

describe("resource preview validation", () => {
  it("preserves valid identifiers without treating the old fallback as special", () => {
    expect(resourcePreviewSearchSchema.parse({ preview: origin })).toEqual({
      preview: origin,
    })
    expect(resolveResourcePreview("invalid")).toEqual({
      preview: "invalid",
      invalidPreview: false,
    })
  })

  it.each(["", "../private", "with spaces", "x".repeat(256), 42])(
    "exposes malformed input as an invalid selection without a request target",
    (value) => {
      const search = resourcePreviewSearchSchema.parse({ preview: value })

      expect(resolveResourcePreview(search.preview)).toEqual({
        preview: undefined,
        invalidPreview: true,
      })
    }
  )

  it("distinguishes an absent preview from malformed input", () => {
    const search = resourcePreviewSearchSchema.parse({})

    expect(resolveResourcePreview(search.preview)).toEqual({
      preview: undefined,
      invalidPreview: false,
    })
  })
})

describe("resource preview trail", () => {
  const trail = {
    hostKind: "resource" as const,
    owner: "runtime-owner",
    origin,
    previous: ["first", "second"],
    returnIndex: 4,
    returnKey: "host-scroll-key",
  }

  it("accepts only the current runtime owner and route origin", () => {
    expect(
      resolveResourcePreviewTrail(trail, "runtime-owner", "resource", origin)
    ).toEqual(trail)
    expect(
      resolveResourcePreviewTrail(trail, "other-owner", "resource", origin)
    ).toBe(undefined)
    expect(
      resolveResourcePreviewTrail(
        trail,
        "runtime-owner",
        "resource",
        "other-origin"
      )
    ).toBe(undefined)
    expect(
      resolveResourcePreviewTrail(
        trail,
        "runtime-owner",
        "project-data",
        origin
      )
    ).toBe(undefined)
    expect(
      resolveResourcePreviewTrail(trail, "runtime-owner", "data", origin)
    ).toBe(undefined)
  })

  it("isolates the stable global Data host from other preview hosts", () => {
    const dataTrail = {
      ...trail,
      hostKind: "data" as const,
      origin: globalDataPreviewOrigin,
    }

    expect(globalDataPreviewOrigin).toBe("global-data")
    expect(
      resolveResourcePreviewTrail(
        dataTrail,
        "runtime-owner",
        "data",
        globalDataPreviewOrigin
      )
    ).toEqual(dataTrail)
    expect(
      resolveResourcePreviewTrail(
        dataTrail,
        "runtime-owner",
        "resource",
        globalDataPreviewOrigin
      )
    ).toBe(undefined)
    expect(
      resolveResourcePreviewTrail(
        dataTrail,
        "runtime-owner",
        "project-data",
        globalDataPreviewOrigin
      )
    ).toBe(undefined)
    expect(
      resolveResourcePreviewTrail(
        dataTrail,
        "runtime-owner",
        "data",
        "other-data-host"
      )
    ).toBe(undefined)
  })

  it("keeps legacy trails scoped to resource hosts", () => {
    const { hostKind: _, ...legacyTrail } = trail

    expect(
      resolveResourcePreviewTrail(
        legacyTrail,
        "runtime-owner",
        "resource",
        origin
      )
    ).toEqual(trail)
    expect(
      resolveResourcePreviewTrail(legacyTrail, "runtime-owner", "data", origin)
    ).toBe(undefined)
  })

  it("rejects malformed and oversized restored trails", () => {
    expect(
      resolveResourcePreviewTrail(
        { ...trail, previous: ["valid", "../invalid"] },
        "runtime-owner",
        "resource",
        origin
      )
    ).toBe(undefined)
    expect(
      resolveResourcePreviewTrail(
        {
          ...trail,
          previous: Array.from({ length: 21 }, (_, index) => `item-${index}`),
        },
        "runtime-owner",
        "resource",
        origin
      )
    ).toBe(undefined)
  })

  it("retains cycles while bounding exploration to twenty prior selections", () => {
    const previous = Array.from({ length: 20 }, (_, index) => `item-${index}`)
    const updated = updateResourcePreviewTrail(previous, "current", "item-0")

    expect(updated).toHaveLength(20)
    expect(updated).toEqual([...previous.slice(1), "current"])
    expect(updateResourcePreviewTrail(updated, "item-0", "item-0")).toEqual(
      updated
    )
    expect(updateResourcePreviewTrail(updated, "item-0", "back", true)).toEqual(
      updated.slice(0, -1)
    )
  })
})

describe("resource preview link activation", () => {
  const click = {
    altKey: false,
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: "",
  }

  it("handles only same-tab primary activation as an in-page preview", () => {
    expect(isPlainPreviewNavigation(click)).toBe(true)
    expect(isPlainPreviewNavigation({ ...click, ctrlKey: true })).toBe(false)
    expect(isPlainPreviewNavigation({ ...click, metaKey: true })).toBe(false)
    expect(isPlainPreviewNavigation({ ...click, shiftKey: true })).toBe(false)
    expect(isPlainPreviewNavigation({ ...click, button: 1 })).toBe(false)
    expect(isPlainPreviewNavigation({ ...click, target: "_blank" })).toBe(false)
  })

  it("navigates directly in the same page on Ctrl or Meta primary click", () => {
    expect(isDirectCanonicalNavigation(click)).toBe(false)
    expect(isDirectCanonicalNavigation({ ...click, ctrlKey: true })).toBe(true)
    expect(isDirectCanonicalNavigation({ ...click, metaKey: true })).toBe(true)
    expect(
      isDirectCanonicalNavigation({ ...click, ctrlKey: true, shiftKey: true })
    ).toBe(false)
    expect(
      isDirectCanonicalNavigation({ ...click, ctrlKey: true, altKey: true })
    ).toBe(false)
    expect(
      isDirectCanonicalNavigation({ ...click, ctrlKey: true, button: 1 })
    ).toBe(false)
    expect(
      isDirectCanonicalNavigation({
        ...click,
        ctrlKey: true,
        target: "_blank",
      })
    ).toBe(false)
  })
})
