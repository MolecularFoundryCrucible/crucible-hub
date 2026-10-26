import { describe, expect, it } from "vitest"

import {
  inspectorCookie,
  parseViewerPresentation,
  sidebarCookie,
  themeCookie,
} from "./viewer-presentation"
import { timeZoneCookie } from "./time-zone"
import { windowClassCookie } from "./window-class"

describe("parseViewerPresentation", () => {
  it("reads valid presentation cookies", () => {
    expect(
      parseViewerPresentation({
        [inspectorCookie]: "collapsed",
        [sidebarCookie]: "collapsed",
        [themeCookie]: "dark",
        [timeZoneCookie]: "America/Los_Angeles",
        [windowClassCookie]: "medium",
      })
    ).toEqual({
      inspectorOpen: false,
      sidebarOpen: false,
      theme: "dark",
      timeZone: "America/Los_Angeles",
      windowClass: "medium",
    })
  })

  it("falls back to defaults for missing or invalid values", () => {
    expect(
      parseViewerPresentation({
        [inspectorCookie]: "sideways",
        [sidebarCookie]: "sideways",
        [themeCookie]: "purple",
        [timeZoneCookie]: "Mars/Olympus",
        [windowClassCookie]: "tablet",
      })
    ).toEqual({
      inspectorOpen: true,
      sidebarOpen: true,
      theme: "system",
      timeZone: undefined,
      windowClass: "expanded",
    })
    expect(parseViewerPresentation({})).toEqual({
      inspectorOpen: true,
      sidebarOpen: true,
      theme: "system",
      timeZone: undefined,
      windowClass: "expanded",
    })
  })
})
