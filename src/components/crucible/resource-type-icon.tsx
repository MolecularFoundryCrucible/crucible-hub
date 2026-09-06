import {
  DatasetIcon,
  InstrumentIcon,
  PersonIcon,
  ProjectIcon,
  SampleIcon,
} from "@/components/crucible/icons"

type ResourceType = "dataset" | "instrument" | "person" | "project" | "sample"

const icons = {
  dataset: DatasetIcon,
  instrument: InstrumentIcon,
  person: PersonIcon,
  project: ProjectIcon,
  sample: SampleIcon,
} satisfies Record<ResourceType, typeof DatasetIcon>

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
      className={className}
      data-icon={dataIcon}
      data-resource-type={type}
      aria-hidden="true"
    />
  )
}
