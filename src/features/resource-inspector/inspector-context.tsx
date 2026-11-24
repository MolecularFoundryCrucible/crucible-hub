import type { ReactNode } from "react"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { personIsServiceAccount } from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { StatusBadge } from "@/components/crucible/status-badge"
import {
  SummaryFieldIcon,
  SummaryFieldItem,
} from "@/components/crucible/summary-field-icon"
import { VisibilityBadge } from "@/components/crucible/visibility-badge"
import { TruncatedText } from "@/components/ui/truncation-tooltip"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { resourceDisplayName } from "@/lib/resource-name"
import { cn } from "@/lib/utils"

export function InspectorContext({
  resource,
}: {
  resource: WorkspaceResourceDetail
}) {
  const fields = inspectorContextFields(resource)

  return (
    <section aria-labelledby="inspector-context-heading">
      <h3 className="mb-3 text-title-section" id="inspector-context-heading">
        Context
      </h3>
      <dl className="grid min-w-0 grid-cols-2 gap-3">
        {fields.map((field) => (
          <SummaryFieldItem
            className={cn(
              field.fullWidth && "col-span-2",
              field.colStart1 && "col-start-1"
            )}
            icon={field.icon}
            key={field.label}
            label={field.label}
          >
            {field.value || "-"}
          </SummaryFieldItem>
        ))}
      </dl>
    </section>
  )
}

type InspectorContextField = {
  colStart1?: boolean
  fullWidth?: boolean
  icon?: ReactNode
  label: string
  value: ReactNode
}

function inspectorContextFields(
  resource: WorkspaceResourceDetail
): readonly InspectorContextField[] {
  const ownerIcon = (
    <IdentityFieldIcon
      accountType={
        resource.owner && personIsServiceAccount(resource.owner)
          ? "service-account"
          : "person"
      }
      type="owner"
    />
  )
  const owner = resource.owner ? (
    <PersonLink nameStyle="abbreviated" person={resource.owner} />
  ) : null
  const createdField: InspectorContextField = {
    colStart1: true,
    icon: <IdentityFieldIcon type="created" />,
    label: "Created",
    value: <LocalDateTime fallback="-" value={resource.creation_time} />,
  }
  const updatedField: InspectorContextField = {
    icon: <IdentityFieldIcon type="updated" />,
    label: "Updated",
    value: <LocalDateTime fallback="-" value={resource.modification_time} />,
  }

  switch (resource.kind) {
    case "dataset": {
      const projectName = resource.project
        ? resourceDisplayName("project", resource.project.title, {
            identifier: resource.project.project_id,
            mfid: resource.project.unique_id,
          })
        : null
      const instrumentName = resource.instrument
        ? resourceDisplayName(
            "instrument",
            resource.instrument.instrument_name,
            {
              identifier: resource.instrument.instrument_id,
              mfid: resource.instrument.unique_id,
            }
          )
        : null
      return [
        {
          icon: <SummaryFieldIcon type="measurement" />,
          label: "Measurement",
          value: resource.measurement,
        },
        {
          icon: <SummaryFieldIcon type="project" />,
          label: "Project",
          value: resource.project ? (
            <ResourceIdentityLink
              context={resource.project.project_id}
              kind="project"
              mfid={resource.project.unique_id}
              name={projectName ?? ""}
              navigation="preview"
            >
              <TruncatedText
                className="line-clamp-2 text-label group-hover/resource:underline"
                label={projectName}
              >
                {projectName}
              </TruncatedText>
            </ResourceIdentityLink>
          ) : (
            resource.project_id
          ),
        },
        {
          icon: <SummaryFieldIcon type="instrument" />,
          label: "Instrument",
          value: resource.instrument ? (
            <ResourceIdentityLink
              context={resource.instrument.instrument_id}
              kind="instrument"
              mfid={resource.instrument.unique_id}
              name={instrumentName ?? ""}
              navigation="preview"
            >
              <TruncatedText
                className="line-clamp-2 text-label group-hover/resource:underline"
                label={instrumentName}
              >
                {instrumentName}
              </TruncatedText>
            </ResourceIdentityLink>
          ) : (
            resource.instrument_id
          ),
        },
        {
          icon: <SummaryFieldIcon type="timestamp" />,
          label: "Timestamp",
          value: <LocalDateTime fallback="-" value={resource.timestamp} />,
        },
        { icon: ownerIcon, label: "Owner", value: owner },
        {
          label: "Visibility",
          value: <VisibilityBadge isPublic={resource.public} />,
        },
        createdField,
        updatedField,
      ]
    }
    case "sample": {
      const projectName = resource.project
        ? resourceDisplayName("project", resource.project.title, {
            identifier: resource.project.project_id,
            mfid: resource.project.unique_id,
          })
        : null
      return [
        {
          fullWidth: true,
          icon: <SummaryFieldIcon type="description" />,
          label: "Description",
          value: resource.description,
        },
        {
          icon: <SummaryFieldIcon type="type" />,
          label: "Sample type",
          value: resource.sample_type,
        },
        {
          icon: <SummaryFieldIcon type="project" />,
          label: "Project",
          value: resource.project ? (
            <ResourceIdentityLink
              context={resource.project.project_id}
              kind="project"
              mfid={resource.project.unique_id}
              name={projectName ?? ""}
              navigation="preview"
            >
              <TruncatedText
                className="line-clamp-2 text-label group-hover/resource:underline"
                label={projectName}
              >
                {projectName}
              </TruncatedText>
            </ResourceIdentityLink>
          ) : (
            resource.project_id
          ),
        },
        {
          icon: <SummaryFieldIcon type="timestamp" />,
          label: "Timestamp",
          value: <LocalDateTime fallback="-" value={resource.timestamp} />,
        },
        { icon: ownerIcon, label: "Owner", value: owner },
        {
          label: "Visibility",
          value: <VisibilityBadge isPublic={resource.public} />,
        },
        createdField,
        updatedField,
      ]
    }
    case "project":
      return [
        {
          icon: <SummaryFieldIcon type="project" />,
          label: "Project ID",
          value: resource.project_id,
        },
        {
          icon: <SummaryFieldIcon type="organization" />,
          label: "Organization",
          value: resource.organization,
        },
        {
          icon: <SummaryFieldIcon type="status" />,
          label: "Status",
          value: resource.status ? (
            <StatusBadge status={resource.status} />
          ) : null,
        },
        { icon: ownerIcon, label: "Lead", value: owner },
        createdField,
        updatedField,
      ]
    case "instrument":
      return [
        {
          icon: <SummaryFieldIcon type="instrument" />,
          label: "Instrument ID",
          value: resource.instrument_id,
        },
        {
          icon: <SummaryFieldIcon type="type" />,
          label: "Type",
          value: resource.instrument_type,
        },
        {
          icon: <SummaryFieldIcon type="status" />,
          label: "Status",
          value: resource.status ? (
            <StatusBadge status={resource.status} />
          ) : null,
        },
        {
          icon: <SummaryFieldIcon type="location" />,
          label: "Location",
          value: resource.location,
        },
        {
          icon: <SummaryFieldIcon type="manufacturer" />,
          label: "Manufacturer",
          value: resource.manufacturer,
        },
        {
          icon: <SummaryFieldIcon type="model" />,
          label: "Model",
          value: resource.model,
        },
        { icon: ownerIcon, label: "Manager", value: owner },
        createdField,
        updatedField,
      ]
  }
}
