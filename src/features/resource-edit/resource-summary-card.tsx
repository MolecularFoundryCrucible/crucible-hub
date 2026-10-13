import { Suspense, useState } from "react"
import type { ReactNode } from "react"
import { lazyRouteComponent } from "@tanstack/react-router"
import { EditResourceIcon } from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { ResourceStatusBadge } from "@/components/crucible/resource-status-badge"
import { SummaryFieldIcon } from "@/components/crucible/summary-field-icon"
import type { SummaryFieldType } from "@/components/crucible/summary-field-icon"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { resourceDisplayName } from "@/lib/resource-name"

export type DatasetDetail = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" }
>

export type SampleDetail = Extract<WorkspaceResourceDetail, { kind: "sample" }>

export type SummaryField = readonly [string, ReactNode, SummaryFieldType]

const SampleSummaryForm = lazyRouteComponent(
  () => import("./resource-summary-form"),
  "SampleSummaryForm"
)
const DatasetSummaryForm = lazyRouteComponent(
  () => import("./resource-summary-form"),
  "DatasetSummaryForm"
)

export function ResourceSummaryCard({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: WorkspaceResourceDetail
  scope: IdentityScope
}) {
  if (resource.kind === "sample") {
    return <SampleSummaryCard mode={mode} resource={resource} scope={scope} />
  }
  if (resource.kind === "dataset") {
    return <DatasetSummaryCard mode={mode} resource={resource} scope={scope} />
  }
  return <SummaryCard fields={summaryFields(resource)} />
}

function SampleSummaryCard({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: SampleDetail
  scope: IdentityScope
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <Suspense fallback={<SummaryCard fields={summaryFields(resource)} />}>
        <SampleSummaryForm
          mode={mode}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          resource={resource}
          scope={scope}
        />
      </Suspense>
    )
  }
  return (
    <SummaryCard
      action={
        resource.capabilities?.can_edit === true ? (
          <EditSummaryButton
            onClick={() => setEditing(true)}
            onPreload={() => void SampleSummaryForm.preload?.()}
          />
        ) : undefined
      }
      fields={summaryFields(resource)}
    />
  )
}

function DatasetSummaryCard({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: DatasetDetail
  scope: IdentityScope
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <Suspense fallback={<SummaryCard fields={summaryFields(resource)} />}>
        <DatasetSummaryForm
          mode={mode}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          resource={resource}
          scope={scope}
        />
      </Suspense>
    )
  }
  return (
    <SummaryCard
      action={
        resource.capabilities?.can_edit === true ? (
          <EditSummaryButton
            onClick={() => setEditing(true)}
            onPreload={() => void DatasetSummaryForm.preload?.()}
          />
        ) : undefined
      }
      fields={summaryFields(resource)}
    />
  )
}

function EditSummaryButton({
  onClick,
  onPreload,
}: {
  onClick: () => void
  onPreload: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Edit summary"
            onClick={onClick}
            onFocus={onPreload}
            onMouseEnter={onPreload}
            onTouchStart={onPreload}
            size="icon-sm"
            variant="outline"
          />
        }
      >
        <EditResourceIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Edit summary</TooltipContent>
    </Tooltip>
  )
}

function SummaryCard({
  action,
  fields,
}: {
  action?: ReactNode
  fields: readonly SummaryField[]
}) {
  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Summary</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <SummaryFields fields={fields} />
      </CardContent>
    </Card>
  )
}

export function SummaryFields({ fields }: { fields: readonly SummaryField[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map(([label, value, type]) => (
        <div className="min-w-0" key={label}>
          <dt className="text-label text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2 text-body break-words">
            <SummaryFieldIcon type={type} />
            <span className="min-w-0">
              {type === "status" && typeof value === "string" && value ? (
                <ResourceStatusBadge status={value} />
              ) : (
                (value ?? "-")
              )}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function summaryFields(
  resource: WorkspaceResourceDetail
): readonly SummaryField[] {
  if (resource.kind === "dataset") {
    return [
      ["Measurement", resource.measurement, "measurement"],
      ["Data format", resource.data_format, "data-format"],
      ["Data type", resource.data_type, "data-type"],
      ["Session", resource.session_name, "session"],
      ...contextFields(resource),
      [
        "Timestamp",
        <LocalDateTime fallback="-" value={resource.timestamp} />,
        "timestamp",
      ],
    ]
  }
  if (resource.kind === "sample") {
    return [
      ["Description", resource.description, "description"],
      ["Sample type", resource.sample_type, "type"],
      ...contextFields(resource),
      [
        "Timestamp",
        <LocalDateTime fallback="-" value={resource.timestamp} />,
        "timestamp",
      ],
    ]
  }
  return []
}

export function contextFields(
  resource: DatasetDetail | SampleDetail
): readonly SummaryField[] {
  const projectName = resource.project
    ? resourceDisplayName("project", resource.project.title, {
        identifier: resource.project.project_id,
        mfid: resource.project.unique_id,
      })
    : null
  const project = resource.project ? (
    <ResourceIdentityLink
      context={resource.project.project_id}
      kind="project"
      mfid={resource.project.unique_id}
      name={projectName ?? ""}
    >
      <span className="text-label group-hover/resource:underline">
        {projectName}
      </span>
    </ResourceIdentityLink>
  ) : (
    resource.project_id
  )
  if (resource.kind === "sample") return [["Project", project, "project"]]
  const instrumentName = resource.instrument
    ? resourceDisplayName("instrument", resource.instrument.instrument_name, {
        identifier: resource.instrument.instrument_id,
        mfid: resource.instrument.unique_id,
      })
    : null
  const instrument = resource.instrument ? (
    <ResourceIdentityLink
      context={resource.instrument.instrument_id}
      kind="instrument"
      mfid={resource.instrument.unique_id}
      name={instrumentName ?? ""}
    >
      <span className="text-label group-hover/resource:underline">
        {instrumentName}
      </span>
    </ResourceIdentityLink>
  ) : (
    resource.instrument_id
  )
  return [
    ["Project", project, "project"],
    ["Instrument", instrument, "instrument"],
  ]
}
