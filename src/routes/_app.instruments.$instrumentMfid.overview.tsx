import { useState } from "react"
import { ScientificMetadataEditor } from "@/features/resource-metadata/scientific-metadata-editor"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceOverviewPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { AccessRoleBadge } from "@/components/crucible/access-role-badge"
import { EditableCardTrigger } from "@/components/crucible/editable-card-actions"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidQrCode } from "@/components/crucible/mfid-qr-code"
import { PrintLabelButton } from "@/features/label-printing/print-label-dialog"
import { resourceDetailDisplayName } from "@/lib/resource-name"
import { CopyMfidButton, MfidValue } from "@/components/crucible/mfid-value"
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
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

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
        <ScientificMetadataEditor
          mode={mode}
          resource={resource}
          scope={scope}
        />
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
            <EditableCardTrigger label="Edit instrument" onClick={onEdit} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <div className="col-span-2 min-w-0">
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
                  <MfidValue copyable={false} value={instrument.unique_id} />
                </dd>
              </div>
              <div
                className={
                  instrument.role ? "grid grid-cols-2 gap-4" : "min-w-0"
                }
              >
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
                {instrument.role ? (
                  <div className="min-w-0">
                    <dt className="text-label text-muted-foreground">
                      Your role
                    </dt>
                    <dd className="mt-1 flex items-start gap-2 text-body">
                      <AccessRoleBadge role={instrument.role} />
                    </dd>
                  </div>
                ) : null}
              </div>
            </dl>
          </div>
          <div className="content-grid-identity-qr">
            <MfidQrCode
              actions={
                <>
                  <CopyMfidButton size="icon-sm" value={instrument.unique_id} />
                  <PrintLabelButton
                    mfid={instrument.unique_id}
                    name={resourceDetailDisplayName(instrument)}
                    variant="icon"
                  />
                </>
              }
              dialogActions={
                <PrintLabelButton
                  mfid={instrument.unique_id}
                  name={resourceDetailDisplayName(instrument)}
                />
              }
              value={instrument.unique_id}
            />
          </div>
          <dl className="content-grid-identity-timestamps grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <dt className="text-label text-muted-foreground">Created</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="created" />
                <LocalDateTime fallback="-" value={instrument.creation_time} />
              </dd>
            </div>
            <div className="min-w-0">
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
