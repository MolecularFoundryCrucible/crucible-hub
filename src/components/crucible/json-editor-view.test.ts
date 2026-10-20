import { EditorState } from "@codemirror/state"
import { json } from "@codemirror/lang-json"
import { describe, expect, it } from "vitest"

import { jsonDiagnostics } from "./json-editor-view"

function diagnose(doc: string, validate?: (value: string) => string | null) {
  return jsonDiagnostics(
    EditorState.create({ doc, extensions: [json()] }),
    validate
  )
}

describe("JSON editor diagnostics", () => {
  it("accepts valid JSON", () => {
    expect(diagnose('{\n  "pressure": 2\n}')).toEqual([])
  })

  it("points at the line and column of a syntax error", () => {
    const [diagnostic] = diagnose('{\n  "pressure": 2\n  "phase": "solid"\n}')
    expect(diagnostic.severity).toBe("error")
    expect(diagnostic.message).toMatch(
      /^JSON syntax error at line 3, column \d+\.$/
    )
  })

  it("flags duplicate keys that would silently drop a value", () => {
    const doc = '{"pressure": 2, "pressure": 3}'
    const [diagnostic] = diagnose(doc)
    expect(diagnostic.message).toBe(
      '"pressure" appears more than once. Only the last value would be kept.'
    )
    expect(doc.slice(diagnostic.from, diagnostic.to)).toBe('"pressure"')
    expect(diagnostic.from).toBe(doc.lastIndexOf('"pressure"'))
  })

  it("reports metadata rules once the JSON parses", () => {
    expect(diagnose("[1, 2]", () => "Use a JSON object.")[0]?.message).toBe(
      "Use a JSON object."
    )
  })
})
