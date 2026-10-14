import { describe, expect, it } from "vitest"

import {
  creationMetadataResult,
  emptyCreationMetadata,
  metadataFieldValue,
} from "./creation-metadata"

function rows(...pairs: [string, string][]) {
  return {
    ...emptyCreationMetadata(),
    rows: pairs.map(([name, value], index) => ({
      id: String(index),
      name,
      value,
    })),
  }
}

describe("creation metadata", () => {
  it("infers numbers and booleans but keeps identifiers as text", () => {
    expect(metadataFieldValue("42")).toBe(42)
    expect(metadataFieldValue("-1.5e3")).toBe(-1500)
    expect(metadataFieldValue("true")).toBe(true)
    expect(metadataFieldValue("007")).toBe("007")
    expect(metadataFieldValue(" 10 K ")).toBe("10 K")
  })

  it("builds metadata from named fields and skips empty rows", () => {
    expect(
      creationMetadataResult(
        rows(["temperature", "300"], ["", ""], ["detector", "Pilatus"])
      )
    ).toEqual({
      metadata: { detector: "Pilatus", temperature: 300 },
      ok: true,
    })
    expect(creationMetadataResult(emptyCreationMetadata())).toEqual({
      metadata: null,
      ok: true,
    })
  })

  it("rejects unnamed and duplicate fields", () => {
    expect(creationMetadataResult(rows(["", "5"])).ok).toBe(false)
    expect(creationMetadataResult(rows(["a", "1"], [" a", "2"])).ok).toBe(false)
  })

  it("validates JSON drafts", () => {
    const json = (text: string) => ({
      ...emptyCreationMetadata(),
      json: text,
      mode: "json" as const,
    })
    expect(creationMetadataResult(json('{"beam": {"energy": 7}}'))).toEqual({
      metadata: { beam: { energy: 7 } },
      ok: true,
    })
    expect(creationMetadataResult(json("[1, 2]")).ok).toBe(false)
    expect(creationMetadataResult(json("{")).ok).toBe(false)
    expect(creationMetadataResult(json("{}"))).toEqual({
      metadata: null,
      ok: true,
    })
  })
})
