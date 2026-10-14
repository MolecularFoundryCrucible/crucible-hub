import { useInfiniteQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import type {
  DatasetFacetField,
  SampleFacetField,
  WorkspaceFacetBucket,
} from "@/data/crucible/facets"
import {
  datasetFacetQueryOptions,
  sampleFacetQueryOptions,
} from "@/data/crucible/facets.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"

const suggestionLimit = 6
const byUse = { direction: "desc", sort: "count" } as const

function topValues(buckets: readonly WorkspaceFacetBucket[] | undefined) {
  return (buckets ?? [])
    .flatMap((bucket) => (bucket.value ? [bucket.value] : []))
    .slice(0, suggestionLimit)
}

export function useDatasetFacetSuggestions(
  scope: IdentityScope,
  field: DatasetFacetField,
  projectMfid: string | undefined
) {
  const query = useInfiniteQuery({
    ...datasetFacetQueryOptions(
      scope,
      field,
      { projectMfid, projectScope: "all" },
      { ordering: byUse }
    ),
    enabled: Boolean(projectMfid),
  })
  return projectMfid ? topValues(query.data?.pages[0]?.items) : []
}

export function useSampleFacetSuggestions(
  scope: IdentityScope,
  field: SampleFacetField,
  projectMfid: string | undefined
) {
  const query = useInfiniteQuery({
    ...sampleFacetQueryOptions(
      scope,
      field,
      { projectMfid, projectScope: "all" },
      { ordering: byUse }
    ),
    enabled: Boolean(projectMfid),
  })
  return projectMfid ? topValues(query.data?.pages[0]?.items) : []
}

export function ProjectSuggestions({
  disabled,
  label,
  onPick,
  suggestions,
  value,
}: {
  disabled?: boolean
  label: string
  onPick: (value: string) => void
  suggestions: readonly string[]
  value: string
}) {
  if (suggestions.length === 0) return null
  return (
    <div
      aria-label={`${label} values used in this project`}
      className="flex flex-wrap items-center gap-1.5"
      role="group"
    >
      <span className="text-supporting text-muted-foreground">
        In this project
      </span>
      {suggestions.map((suggestion) => (
        <Button
          aria-pressed={suggestion === value.trim()}
          disabled={disabled}
          key={suggestion}
          onClick={() => onPick(suggestion)}
          size="xs"
          type="button"
          variant={suggestion === value.trim() ? "secondary" : "outline"}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  )
}
