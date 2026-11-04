import { describe, expect, it } from "vitest"

import { identityScope } from "./query-keys"
import {
  isDefaultResourceSequence,
  resolveResourceSequence,
  resourceSequenceAffiliation,
} from "./resource-sequence"

const project = { unique_id: "project" }

describe("resource sequence defaults", () => {
  it("starts in the same project and type, oldest first", () => {
    expect(
      resolveResourceSequence(undefined, { kind: "dataset", project })
    ).toEqual({ direction: "asc", scope: "project_subtype", sort: "created" })
  })

  it("falls back to the same type when the saved scope does not apply", () => {
    for (const scope of ["project", "project_subtype", "owner"] as const) {
      expect(
        resolveResourceSequence(
          { direction: "desc", scope, sort: "name" },
          { kind: "sample", owner: null, project: null }
        )
      ).toEqual({ direction: "desc", scope: "subtype", sort: "name" })
    }
    expect(
      resolveResourceSequence(
        { direction: "asc", scope: "instrument", sort: "name" },
        { kind: "sample" }
      ).scope
    ).toBe("subtype")
  })

  it("keeps a saved scope that applies", () => {
    expect(
      resolveResourceSequence(
        { direction: "desc", scope: "instrument", sort: "updated" },
        { kind: "dataset" }
      )
    ).toEqual({ direction: "desc", scope: "instrument", sort: "updated" })
  })

  it("recognizes the built-in default", () => {
    expect(
      isDefaultResourceSequence({
        direction: "asc",
        scope: "project_subtype",
        sort: "created",
      })
    ).toBe(true)
    expect(
      isDefaultResourceSequence({
        direction: "desc",
        scope: "project_subtype",
        sort: "created",
      })
    ).toBe(false)
  })

  it("leaves public records out unless they are wanted or already open", () => {
    const scope = identityScope("server", "account", "normal")
    const resource = { kind: "dataset", public: false } as const
    expect(
      resourceSequenceAffiliation({ includePublic: false, resource, scope })
    ).toBe("member")
    expect(
      resourceSequenceAffiliation({ includePublic: true, resource, scope })
    ).toBeUndefined()
    expect(
      resourceSequenceAffiliation({
        includePublic: false,
        resource: { ...resource, public: true },
        scope,
      })
    ).toBeUndefined()
    expect(
      resourceSequenceAffiliation({
        includePublic: false,
        resource,
        scope: identityScope("server", "account", "elevated"),
      })
    ).toBeUndefined()
  })
})
