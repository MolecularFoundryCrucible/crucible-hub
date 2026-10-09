import { useId, useState } from "react"

import {
  ResourceComboboxContent,
  useResourceComboboxState,
} from "@/components/crucible/resource-search-combobox"
import type { SearchableResourceKind } from "@/components/crucible/resource-search-combobox"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Combobox, ComboboxInput } from "@/components/ui/combobox"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"

export type ResourceChooserKind = Exclude<SearchableResourceKind, "dataset">

const resourceLabels = {
  instrument: {
    plural: "instruments",
    pluralTitle: "Instruments",
    singular: "Instrument",
  },
  person: { plural: "people", pluralTitle: "People", singular: "Person" },
  project: { plural: "projects", pluralTitle: "Projects", singular: "Project" },
  sample: { plural: "samples", pluralTitle: "Samples", singular: "Sample" },
} satisfies Record<
  ResourceChooserKind,
  { plural: string; pluralTitle: string; singular: string }
>

export function ResourceChooser({
  allowBrowse = true,
  ariaLabel,
  describedBy,
  disabled = false,
  emptyLabel,
  excludeServiceAccounts = false,
  excludedIds = [],
  invalid = false,
  kind,
  onChange,
  triggerId,
  value,
}: {
  allowBrowse?: boolean
  ariaLabel?: string
  describedBy?: string
  disabled?: boolean
  emptyLabel?: string
  excludeServiceAccounts?: boolean
  excludedIds?: readonly string[]
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
  const normalizedQuery = query.trim()

  const state = useResourceComboboxState({
    allowBrowse,
    excludedIds,
    excludeServiceAccounts,
    kind,
    normalizedQuery,
    pinnedValue: value,
    scope,
  })

  return (
    <Combobox<WorkspaceSearchResult>
      autoHighlight
      disabled={disabled}
      filter={null}
      isItemEqualToValue={(item, selected) =>
        item.unique_id === selected.unique_id
      }
      itemToStringLabel={(item) => item.name}
      items={state.items}
      loopFocus
      onInputValueChange={(nextQuery, details) => {
        if (
          details.reason !== "input-change" &&
          details.reason !== "clear-press"
        ) {
          return
        }
        setQuery(nextQuery)
        if (details.reason === "clear-press") {
          onChange(undefined)
          if (allowBrowse) setOpen(true)
        } else {
          if (value) {
            onChange(undefined)
          }
          setOpen(allowBrowse ? true : nextQuery.trim().length > 0)
        }
      }}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setQuery("")
        }
      }}
      onValueChange={(item) => {
        const next = item ?? undefined
        onChange(next)
        setQuery("")
        setOpen(false)
      }}
      open={open}
      value={value ?? null}
    >
      <ComboboxInput
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-label={
          ariaLabel ?? (triggerId ? undefined : `Search ${labels.plural}`)
        }
        autoComplete="off"
        className="w-full"
        clearLabel={`Clear ${labels.singular.toLowerCase()}`}
        disabled={disabled}
        endAdornment={
          value ? (
            <span className="text-label-compact text-muted-foreground select-none">
              ({value.unique_id})
            </span>
          ) : null
        }
        id={triggerId ?? generatedId}
        onClick={() => {
          if (allowBrowse) setOpen(true)
        }}
        placeholder={
          emptyLabel ?? `Search or choose ${labels.singular.toLowerCase()}`
        }
        showClear={Boolean(value || query.length > 0)}
        showTrigger
        startAdornment={
          <ResourceTypeIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
            type={value?.kind ?? kind}
          />
        }
      />
      <ResourceComboboxContent
        allowBrowse={allowBrowse}
        labels={labels}
        normalizedQuery={normalizedQuery}
        state={state}
      />
    </Combobox>
  )
}
