import { describe, expect, it, vi } from "vitest"

import { keyboardShortcutGroups } from "./keyboard-shortcuts"

vi.mock("@tanstack/react-router", () => ({ useNavigate: vi.fn() }))

function descriptions(pathname: string, projectActive = false) {
  return keyboardShortcutGroups(pathname, projectActive).flatMap((group) =>
    group.shortcuts.map((shortcut) => shortcut.description)
  )
}

function keys(pathname: string) {
  return keyboardShortcutGroups(pathname, false).flatMap((group) =>
    group.shortcuts.map((shortcut) => shortcut.keys.join(" "))
  )
}

describe("keyboardShortcutGroups", () => {
  it("never lists the same keys twice", () => {
    for (const pathname of [
      "/",
      "/datasets/a",
      "/datasets/a/graph",
      "/samples/a",
      "/projects/a",
      "/instruments/a",
    ]) {
      const listed = keys(pathname)
      expect(new Set(listed).size).toBe(listed.length)
    }
  })

  it("gives G then P to Processing on a dataset and Projects elsewhere", () => {
    expect(descriptions("/datasets/a")).toContain("Processing")
    expect(descriptions("/datasets/a")).not.toContain("Projects")
    expect(descriptions("/samples/a")).toContain("Projects")
    expect(descriptions("/samples/a")).not.toContain("Processing")
  })

  it("offers project search only inside a project", () => {
    expect(descriptions("/", false)).not.toContain("Search this project")
    expect(descriptions("/projects/a", true)).toContain("Search this project")
  })
})
