import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
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
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="flex flex-col gap-6 xl:col-span-3">
        <InstrumentSummary instrument={resource} />
        <InstrumentMetadata metadata={resource.scientific_metadata} />
      </div>
      <div className="xl:col-span-2">
        <InstrumentIdentity instrument={resource} />
      </div>
    </div>
  )
}

function InstrumentSummary({ instrument }: { instrument: InstrumentDetail }) {
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
            <dd className="mt-1 font-mono text-supporting break-all">
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
