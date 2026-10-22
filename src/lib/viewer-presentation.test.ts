import { describe, expect, it } from "vitest"

import {
  inspectorCookie,
  parseViewerPresentation,
  sidebarCookie,
  themeCookie,
} from "./viewer-presentation"
import { timeZoneCookie } from "./time-zone"

describe("parseViewerPresentation", () => {
  it("reads valid presentation cookies", () => {
    expect(
      parseViewerPresentation({
        [inspectorCookie]: "collapsed",
        [sidebarCookie]: "collapsed",
        [themeCookie]: "dark",
        [timeZoneCookie]: "America/Los_Angeles",
      })
    ).toEqual({
      inspectorOpen: false,
      sidebarOpen: false,
      theme: "dark",
      timeZone: "America/Los_Angeles",
    })
  })

  it("falls back to defaults for missing or invalid values", () => {
    expect(
      parseViewerPresentation({
        [inspectorCookie]: "sideways",
        [sidebarCookie]: "sideways",
        [themeCookie]: "purple",
        [timeZoneCookie]: "Mars/Olympus",
      })
    ).toEqual({
      inspectorOpen: true,
      sidebarOpen: true,
      theme: "system",
      timeZone: undefined,
    })
    expect(parseViewerPresentation({})).toEqual({
      inspectorOpen: true,
      sidebarOpen: true,
      theme: "system",
      timeZone: undefined,
    })
  })
})
