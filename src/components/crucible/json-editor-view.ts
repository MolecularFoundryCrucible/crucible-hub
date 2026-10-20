import { Compartment, EditorState } from "@codemirror/state"
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  ensureSyntaxTree,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language"
import { json } from "@codemirror/lang-json"
import { linter, lintGutter } from "@codemirror/lint"
import type { Diagnostic } from "@codemirror/lint"
import { tags } from "@lezer/highlight"

export type JsonEditorOptions = {
  ariaLabel: string
  disabled: boolean
  doc: string
  onChange: (value: string) => void
  validate?: (value: string) => string | null
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--code-property)" },
  { tag: tags.string, color: "var(--code-string)" },
  { tag: tags.number, color: "var(--code-number)" },
  { tag: [tags.bool, tags.null], color: "var(--code-literal)" },
  {
    tag: [tags.brace, tags.squareBracket, tags.separator],
    color: "var(--muted-foreground)",
  },
])

const theme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
    fontSize: "var(--text-supporting)",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.5" },
  ".cm-content": { caretColor: "var(--foreground)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid var(--border)",
    color: "var(--muted-foreground)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklch, var(--muted), transparent 40%)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklch, var(--ring), transparent 60%)",
  },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in oklch, var(--ring), transparent 70%)",
    outline: "none",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    color: "var(--popover-foreground)",
  },
})

function lineColumn(state: EditorState, position: number) {
  const line = state.doc.lineAt(position)
  return `line ${line.number}, column ${position - line.from + 1}`
}

export function jsonDiagnostics(
  state: EditorState,
  validate?: (value: string) => string | null
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const tree =
    ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  tree.iterate({
    enter(node) {
      if (node.type.isError) {
        const from = Math.min(node.from, state.doc.length)
        diagnostics.push({
          from,
          message: `JSON syntax error at ${lineColumn(state, from)}.`,
          severity: "error",
          to: Math.min(Math.max(node.to, from + 1), state.doc.length),
        })
        return false
      }
      if (node.name !== "Object") return undefined
      const seen = new Set<string>()
      for (
        let property = node.node.firstChild;
        property;
        property = property.nextSibling
      ) {
        if (property.name !== "Property") continue
        const name = property.getChild("PropertyName")
        if (!name) continue
        const raw = state.sliceDoc(name.from, name.to)
        let key = raw
        try {
          key = JSON.parse(raw) as string
        } catch {
          continue
        }
        if (seen.has(key)) {
          diagnostics.push({
            from: name.from,
            message: `"${key}" appears more than once. Only the last value would be kept.`,
            severity: "error",
            to: name.to,
          })
        }
        seen.add(key)
      }
      return undefined
    },
  })
  if (diagnostics.length > 0) return diagnostics
  const text = state.doc.toString()
  try {
    JSON.parse(text)
  } catch {
    return [
      {
        from: 0,
        message: "Enter valid JSON.",
        severity: "error",
        to: Math.min(1, state.doc.length),
      },
    ]
  }
  const message = validate?.(text)
  return message
    ? [
        {
          from: 0,
          message,
          severity: "error",
          to: Math.min(1, state.doc.length),
        },
      ]
    : []
}

export function createJsonEditor(
  parent: HTMLElement,
  options: JsonEditorOptions
) {
  const editable = new Compartment()
  let onChange = options.onChange
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        lintGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        json(),
        syntaxHighlighting(highlightStyle),
        linter((current) => jsonDiagnostics(current.state, options.validate), {
          delay: 300,
        }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
        theme,
        EditorView.contentAttributes.of({
          "aria-label": options.ariaLabel,
          "aria-multiline": "true",
        }),
        editable.of(EditorView.editable.of(!options.disabled)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString())
        }),
      ],
    }),
  })

  return {
    destroy: () => view.destroy(),
    setDisabled: (disabled: boolean) =>
      view.dispatch({
        effects: editable.reconfigure(EditorView.editable.of(!disabled)),
      }),
    setDoc: (doc: string) => {
      if (doc === view.state.doc.toString()) return
      view.dispatch({
        changes: { from: 0, insert: doc, to: view.state.doc.length },
      })
    },
    setOnChange: (next: (value: string) => void) => {
      onChange = next
    },
  }
}
