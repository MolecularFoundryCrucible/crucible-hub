import { describe, expect, it } from "vitest"

import {
  parseViewerPresentation,
  sidebarCookie,
  themeCookie,
} from "./viewer-presentation"
import { timeZoneCookie } from "./time-zone"

describe("parseViewerPresentation", () => {
  it("reads valid presentation cookies", () => {
    expect(
      parseViewerPresentation({
        [sidebarCookie]: "collapsed",
        [themeCookie]: "dark",
        [timeZoneCookie]: "America/Los_Angeles",
      })
    ).toEqual({
      sidebarOpen: false,
      theme: "dark",
      timeZone: "America/Los_Angeles",
    })
  })

  it("falls back to defaults for missing or invalid values", () => {
    expect(
      parseViewerPresentation({
        [sidebarCookie]: "sideways",
        [themeCookie]: "purple",
        [timeZoneCookie]: "Mars/Olympus",
      })
    ).toEqual({ sidebarOpen: true, theme: "system", timeZone: undefined })
    expect(parseViewerPresentation({})).toEqual({
      sidebarOpen: true,
      theme: "system",
      timeZone: undefined,
    })
  })
})
