import {
  DataFormatFieldIcon,
  DataTypeFieldIcon,
  DescriptionFieldIcon,
  LocationFieldIcon,
  ManufacturerFieldIcon,
  MeasurementFieldIcon,
  ModelFieldIcon,
  OrganizationFieldIcon,
  SessionFieldIcon,
  StatusFieldIcon,
  TimestampFieldIcon,
  TypeFieldIcon,
} from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { cn } from "@/lib/utils"

export type SummaryFieldType =
  | "data-format"
  | "data-type"
  | "description"
  | "instrument"
  | "location"
  | "manufacturer"
  | "measurement"
  | "model"
  | "organization"
  | "project"
  | "session"
  | "status"
  | "timestamp"
  | "type"

const fieldIcons = {
  "data-format": DataFormatFieldIcon,
  "data-type": DataTypeFieldIcon,
  description: DescriptionFieldIcon,
  location: LocationFieldIcon,
  manufacturer: ManufacturerFieldIcon,
  measurement: MeasurementFieldIcon,
  model: ModelFieldIcon,
  organization: OrganizationFieldIcon,
  session: SessionFieldIcon,
  status: StatusFieldIcon,
  timestamp: TimestampFieldIcon,
  type: TypeFieldIcon,
} as const

export function SummaryFieldIcon({
  className,
  "data-icon": dataIcon,
  type,
}: {
  className?: string
  "data-icon"?: "inline-end" | "inline-start"
  type: SummaryFieldType
}) {
  if (type === "project" || type === "instrument") {
    return (
      <ResourceTypeIcon
        className={cn("mt-0.5 size-4 shrink-0", className)}
        data-icon={dataIcon}
        type={type}
      />
    )
  }
  const Icon = fieldIcons[type]
  return (
    <Icon
      aria-hidden="true"
      className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground", className)}
      data-icon={dataIcon}
      data-summary-field-icon={type}
    />
  )
}
