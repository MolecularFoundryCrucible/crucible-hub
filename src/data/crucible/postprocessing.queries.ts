import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import {
  getDatasetPostprocessingRuns,
  getWorkspacePipelines,
} from "./postprocessing.functions"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

const postprocessingRunLimit = 20

export function pipelinesQueryOptions(scope: IdentityScope) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.pipelines(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspacePipelines({ data: { scenario }, signal })
      ),
    staleTime: 10 * 60 * 1000,
  })
}

export function datasetPostprocessingRunsQueryOptions(
  scope: IdentityScope,
  datasetMfid: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.datasetPostprocessingRuns(scope, datasetMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getDatasetPostprocessingRuns({
          data: { datasetMfid, limit: postprocessingRunLimit, scenario },
          signal,
        })
      ),
    refetchInterval: (query) =>
      query.state.data?.items.some(
        (run) => run.status === "requested" || run.status === "running"
      )
        ? 10000
        : false,
    ...(scenario ? { retry: false } : {}),
  })
}
