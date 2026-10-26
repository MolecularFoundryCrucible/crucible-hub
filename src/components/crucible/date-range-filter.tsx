import { useHydrated } from "@tanstack/react-router"

import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type DateRangeValue = { from?: string; to?: string }

type DatePreset = {
  id: string
  label: string
  start: (today: string) => string
}

const datePresets: readonly DatePreset[] = [
  { id: "7d", label: "Last 7 days", start: (today) => addDays(today, -6) },
  { id: "30d", label: "Last 30 days", start: (today) => addDays(today, -29) },
  {
    id: "12m",
    label: "Last 12 months",
    start: (today) => addDays(addMonths(today, -12), 1),
  },
  {
    id: "year",
    label: "This year",
    start: (today) => `${today.slice(0, 4)}-01-01`,
  },
]

function shift(day: string, change: (date: Date) => void) {
  const date = new Date(`${day}T00:00:00Z`)
  change(date)
  return date.toISOString().slice(0, 10)
}

function addDays(day: string, days: number) {
  return shift(day, (date) => date.setUTCDate(date.getUTCDate() + days))
}

function addMonths(day: string, months: number) {
  return shift(day, (date) => date.setUTCMonth(date.getUTCMonth() + months))
}

/** Today's date (YYYY-MM-DD) in the given time zone, or the browser's. */
export function todayInTimeZone(timeZone?: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(now)
}

export function activeDatePreset(value: DateRangeValue, today: string) {
  if (!value.from && !value.to) return "any"
  if (value.to) return undefined
  return datePresets.find((preset) => preset.start(today) === value.from)?.id
}

/** The start date a preset applies, for the given today. */
export function datePresetStart(id: string, today: string) {
  return datePresets.find((preset) => preset.id === id)?.start(today)
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})

function formatDay(day: string) {
  return dayFormat.format(new Date(`${day}T00:00:00Z`))
}

/** One active-filter label for a date range, e.g. "Created: since Jan 1, 2026". */
export function dateRangeLabel(label: string, value: DateRangeValue) {
  if (value.from && value.to) {
    return `${label}: ${formatDay(value.from)} to ${formatDay(value.to)}`
  }
  if (value.from) return `${label}: since ${formatDay(value.from)}`
  if (value.to) return `${label}: until ${formatDay(value.to)}`
  return undefined
}

/**
 * Preset ranges and typed day bounds. `since` mode edits only the start, for
 * filters such as Active since. Days count in the viewer's time zone.
 */
export function DateRangeFilter({
  errors = {},
  idPrefix,
  mode = "range",
  onChange,
  value,
}: {
  errors?: { from?: string; to?: string }
  idPrefix: string
  mode?: "range" | "since"
  onChange: (value: DateRangeValue) => void
  value: DateRangeValue
}) {
  const hydrated = useHydrated()
  const presentation = useViewerPresentation()
  const timeZone =
    presentation.timeZone ??
    (hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC")
  const today = todayInTimeZone(timeZone)
  const active = activeDatePreset(value, today)
  const fromId = `${idPrefix}-from`
  const toId = `${idPrefix}-to`
  const zoneId = `${idPrefix}-time-zone`

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        aria-label="Date presets"
        className="flex-wrap gap-1"
        onValueChange={(values) => {
          const id = values.at(-1)
          if (id === "any") onChange({})
          else if (id) onChange({ from: datePresetStart(id, today) })
        }}
        size="sm"
        value={active ? [active] : []}
      >
        <ToggleGroupItem value="any">Any time</ToggleGroupItem>
        {datePresets.map((preset) => (
          <ToggleGroupItem key={preset.id} value={preset.id}>
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className={mode === "range" ? "grid grid-cols-2 gap-3" : undefined}>
        <Field data-invalid={Boolean(errors.from)}>
          <FieldLabel htmlFor={fromId}>
            {mode === "range" ? "From" : "Since"}
          </FieldLabel>
          <Input
            aria-describedby={[zoneId, errors.from ? `${fromId}-error` : null]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={Boolean(errors.from) || undefined}
            id={fromId}
            max={value.to ?? today}
            onChange={(event) =>
              onChange({ ...value, from: event.target.value || undefined })
            }
            type="date"
            value={value.from ?? ""}
          />
          <FieldError
            errors={errors.from ? [{ message: errors.from }] : []}
            id={`${fromId}-error`}
          />
        </Field>
        {mode === "range" ? (
          <Field data-invalid={Boolean(errors.to)}>
            <FieldLabel htmlFor={toId}>To</FieldLabel>
            <Input
              aria-describedby={[zoneId, errors.to ? `${toId}-error` : null]
                .filter(Boolean)
                .join(" ")}
              aria-invalid={Boolean(errors.to) || undefined}
              id={toId}
              max={today}
              min={value.from}
              onChange={(event) =>
                onChange({ ...value, to: event.target.value || undefined })
              }
              type="date"
              value={value.to ?? ""}
            />
            <FieldError
              errors={errors.to ? [{ message: errors.to }] : []}
              id={`${toId}-error`}
            />
          </Field>
        ) : null}
      </div>
      <FieldDescription id={zoneId}>Days in {timeZone}</FieldDescription>
    </div>
  )
}
