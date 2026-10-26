import { Suspense, useState } from "react"
import type { ReactNode } from "react"
import { lazyRouteComponent } from "@tanstack/react-router"
import { EditableCardTrigger } from "@/components/crucible/editable-card-actions"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { StatusBadge } from "@/components/crucible/status-badge"
import {
  SummaryFieldIcon,
  SummaryFieldItem,
} from "@/components/crucible/summary-field-icon"
import type { SummaryFieldType } from "@/components/crucible/summary-field-icon"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
          <EditableCardTrigger
            label="Edit summary"
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
          <EditableCardTrigger
            label="Edit summary"
            onClick={() => setEditing(true)}
            onPreload={() => void DatasetSummaryForm.preload?.()}
          />
        ) : undefined
      }
      fields={summaryFields(resource)}
    />
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
      <CardHeader>
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
    <dl className="grid grid-cols-2 gap-4">
      {fields.map(([label, value, type]) => (
        <SummaryFieldItem
          className={type === "description" ? "col-span-2" : undefined}
          icon={<SummaryFieldIcon type={type} />}
          key={label}
          label={label}
        >
          {type === "status" && typeof value === "string" && value ? (
            <StatusBadge status={value} />
          ) : (
            (value ?? "-")
          )}
        </SummaryFieldItem>
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
