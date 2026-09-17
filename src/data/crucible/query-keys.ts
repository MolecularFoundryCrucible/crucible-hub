export type IdentityScope = readonly [
  "crucible",
  serverId: string,
  accountMfid: string,
]

export type ListFilters = Readonly<
  Record<
    string,
    boolean | number | string | null | undefined | readonly string[]
  >
>

function normalizeFilters(filters: ListFilters) {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== null && value !== undefined)
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
  accountCredentialStatus: (scope: IdentityScope) =>
    [...scope, "account", "credential-status"] as const,
  accountProfile: (scope: IdentityScope) =>
    [...scope, "account", "profile"] as const,
  projectQueries: (scope: IdentityScope) => [...scope, "projects"] as const,
  projects: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "projects", "list", normalizeFilters(filters)] as const,
  projectLists: (scope: IdentityScope) =>
    [...scope, "projects", "list"] as const,
  project: (scope: IdentityScope, projectMfid: string) =>
    [...scope, "projects", "detail", projectMfid] as const,
  projectSummary: (scope: IdentityScope, projectMfid: string) =>
    [...scope, "projects", "detail", projectMfid, "summary"] as const,
  sampleQueries: (scope: IdentityScope) => [...scope, "samples"] as const,
  person: (scope: IdentityScope, personId: string) =>
    [...scope, "people", "detail", personId] as const,
  serviceAccountAdminQueries: (scope: IdentityScope) =>
    [...scope, "admin", "service-accounts"] as const,
  serviceAccountLists: (scope: IdentityScope) =>
    [...scope, "admin", "service-accounts", "list"] as const,
  serviceAccounts: (scope: IdentityScope, filters: ListFilters) =>
    [
      ...scope,
      "admin",
      "service-accounts",
      "list",
      normalizeFilters(filters),
    ] as const,
  serviceAccountAdmin: (scope: IdentityScope, serviceAccountMfid: string) =>
    [
      ...scope,
      "admin",
      "service-accounts",
      "detail",
      serviceAccountMfid,
    ] as const,
  samples: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "samples", "list", normalizeFilters(filters)] as const,
  sampleCursorChain: (scope: IdentityScope, filters: ListFilters) =>
    [
      ...scope,
      "samples",
      "list",
      "cursor-chain",
      normalizeFilters(filters),
    ] as const,
  sampleAnchor: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "samples", "list", "anchor", normalizeFilters(filters)] as const,
  sampleLists: (scope: IdentityScope) => [...scope, "samples", "list"] as const,
  sampleFacets: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "samples", "list", "facets", normalizeFilters(filters)] as const,
  datasets: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "datasets", "list", normalizeFilters(filters)] as const,
  datasetCursorChain: (scope: IdentityScope, filters: ListFilters) =>
    [
      ...scope,
      "datasets",
      "list",
      "cursor-chain",
      normalizeFilters(filters),
    ] as const,
  datasetAnchor: (scope: IdentityScope, filters: ListFilters) =>
    [
      ...scope,
      "datasets",
      "list",
      "anchor",
      normalizeFilters(filters),
    ] as const,
  datasetLists: (scope: IdentityScope) =>
    [...scope, "datasets", "list"] as const,
  datasetFacets: (scope: IdentityScope, filters: ListFilters) =>
    [
      ...scope,
      "datasets",
      "list",
      "facets",
      normalizeFilters(filters),
    ] as const,
  datasetQueries: (scope: IdentityScope) => [...scope, "datasets"] as const,
  instrumentQueries: (scope: IdentityScope) =>
    [...scope, "instruments"] as const,
  instruments: (scope: IdentityScope, filters: ListFilters) =>
    [...scope, "instruments", "list", normalizeFilters(filters)] as const,
  instrumentLists: (scope: IdentityScope) =>
    [...scope, "instruments", "list"] as const,
  instrumentOperators: (scope: IdentityScope, instrumentMfid: string) =>
    [...scope, "instruments", "operators", instrumentMfid] as const,
  resourceQueries: (scope: IdentityScope) => [...scope, "resources"] as const,
  resourceDetails: (scope: IdentityScope, resourceMfid?: string) =>
    resourceMfid
      ? ([...scope, "resources", "detail", resourceMfid] as const)
      : ([...scope, "resources", "detail"] as const),
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
