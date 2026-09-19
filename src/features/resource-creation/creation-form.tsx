import { useEffect } from "react"
import { z } from "zod"

import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"
import { currentLocalDateTimeInput } from "@/lib/format"

const workspaceSelectionSchema = z.object({
  context: z.string().nullable(),
  kind: z.enum(["dataset", "instrument", "person", "project", "sample"]),
  name: z.string(),
  unique_id: z.string(),
})

export function workspaceSelectionOf(kind: WorkspaceSearchResult["kind"]) {
  return workspaceSelectionSchema.refine((value) => value.kind === kind)
}

type TimestampForm<TValues extends { timestamp: string }> = {
  reset: (values?: TValues) => void
  state: { values: TValues }
}

export function CreationFormSection({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <FieldSet className="border-t pt-5">
      <FieldLegend>{title}</FieldLegend>
      <FieldGroup>{children}</FieldGroup>
    </FieldSet>
  )
}

export function useCreationTimestampDefault<
  TValues extends { timestamp: string },
>(form: TimestampForm<TValues>) {
  useEffect(() => {
    if (form.state.values.timestamp) return
    form.reset({
      ...form.state.values,
      timestamp: currentLocalDateTimeInput(),
    })
  }, [form])
}
