import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { ingestorsQueryOptions } from "@/data/crucible/resources.queries"
import type { WorkspaceIngestor } from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"

export type IngestorChoice =
  { kind: "none" } | { kind: "auto" } | { kind: "class"; name: string }

const NO_INGESTOR: IngestorChoice = { kind: "none" }
export const AUTO_INGESTOR: IngestorChoice = { kind: "auto" }

export const NO_INGESTORS_AVAILABLE =
  "No ingestors are available right now. Requests wait until an ingestion worker is running."

export function ingestorClassName(choice: IngestorChoice) {
  return choice.kind === "class" ? choice.name : undefined
}

export function ingestorChoiceLabel(choice: IngestorChoice) {
  if (choice.kind === "none") return "Don't ingest"
  if (choice.kind === "auto") return "Auto-detect"
  return choice.name
}

function choiceKey(choice: IngestorChoice) {
  return choice.kind === "class" ? `class:${choice.name}` : choice.kind
}

function sameIngestorChoice(left: IngestorChoice, right: IngestorChoice) {
  return choiceKey(left) === choiceKey(right)
}

/** The choice every item shares, or "mixed". */
export function sharedIngestorChoice(
  choices: readonly IngestorChoice[]
): IngestorChoice | "mixed" {
  const [first] = choices
  if (!first) return AUTO_INGESTOR
  return choices.every((choice) => sameIngestorChoice(choice, first))
    ? first
    : "mixed"
}

/** Ingestors whose file extensions end any of the file names, compared without case. */
export function suggestedIngestors(
  ingestors: readonly WorkspaceIngestor[],
  filenames: readonly string[]
) {
  const names = filenames.map((filename) => filename.toLowerCase())
  return new Set(
    ingestors
      .filter((ingestor) =>
        ingestor.fileExtensions.some((extension) =>
          names.some((name) => name.endsWith(extension))
        )
      )
      .map((ingestor) => ingestor.name)
  )
}

export function useIngestors(enabled: boolean) {
  const scope = useWorkspaceScope()
  return useQuery({ ...ingestorsQueryOptions(scope), enabled })
}

type PickerItem = {
  choice: IngestorChoice
  description: string | null
  key: string
  label: string
}

type PickerGroup = { items: PickerItem[]; label: string | null; value: string }

function ingestorItem(ingestor: WorkspaceIngestor): PickerItem {
  return {
    choice: { kind: "class", name: ingestor.name },
    description:
      ingestor.description ??
      (ingestor.fileExtensions.length
        ? ingestor.fileExtensions.join(", ")
        : null),
    key: `class:${ingestor.name}`,
    label: ingestor.name,
  }
}

function pickerGroups(
  ingestors: readonly WorkspaceIngestor[],
  filenames: readonly string[],
  allowNone: boolean
): PickerGroup[] {
  const suggested = suggestedIngestors(ingestors, filenames)
  const sorted = [...ingestors].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
  const groups: PickerGroup[] = [
    {
      items: [
        {
          choice: AUTO_INGESTOR,
          description:
            "The ingestion worker picks an ingestor that can read the file.",
          key: "auto",
          label: "Auto-detect",
        },
        ...(allowNone
          ? [
              {
                choice: NO_INGESTOR,
                description: "Upload the file without ingesting it.",
                key: "none",
                label: "Don't ingest",
              },
            ]
          : []),
      ],
      label: null,
      value: "options",
    },
  ]
  if (suggested.size) {
    groups.push({
      items: sorted
        .filter((ingestor) => suggested.has(ingestor.name))
        .map(ingestorItem),
      label:
        filenames.length === 1
          ? "Suggested for this file"
          : "Suggested for these files",
      value: "suggested",
    })
  }
  const others = sorted.filter((ingestor) => !suggested.has(ingestor.name))
  if (others.length) {
    groups.push({
      items: others.map(ingestorItem),
      label: suggested.size ? "Other ingestors" : "Ingestors",
      value: "ingestors",
    })
  }
  return groups
}

function matches(item: PickerItem, query: string) {
  const needle = query.trim().toLowerCase()
  return (
    !needle ||
    item.label.toLowerCase().includes(needle) ||
    (item.description?.toLowerCase().includes(needle) ?? false)
  )
}

export function IngestorPicker({
  allowNone = true,
  className,
  disabled,
  filenames,
  id,
  ingestors,
  label,
  onChange,
  presentation = "field",
  value,
}: {
  allowNone?: boolean
  className?: string
  disabled?: boolean
  filenames: readonly string[]
  id?: string
  ingestors: readonly WorkspaceIngestor[]
  label: string
  onChange: (choice: IngestorChoice) => void
  presentation?: "field" | "inline"
  value: IngestorChoice | "mixed"
}) {
  const groups = useMemo(
    () => pickerGroups(ingestors, filenames, allowNone),
    [allowNone, filenames, ingestors]
  )
  const selected =
    value === "mixed"
      ? null
      : (groups
          .flatMap((group) => group.items)
          .find((item) => item.key === choiceKey(value)) ?? {
          choice: value,
          description: null,
          key: choiceKey(value),
          label: ingestorChoiceLabel(value),
        })
  const inline = presentation === "inline"

  return (
    <Combobox<PickerItem>
      autoHighlight
      disabled={disabled}
      filter={matches}
      isItemEqualToValue={(item, current) => item.key === current.key}
      itemToStringLabel={(item) => item.label}
      items={groups}
      onValueChange={(item) => {
        if (item) onChange(item.choice)
      }}
      value={selected}
    >
      <ComboboxTrigger
        aria-label={label}
        className={cn(
          "min-w-0 justify-between",
          inline && "text-muted-foreground",
          className
        )}
        id={id}
        render={
          <Button
            size={inline ? "xs" : "default"}
            type="button"
            variant={inline ? "ghost" : "outline"}
          />
        }
      >
        <span className="min-w-0 truncate">
          {selected ? selected.label : "Mixed"}
        </span>
      </ComboboxTrigger>
      <ComboboxContent align={inline ? "end" : "start"} className="min-w-80">
        <ComboboxInput
          aria-label="Search ingestors"
          placeholder="Search ingestors"
          showTrigger={false}
        />
        <ComboboxEmpty>No matching ingestors.</ComboboxEmpty>
        <ComboboxList>
          {(group: PickerGroup) => (
            <ComboboxGroup items={group.items} key={group.value}>
              {group.label ? (
                <ComboboxLabel>{group.label}</ComboboxLabel>
              ) : null}
              <ComboboxCollection>
                {(item: PickerItem) => (
                  <ComboboxItem key={item.key} value={item}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{item.label}</span>
                      {item.description ? (
                        <span className="text-supporting text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
        <p className="border-t px-3 py-2 text-supporting text-muted-foreground">
          {ingestors.length
            ? "If the chosen ingestor can't read a file, the ingestion worker picks one that can."
            : NO_INGESTORS_AVAILABLE}
        </p>
      </ComboboxContent>
    </Combobox>
  )
}
