export type IdentityScope = readonly [
  "crucible",
  serverId: string,
  accountMfid: string,
]

export type ListFilters = Readonly<
  Record<string, boolean | number | string | null | readonly string[]>
>

function normalizeFilters(filters: ListFilters) {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== null)
      .sort(([left], [right]) => left.localeCompare(right))
  )
}

export function identityScope(
  serverId: string,
  accountMfid: string
): IdentityScope {
  return ["crucible", serverId, accountMfid]
}

export const crucibleKeys = {
  workspace: (scope: IdentityScope) => [...scope, "workspace"] as const,
  accountProfile: (scope: IdentityScope) =>
    [...scope, "account", "profile"] as const,
  projects: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "projects", "list", normalizeFilters(filters)] as const,
  projectLists: (scope: IdentityScope) =>
    [...scope, "projects", "list"] as const,
  project: (scope: IdentityScope, projectMfid: string) =>
    [...scope, "projects", "detail", projectMfid] as const,
  person: (scope: IdentityScope, personId: string) =>
    [...scope, "people", "detail", personId] as const,
  serviceAccount: (scope: IdentityScope, reference: string) =>
    [...scope, "people", "service-account", reference] as const,
  samples: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "samples", "list", normalizeFilters(filters)] as const,
  sampleLists: (scope: IdentityScope) => [...scope, "samples", "list"] as const,
  datasets: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "datasets", "list", normalizeFilters(filters)] as const,
  datasetLists: (scope: IdentityScope) =>
    [...scope, "datasets", "list"] as const,
  instruments: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "instruments", "list", normalizeFilters(filters)] as const,
  instrumentLists: (scope: IdentityScope) =>
    [...scope, "instruments", "list"] as const,
  instrumentOperators: (scope: IdentityScope, instrumentMfid: string) =>
    [...scope, "instruments", "operators", instrumentMfid] as const,
  resource: (scope: IdentityScope, resourceMfid: string, detailShape: string) =>
    [...scope, "resources", "detail", resourceMfid, detailShape] as const,
  resourceGraph: (scope: IdentityScope, resourceMfid: string) =>
    [...scope, "resources", "graph", resourceMfid, "one-hop"] as const,
  resourceAccess: (scope: IdentityScope, resourceMfid: string) =>
    [...scope, "resources", "access", resourceMfid] as const,
  datasetFiles: (scope: IdentityScope, datasetMfid: string) =>
    [...scope, "datasets", "files", datasetMfid] as const,
  datasetIngestionRequests: (scope: IdentityScope, datasetMfid: string) =>
    [...scope, "datasets", "ingestion-requests", datasetMfid] as const,
  ingestionClasses: (scope: IdentityScope) =>
    [...scope, "ingestion", "classes"] as const,
  datasetThumbnails: (scope: IdentityScope, datasetMfid: string) =>
    [...scope, "datasets", "thumbnails", datasetMfid] as const,
  datasetThumbnailPreviews: (
    scope: IdentityScope,
    datasetMfids: readonly string[]
  ) =>
    [
      ...scope,
      "datasets",
      "thumbnail-previews",
      [...datasetMfids].sort(),
    ] as const,
  datasetThumbnailPreviewLists: (scope: IdentityScope) =>
    [...scope, "datasets", "thumbnail-previews"] as const,
  search: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "search", normalizeFilters(filters)] as const,
  searches: (scope: IdentityScope) => [...scope, "search"] as const,
}
