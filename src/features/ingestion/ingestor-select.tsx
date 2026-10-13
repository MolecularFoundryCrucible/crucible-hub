import { useQuery } from "@tanstack/react-query"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ingestionClassesQueryOptions } from "@/data/crucible/resources.queries"

export type IngestorChoice =
  { kind: "none" } | { kind: "auto" } | { kind: "class"; name: string }

export const NO_INGESTOR: IngestorChoice = { kind: "none" }
export const AUTO_INGESTOR: IngestorChoice = { kind: "auto" }

const MIXED_VALUE = "mixed"

export function ingestorClassName(choice: IngestorChoice) {
  return choice.kind === "class" ? choice.name : undefined
}

export function ingestorChoiceLabel(choice: IngestorChoice) {
  if (choice.kind === "none") return "No ingestion"
  if (choice.kind === "auto") return "Auto-detect"
  return choice.name
}

function choiceValue(choice: IngestorChoice) {
  return choice.kind === "class" ? `class:${choice.name}` : choice.kind
}

function choiceFromValue(value: string): IngestorChoice {
  if (value === "none") return NO_INGESTOR
  if (value === "auto") return AUTO_INGESTOR
  return { kind: "class", name: value.slice("class:".length) }
}

export function sameIngestorChoice(
  left: IngestorChoice,
  right: IngestorChoice
) {
  return choiceValue(left) === choiceValue(right)
}

export function useIngestorClasses(enabled: boolean) {
  const scope = useWorkspaceScope()
  return useQuery({ ...ingestionClassesQueryOptions(scope), enabled })
}

export function IngestorSelect({
  allowNone = true,
  classes,
  className,
  disabled,
  id,
  label,
  onChange,
  size,
  value,
}: {
  allowNone?: boolean
  classes: readonly string[]
  className?: string
  disabled?: boolean
  id?: string
  label?: string
  onChange: (choice: IngestorChoice) => void
  size?: "sm" | "default"
  value: IngestorChoice | "mixed"
}) {
  return (
    <NativeSelect
      aria-label={label}
      className={className}
      disabled={disabled}
      id={id}
      onChange={(event) => {
        if (event.target.value !== MIXED_VALUE) {
          onChange(choiceFromValue(event.target.value))
        }
      }}
      size={size}
      value={value === "mixed" ? MIXED_VALUE : choiceValue(value)}
    >
      {value === "mixed" ? (
        <NativeSelectOption disabled value={MIXED_VALUE}>
          Mixed
        </NativeSelectOption>
      ) : null}
      {allowNone ? (
        <NativeSelectOption value="none">No ingestion</NativeSelectOption>
      ) : null}
      <NativeSelectOption value="auto">Auto-detect</NativeSelectOption>
      {classes.map((name) => (
        <NativeSelectOption key={name} value={`class:${name}`}>
          {name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
