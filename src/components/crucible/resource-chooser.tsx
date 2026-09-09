import { useId, useState } from "react"

import { PersonIdentity } from "@/components/crucible/person-identity"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
import type { SearchableResourceKind } from "@/components/crucible/resource-search-combobox"
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
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"

export type ResourceChooserKind = Exclude<SearchableResourceKind, "dataset">

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
  const scope = useWorkspaceScope()
  const labels = resourceLabels[kind]
  const queryId = `${generatedId}-query`

  function resetSearch() {
    setQuery("")
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetSearch()
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
          {value.kind === "person" ? (
            <PersonIdentity person={value} presentation="stacked" />
          ) : (
            <p className="truncate text-body" title={value.name}>
              {value.name}
            </p>
          )}
          <MfidText
            className="block truncate text-muted-foreground"
            value={value.unique_id}
          />
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
            <ResourceSearchCombobox
              id={queryId}
              kind={kind}
              onQueryChange={setQuery}
              onValueChange={(item) => {
                if (item) select(item)
              }}
              query={query}
              scope={scope}
              value={undefined}
            />
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
