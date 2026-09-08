import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { searchQueryOptions } from "@/data/crucible/search.queries"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"

export type ResourceChooserKind = "instrument" | "person" | "project" | "sample"

const resourceLabels = {
  instrument: { plural: "instruments", singular: "Instrument" },
  person: { plural: "people", singular: "Person" },
  project: { plural: "projects", singular: "Project" },
  sample: { plural: "samples", singular: "Sample" },
} satisfies Record<ResourceChooserKind, { plural: string; singular: string }>

export function ResourceChooser({
  describedBy,
  emptyLabel,
  invalid = false,
  kind,
  onChange,
  triggerId,
  value,
}: {
  describedBy?: string
  emptyLabel?: string
  invalid?: boolean
  kind: ResourceChooserKind
  onChange: (value: WorkspaceSearchResult | undefined) => void
  triggerId?: string
  value: WorkspaceSearchResult | undefined
}) {
  const generatedId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [validationError, setValidationError] = useState<string>()
  const scope = useWorkspaceScope()
  const labels = resourceLabels[kind]
  const queryId = `${generatedId}-query`
  const guidanceId = `${generatedId}-guidance`
  const errorId = `${generatedId}-error`
  const result = useQuery({
    ...searchQueryOptions(scope, submitted, [kind]),
    enabled: open && submitted.length >= 3,
  })
  const group = result.data?.groups.find((candidate) => candidate.kind === kind)
  const items = group?.items.filter((item) => item.kind === kind) ?? []

  function resetSearch() {
    setQuery("")
    setSubmitted("")
    setValidationError(undefined)
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetSearch()
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    const nextQuery = query.trim()
    if (nextQuery.length < 3) {
      setSubmitted("")
      setValidationError("Enter at least 3 characters.")
      return
    }
    setValidationError(undefined)
    if (nextQuery === submitted) {
      void result.refetch()
      return
    }
    setSubmitted(nextQuery)
  }

  function select(item: WorkspaceSearchResult) {
    onChange(item)
    setOpen(false)
    resetSearch()
  }

  const triggerLabel = `${value ? "Change" : "Choose"} ${labels.singular.toLocaleLowerCase()}`

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {value ? (
        <div className="max-w-full min-w-0">
          <p className="truncate text-body" title={value.name}>
            {value.name}
          </p>
          <p className="truncate font-mono text-identifier text-muted-foreground">
            {value.unique_id}
          </p>
        </div>
      ) : (
        <p className="text-body text-muted-foreground">
          {emptyLabel ?? `All ${labels.plural}`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Dialog onOpenChange={changeOpen} open={open}>
          <DialogTrigger
            render={
              <Button
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                aria-label={triggerLabel}
                id={triggerId}
                type="button"
                variant="outline"
              />
            }
          >
            {triggerLabel}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Choose {labels.singular.toLocaleLowerCase()}
              </DialogTitle>
              <DialogDescription>
                Search by {labels.singular.toLocaleLowerCase()} name or
                identifier, then choose a returned{" "}
                {labels.singular.toLocaleLowerCase()}.
              </DialogDescription>
            </DialogHeader>
            <form noValidate onSubmit={search}>
              <FieldGroup className="sm:flex-row sm:items-end">
                <Field
                  className="min-w-0 flex-1"
                  data-invalid={Boolean(validationError)}
                >
                  <FieldLabel htmlFor={queryId}>
                    Search {labels.plural}
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      validationError ? `${guidanceId} ${errorId}` : guidanceId
                    }
                    aria-invalid={Boolean(validationError) || undefined}
                    autoComplete="off"
                    id={queryId}
                    minLength={3}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setSubmitted("")
                      setValidationError(undefined)
                    }}
                    required
                    type="search"
                    value={query}
                  />
                  <FieldDescription id={guidanceId}>
                    Enter at least 3 characters.
                  </FieldDescription>
                  {validationError ? (
                    <FieldError id={errorId}>{validationError}</FieldError>
                  ) : null}
                </Field>
                <Button type="submit" variant="outline">
                  Search
                </Button>
              </FieldGroup>
            </form>
            {!submitted ? null : result.isPending ||
              result.isPlaceholderData ? (
              <p className="text-body text-muted-foreground" role="status">
                Searching {labels.plural}…
              </p>
            ) : result.isError || group?.error ? (
              <p className="text-body text-muted-foreground" role="alert">
                {labels.singular}s could not be searched.
              </p>
            ) : items.length === 0 ? (
              <p className="text-body text-muted-foreground">
                No {labels.plural} matched this search.
              </p>
            ) : (
              <ul aria-label={`${labels.singular} search results`}>
                {items.map((item) => (
                  <li className="border-b last:border-0" key={item.unique_id}>
                    <Button
                      aria-label={`Select ${labels.singular.toLocaleLowerCase()}: ${item.name}`}
                      onClick={() => select(item)}
                      size="selection"
                      type="button"
                      variant="ghost"
                    >
                      <ResourceTypeIcon data-icon="inline-start" type={kind} />
                      <span className="min-w-0 text-left">
                        <span className="block text-label">{item.name}</span>
                        {item.context ? (
                          <span className="block text-supporting text-muted-foreground">
                            {item.context}
                          </span>
                        ) : null}
                        <span className="block font-mono text-identifier break-all text-muted-foreground">
                          {item.unique_id}
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
        {value ? (
          <Button
            onClick={() => onChange(undefined)}
            type="button"
            variant="ghost"
          >
            Clear {labels.singular.toLocaleLowerCase()}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
