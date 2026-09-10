import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"

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
