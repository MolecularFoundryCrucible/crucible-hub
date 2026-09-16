import {
  DataIcon,
  DatasetIcon,
  InstrumentIcon,
  PersonIcon,
  ProjectIcon,
  PublicAccessIcon,
  SampleIcon,
  ServiceAccountIcon,
  SystemPrincipalIcon,
  UnknownPrincipalIcon,
} from "@/components/crucible/icons"
import { cn } from "@/lib/utils"

type ResourceType = "dataset" | "instrument" | "person" | "project" | "sample"
type PrincipalType =
  | "instrument"
  | "project"
  | "public"
  | "service_account"
  | "system"
  | "unknown"
  | "user"

const icons = {
  dataset: DatasetIcon,
  instrument: InstrumentIcon,
  person: PersonIcon,
  project: ProjectIcon,
  sample: SampleIcon,
} satisfies Record<ResourceType, typeof DatasetIcon>

const iconClasses = {
  dataset: "text-(--resource-dataset)",
  instrument: "text-(--resource-instrument)",
  person: "text-(--resource-person)",
  project: "text-(--resource-project)",
  sample: "text-(--resource-sample)",
} satisfies Record<ResourceType, string>

const principalIcons = {
  instrument: InstrumentIcon,
  project: ProjectIcon,
  public: PublicAccessIcon,
  service_account: ServiceAccountIcon,
  system: SystemPrincipalIcon,
  unknown: UnknownPrincipalIcon,
  user: PersonIcon,
} satisfies Record<PrincipalType, typeof DatasetIcon>

const principalIconClasses = {
  instrument: iconClasses.instrument,
  project: iconClasses.project,
  public: "text-muted-foreground",
  service_account: "text-(--resource-service-account)",
  system: "text-muted-foreground",
  unknown: "text-muted-foreground",
  user: iconClasses.person,
} satisfies Record<PrincipalType, string>

export function DataCollectionIcon({ className }: { className?: string }) {
  return (
    <DataIcon
      aria-hidden="true"
      className={cn("text-(--resource-data)", className)}
      data-resource-collection="data"
    />
  )
}

export function ResourceTypeIcon({
  className,
  "data-icon": dataIcon,
  type,
}: {
  className?: string
  "data-icon"?: "inline-end" | "inline-start"
  type: ResourceType
}) {
  const Icon = icons[type]
  return (
    <Icon
      className={cn(iconClasses[type], className)}
      data-icon={dataIcon}
      data-resource-type={type}
      aria-hidden="true"
    />
  )
}

export function PrincipalTypeIcon({
  className,
  "data-icon": dataIcon,
  label,
  type,
}: {
  className?: string
  "data-icon"?: "inline-end" | "inline-start"
  label?: string
  type: PrincipalType
}) {
  const Icon = principalIcons[type]
  return (
    <Icon
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("size-4 shrink-0", principalIconClasses[type], className)}
      data-icon={dataIcon}
      data-principal-type={type}
      role={label ? "img" : undefined}
    />
  )
}

export type { PrincipalType, ResourceType }
