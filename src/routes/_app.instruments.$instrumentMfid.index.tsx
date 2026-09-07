import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { EditResourceIcon } from "@/components/crucible/icons"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { InstrumentSettingsForm } from "@/features/management-settings/settings-forms"
import type {
  WorkspaceResourceDetail,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"
import { formatDate } from "@/lib/format"

type InstrumentDetail = Extract<WorkspaceResourceDetail, { kind: "instrument" }>

export const Route = createFileRoute("/_app/instruments/$instrumentMfid/")({
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
      <ContentGridItem span="wide">
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
    ["Type", instrument.instrument_type],
    ["Location", instrument.location],
    ["Manufacturer", instrument.manufacturer],
    ["Model", instrument.model],
  ] as const

  return (
    <Card>
      <CardHeader>
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
          {fields.map(([label, value]) => (
            <div className="min-w-0" key={label}>
              <dt className="text-supporting text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-body break-words">
                {value ?? "Unknown"}
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
      <CardHeader>
        <CardTitle>Identity</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <dt className="text-supporting text-muted-foreground">
              Instrument ID
            </dt>
            <dd className="mt-1 text-body break-words">
              {instrument.instrument_id ?? "Not provided"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-supporting text-muted-foreground">MFID</dt>
            <dd className="mt-1 font-mono text-identifier break-all">
              {instrument.unique_id}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-supporting text-muted-foreground">Owner</dt>
            <dd className="mt-1 text-body">
              {instrument.owner ? (
                <Link
                  className="text-label hover:underline"
                  params={{ personId: instrument.owner.unique_id }}
                  to="/people/$personId"
                >
                  {instrument.owner.first_name} {instrument.owner.last_name}
                </Link>
              ) : (
                "Unknown owner"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-supporting text-muted-foreground">Created</dt>
            <dd className="mt-1 text-body">
              {formatDate(instrument.creation_time)}
            </dd>
          </div>
          <div>
            <dt className="text-supporting text-muted-foreground">Updated</dt>
            <dd className="mt-1 text-body">
              {formatDate(instrument.modification_time)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function InstrumentMetadata({
  metadata,
}: {
  metadata: WorkspaceScientificMetadata | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scientific metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <ScientificMetadata
          emptyMessage="This instrument does not currently expose scientific metadata."
          metadata={metadata}
        />
      </CardContent>
    </Card>
  )
}
