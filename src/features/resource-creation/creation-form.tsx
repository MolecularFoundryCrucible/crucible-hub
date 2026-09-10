import { useEffect } from "react"

import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { currentLocalDateTimeInput } from "@/lib/format"

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
