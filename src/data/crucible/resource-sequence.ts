import type { CollectionAffiliation } from "./collection-query"
import { privilegeModeFromScope } from "./query-keys"
import type { IdentityScope } from "./query-keys"
import type { ResourceSequencePreference } from "./preferences"

type ActiveScope = Exclude<ResourceSequencePreference["scope"], "off">

export type ResourceSequenceConfiguration = Omit<
  ResourceSequencePreference,
  "scope"
> & { scope: ActiveScope }

type SequenceResource = {
  kind: "dataset" | "sample"
  owner?: unknown
  project?: unknown
  public?: boolean
}

export const defaultResourceSequence = {
  direction: "asc",
  scope: "project_subtype",
  sort: "created",
} as const satisfies ResourceSequenceConfiguration

export function resourceSequencePreferenceKey(kind: SequenceResource["kind"]) {
  return kind === "sample" ? "samples" : "datasets"
}

export function isDefaultResourceSequence(value: ResourceSequencePreference) {
  return (
    value.direction === defaultResourceSequence.direction &&
    value.scope === defaultResourceSequence.scope &&
    value.sort === defaultResourceSequence.sort
  )
}

export function resolveResourceSequence(
  preference: ResourceSequencePreference | undefined,
  resource: SequenceResource
): ResourceSequenceConfiguration {
  const { direction, scope, sort } = preference ?? defaultResourceSequence
  return { direction, scope: applicableScope(scope, resource), sort }
}

function applicableScope(
  scope: ResourceSequencePreference["scope"],
  resource: SequenceResource
): ActiveScope {
  if (scope === "off") return "subtype"
  if (scope === "project" || scope === "project_subtype") {
    return resource.project ? scope : "subtype"
  }
  if (scope === "owner") return resource.owner ? scope : "subtype"
  if (scope === "instrument") {
    return resource.kind === "dataset" ? scope : "subtype"
  }
  return scope
}

export function resourceSequenceAffiliation({
  includePublic,
  resource,
  scope,
}: {
  includePublic: boolean
  resource: SequenceResource
  scope: IdentityScope
}): CollectionAffiliation | undefined {
  return includePublic ||
    resource.public ||
    privilegeModeFromScope(scope) === "elevated"
    ? undefined
    : "member"
}
