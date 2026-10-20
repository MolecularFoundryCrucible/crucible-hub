import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import type { createJsonEditor } from "./json-editor-view"

type JsonEditorHandle = ReturnType<typeof createJsonEditor>

export function JsonEditor({
  ariaLabel,
  className,
  disabled = false,
  invalid,
  onChange,
  validate,
  value,
}: {
  ariaLabel: string
  className?: string
  disabled?: boolean
  invalid?: boolean
  onChange: (value: string) => void
  validate?: (value: string) => string | null
  value: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const editor = useRef<JsonEditorHandle>(null)
  const initial = useRef({ disabled, onChange, validate, value })
  initial.current = { disabled, onChange, validate, value }

  useEffect(() => {
    let cancelled = false
    void import("./json-editor-view").then(({ createJsonEditor }) => {
      if (cancelled || !container.current) return
      const current = initial.current
      editor.current = createJsonEditor(container.current, {
        ariaLabel,
        disabled: current.disabled,
        doc: current.value,
        onChange: current.onChange,
        validate: current.validate,
      })
    })
    return () => {
      cancelled = true
      editor.current?.destroy()
      editor.current = null
    }
  }, [ariaLabel])

  useEffect(() => {
    editor.current?.setDoc(value)
  }, [value])

  useEffect(() => {
    editor.current?.setDisabled(disabled)
  }, [disabled])

  useEffect(() => {
    editor.current?.setOnChange(onChange)
  }, [onChange])

  return (
    <div
      aria-invalid={invalid || undefined}
      className={cn(
        "h-metadata-editor-height resize-y overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 aria-invalid:border-destructive",
        disabled && "opacity-50",
        className
      )}
      data-slot="json-editor"
      ref={container}
    />
  )
}
