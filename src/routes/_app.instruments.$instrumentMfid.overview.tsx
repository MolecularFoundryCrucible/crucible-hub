import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceOverviewPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { EditResourceIcon } from "@/components/crucible/icons"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidQrCode } from "@/components/crucible/mfid-qr-code"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonLink } from "@/components/crucible/person-link"
import { personIsServiceAccount } from "@/components/crucible/person-identity"
import { ResourceStatusBadge } from "@/components/crucible/resource-status-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SummaryFieldIcon } from "@/components/crucible/summary-field-icon"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import {
  ScientificMetadataExpansionAction,
  ScientificMetadataViewer,
  useScientificMetadataExpansion,
} from "@/components/crucible/scientific-metadata"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  preloadResourceDetail,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import { InstrumentSettingsForm } from "@/features/management-settings/settings-forms"
import type {
  WorkspaceResourceDetail,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"

type InstrumentDetail = Extract<WorkspaceResourceDetail, { kind: "instrument" }>

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/overview"
)({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.instrumentMfid) return
    await preloadResourceDetail(
      context.queryClient,
      parent.scope,
      parent.instrumentMfid
    )
  },
  pendingComponent: () => <ResourceOverviewPending resourceKind="instrument" />,
  errorComponent: ResourceTabLoadError,
  component: InstrumentOverviewPage,
})

function InstrumentOverviewPage() {
  const { instrumentMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const [editing, setEditing] = useState(false)
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null

  return (
    <ContentGrid variant="detail">
      <ContentGridItem span="wide">
        {editing ? (
          <InstrumentSettingsForm
            instrument={resource}
            mode={mode}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
            scope={scope}
          />
        ) : (
          <InstrumentSummary
            instrument={resource}
            onEdit={
              resource.capabilities?.can_edit === true
                ? () => setEditing(true)
                : undefined
            }
          />
        )}
      </ContentGridItem>
      <ContentGridItem span="narrow">
        <InstrumentIdentity instrument={resource} />
      </ContentGridItem>
      <ContentGridItem span="full">
        <InstrumentMetadata metadata={resource.scientific_metadata} />
      </ContentGridItem>
    </ContentGrid>
  )
}

function InstrumentSummary({
  instrument,
  onEdit,
}: {
  instrument: InstrumentDetail
  onEdit?: () => void
}) {
  const fields = [
    ["Instrument type", instrument.instrument_type, "type"],
    ["Location", instrument.location, "location"],
    ["Manufacturer", instrument.manufacturer, "manufacturer"],
    ["Model", instrument.model, "model"],
    ["Status", instrument.status, "status"],
  ] as const

  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Summary</CardTitle>
        {onEdit ? (
          <CardAction>
            <Button onClick={onEdit} variant="outline">
              <EditResourceIcon data-icon="inline-start" />
              Edit instrument
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label text-muted-foreground">Description</dt>
            <dd className="mt-1 flex min-w-0 items-start gap-2 text-body break-words">
              <SummaryFieldIcon type="description" />
              <span className="min-w-0">{instrument.description ?? "-"}</span>
            </dd>
          </div>
          {fields.map(([label, value, type]) => (
            <div className="min-w-0" key={label}>
              <dt className="text-label text-muted-foreground">{label}</dt>
              <dd className="mt-1 flex min-w-0 items-start gap-2 text-body break-words">
                <SummaryFieldIcon type={type} />
                <span className="min-w-0">
                  {type === "status" && value ? (
                    <ResourceStatusBadge status={value} />
                  ) : (
                    (value ?? "-")
                  )}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function InstrumentIdentity({ instrument }: { instrument: InstrumentDetail }) {
  return (
    <Card>
      <CardContent>
        <ContentGrid variant="identity">
          <div className="min-w-0">
            <CardTitle>Identity</CardTitle>
            <dl className="mt-4 grid gap-4">
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">
                  Instrument ID
                </dt>
                <dd className="mt-1 flex items-start gap-2 text-body break-words">
                  <ResourceTypeIcon
                    className="mt-0.5 size-4 shrink-0"
                    type="instrument"
                  />
                  {instrument.instrument_id ?? "-"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1">
                  <MfidValue value={instrument.unique_id} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">Owner</dt>
                <dd className="mt-1 flex items-start gap-2 text-body">
                  <IdentityFieldIcon
                    accountType={
                      instrument.owner &&
                      personIsServiceAccount(instrument.owner)
                        ? "service-account"
                        : "person"
                    }
                    type="owner"
                  />
                  {instrument.owner ? (
                    <PersonLink
                      nameStyle="abbreviated"
                      person={instrument.owner}
                    />
                  ) : (
                    "Unknown owner"
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="content-grid-identity-qr">
            <MfidQrCode value={instrument.unique_id} />
          </div>
          <dl className="content-grid-identity-timestamps grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-label text-muted-foreground">Created</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="created" />
                <LocalDateTime fallback="-" value={instrument.creation_time} />
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Updated</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="updated" />
                <LocalDateTime
                  fallback="-"
                  value={instrument.modification_time}
                />
              </dd>
            </div>
          </dl>
        </ContentGrid>
      </CardContent>
    </Card>
  )
}

function InstrumentMetadata({
  metadata,
}: {
  metadata: WorkspaceScientificMetadata | null
}) {
  const expansion = useScientificMetadataExpansion(metadata)
  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Scientific metadata</CardTitle>
        {expansion.canExpand ? (
          <CardAction>
            <ScientificMetadataExpansionAction expansion={expansion} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ScientificMetadataViewer
          emptyMessage="This instrument does not currently expose scientific metadata."
          expansion={expansion}
          metadata={metadata}
        />
      </CardContent>
    </Card>
  )
}
