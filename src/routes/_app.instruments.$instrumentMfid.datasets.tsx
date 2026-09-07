import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { InstrumentDatasetCollection } from "@/components/crucible/instrument-dataset-collection"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import { buttonVariants } from "@/components/ui/button"
import {
  dataPageLimit,
  datasetsQueryOptions,
} from "@/data/crucible/data.queries"

const instrumentDatasetSearchSchema = z.object({
  cursor: z.string().min(1).max(2048).optional().catch(undefined),
})

const instrumentRoute = getRouteApi("/_app/instruments/$instrumentMfid")

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/datasets"
)({
  validateSearch: instrumentDatasetSearchSchema,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const instrument = (await parentMatchPromise).loaderData
    if (!instrument?.isInstrument || !instrument.instrumentMfid) return

    const options = datasetsQueryOptions(instrument.scope, {
      cursor: deps.cursor,
      instrumentMfid: instrument.instrumentMfid,
      limit: dataPageLimit,
    })
    const hasData =
      context.queryClient.getQueryData(options.queryKey) !== undefined
    const request = context.queryClient.prefetchQuery(options)
    if (cause === "stay" || hasData) {
      void request
      return
    }

    await request
  },
  pendingComponent: InstrumentDatasetsPending,
  component: InstrumentDatasetsPage,
})

function InstrumentDatasetsPending() {
  return <CollectionTablePending label="datasets" />
}

function InstrumentDatasetsPage() {
  const { instrumentMfid: routeInstrumentMfid } = Route.useParams()
  const { cursor } = Route.useSearch()
  const instrument = instrumentRoute.useLoaderData()
  const scope = useWorkspaceScope()
  const instrumentMfid = instrument?.instrumentMfid ?? ""
  const result = useQuery({
    ...datasetsQueryOptions(scope, {
      cursor,
      instrumentMfid,
      limit: dataPageLimit,
    }),
    enabled: Boolean(instrumentMfid),
  })

  if (!instrumentMfid) return null

  if (result.isPending) return <InstrumentDatasetsPending />
  if (result.isError && !result.data) {
    return (
      <>
        <CollectionLoadError
          label="Datasets"
          retry={() => void result.refetch()}
        />
        {cursor ? (
          <nav
            className="flex justify-end"
            aria-label="Instrument dataset pages"
          >
            <Link
              className={buttonVariants({ variant: "outline" })}
              from="/instruments/$instrumentMfid/datasets"
              params={{ instrumentMfid: routeInstrumentMfid }}
              search={(previous) => ({ ...previous, cursor: undefined })}
              to="/instruments/$instrumentMfid/datasets"
            >
              First datasets
            </Link>
          </nav>
        ) : null}
      </>
    )
  }

  return (
    <>
      <div className="flex justify-end">
        <ResourceCreationActions
          instrumentMfid={instrumentMfid}
          kinds={["dataset"]}
        />
      </div>
      <CollectionUpdateStatus label="datasets" updating={result.isFetching} />
      {result.isError ? (
        <CollectionUpdateError
          label="Datasets"
          preserved
          retry={() => void result.refetch()}
        />
      ) : null}
      <InstrumentDatasetCollection
        cursor={cursor}
        instrumentMfid={routeInstrumentMfid}
        page={result.data}
        updating={result.isFetching}
      />
    </>
  )
}
