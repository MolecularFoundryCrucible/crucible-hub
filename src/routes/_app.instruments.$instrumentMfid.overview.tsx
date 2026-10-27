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
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonLink } from "@/components/crucible/person-link"
import { personIsServiceAccount } from "@/components/crucible/person-identity"
import { StatusBadge } from "@/components/crucible/status-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  SummaryFieldIcon,
  SummaryFieldItem,
} from "@/components/crucible/summary-field-icon"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { ContentGrid } from "@/components/crucible/content-layout"
import { EntityOverviewLayout } from "@/components/crucible/entity-overview-layout"
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
import { InstrumentPeopleCard } from "@/features/instrument-people/instrument-people-card"
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
    <EntityOverviewLayout
      identity={<InstrumentIdentity instrument={resource} />}
      metadata={
        <ScientificMetadataEditor
          mode={mode}
          resource={resource}
          scope={scope}
        />
      }
      people={
        <InstrumentPeopleCard
          canManageAccess={resource.capabilities?.can_manage_access === true}
          instrumentMfid={resource.unique_id}
          scope={scope}
        />
      }
      summary={
        editing ? (
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
        )
      }
    />
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
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        {onEdit ? (
          <CardAction>
            <EditableCardTrigger label="Edit instrument" onClick={onEdit} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <SummaryFieldItem
            className="col-span-2"
            icon={<SummaryFieldIcon type="description" />}
            label="Description"
          >
            {instrument.description ?? "-"}
          </SummaryFieldItem>
          {fields.map(([label, value, type]) => (
            <SummaryFieldItem
              icon={<SummaryFieldIcon type={type} />}
              key={label}
              label={label}
            >
              {type === "status" && value ? (
                <StatusBadge status={value} />
              ) : (
                (value ?? "-")
              )}
            </SummaryFieldItem>
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
              <SummaryFieldItem
                icon={
                  <ResourceTypeIcon
                    className="mt-0.5 size-4 shrink-0"
                    type="instrument"
                  />
                }
                label="Instrument ID"
              >
                {instrument.instrument_id ?? "-"}
              </SummaryFieldItem>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1">
                  <MfidValue value={instrument.unique_id} />
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
                <PrintLabelButton
                  mfid={instrument.unique_id}
                  name={resourceDetailDisplayName(instrument)}
                />
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
            <SummaryFieldItem
              icon={<IdentityFieldIcon type="created" />}
              label="Created"
            >
              <LocalDateTime fallback="-" value={instrument.creation_time} />
            </SummaryFieldItem>
            <SummaryFieldItem
              icon={<IdentityFieldIcon type="updated" />}
              label="Updated"
            >
              <LocalDateTime
                fallback="-"
                value={instrument.modification_time}
              />
            </SummaryFieldItem>
          </dl>
        </ContentGrid>
      </CardContent>
    </Card>
  )
}
