import { useHydrated } from "@tanstack/react-router"

import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"

export type DateRangeValue = { from?: string; to?: string }

/** Earliest and latest timestamps among the records being filtered. */
export type DateRangeBounds = {
  earliest?: string | null
  latest?: string | null
}

const dayMs = 86_400_000

function dayNumber(day: string) {
  return Date.parse(`${day}T00:00:00Z`) / dayMs
}

/** The calendar day (YYYY-MM-DD) of a moment in the given time zone. */
export function dayInTimeZone(moment: Date | string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(typeof moment === "string" ? new Date(moment) : moment)
}

export type DateSliderUnit = "day" | "week" | "month" | "year"

function shiftDay(day: string, change: (date: Date) => void) {
  const date = new Date(`${day}T00:00:00Z`)
  change(date)
  return date.toISOString().slice(0, 10)
}

function addDays(day: string, days: number) {
  return shiftDay(day, (date) => date.setUTCDate(date.getUTCDate() + days))
}

function periodStart(day: string, unit: DateSliderUnit) {
  if (unit === "week") {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
    return addDays(day, -((weekday + 6) % 7))
  }
  if (unit === "month") return `${day.slice(0, 7)}-01`
  if (unit === "year") return `${day.slice(0, 4)}-01-01`
  return day
}

function nextPeriod(start: string, unit: DateSliderUnit) {
  if (unit === "week") return addDays(start, 7)
  if (unit === "month") {
    return shiftDay(start, (date) => date.setUTCMonth(date.getUTCMonth() + 1))
  }
  if (unit === "year") {
    return shiftDay(start, (date) =>
      date.setUTCFullYear(date.getUTCFullYear() + 1)
    )
  }
  return addDays(start, 1)
}

/**
 * Calendar-aligned slider stops for a span of days: days for up to three
 * months, Monday-to-Sunday weeks for up to two years, months for up to 15
 * years, and years beyond. `boundaries` holds each period's first day plus the
 * day after the last period, so stop `i` starts at `boundaries[i]`.
 */
export function dateSliderStops(earliest: string, latest: string) {
  const span = dayNumber(latest) - dayNumber(earliest)
  const unit: DateSliderUnit =
    span <= 92 ? "day" : span <= 731 ? "week" : span <= 5479 ? "month" : "year"
  const boundaries = [periodStart(earliest, unit)]
  while (boundaries[boundaries.length - 1] <= latest) {
    boundaries.push(nextPeriod(boundaries[boundaries.length - 1], unit))
  }
  return { boundaries, unit }
}

const sliderLargeSteps: Record<DateSliderUnit, number> = {
  day: 7,
  month: 12,
  week: 4,
  year: 5,
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})

/** A slider stop's name at its unit's precision, e.g. "Mar 2026". */
function formatPeriod(day: string, unit: DateSliderUnit) {
  if (unit === "year") return day.slice(0, 4)
  if (unit === "month") return monthFormat.format(new Date(`${day}T00:00:00Z`))
  return formatDay(day)
}

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
 * A slider across the span the records cover, with typed day bounds for
 * exact dates. A handle at either end leaves that bound open. `since` mode
 * edits only the start, for filters such as Active since. Days count in the
 * viewer's time zone.
 */
export function DateRangeFilter({
  bounds,
  boundsPending = false,
  errors = {},
  idPrefix,
  mode = "range",
  onChange,
  value,
}: {
  bounds?: DateRangeBounds
  /** Whether the bounds are still loading, so the slider shows a skeleton. */
  boundsPending?: boolean
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
  const today = dayInTimeZone(new Date(), timeZone)
  const fromId = `${idPrefix}-from`
  const toId = `${idPrefix}-to`
  const zoneId = `${idPrefix}-time-zone`
  const earliest = bounds?.earliest
    ? dayInTimeZone(bounds.earliest, timeZone)
    : undefined
  const latest = bounds?.latest
    ? dayInTimeZone(bounds.latest, timeZone)
    : undefined
  const stops = earliest && latest ? dateSliderStops(earliest, latest) : null
  const last = stops ? stops.boundaries.length - 1 : 0
  const startStop = (day: string | undefined) => {
    if (!stops || !day) return 0
    const index = stops.boundaries.filter((start) => start <= day).length - 1
    return Math.min(Math.max(index, 0), last - 1)
  }
  const endStop = (day: string | undefined) => {
    if (!stops || !day) return last
    const index = stops.boundaries.findIndex((start) => start > day)
    return index < 1 ? last : index
  }
  const positions =
    mode === "range"
      ? [startStop(value.from), endStop(value.to)]
      : [startStop(value.from)]

  return (
    <div className="flex flex-col gap-3">
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
      {boundsPending ? (
        <div aria-hidden="true" className="flex flex-col gap-2 pt-2">
          <div className="flex h-4 items-center">
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ) : stops ? (
        <div className="flex flex-col gap-2 pt-2">
          <Slider
            getThumbLabel={(index) =>
              mode === "since"
                ? "Since"
                : index === 0
                  ? "Start date"
                  : "End date"
            }
            getThumbValueText={(position, index) =>
              index === 0
                ? formatPeriod(stops.boundaries[position], stops.unit)
                : stops.unit === "day" || stops.unit === "week"
                  ? formatDay(addDays(stops.boundaries[position], -1))
                  : formatPeriod(stops.boundaries[position - 1], stops.unit)
            }
            largeStep={sliderLargeSteps[stops.unit]}
            max={mode === "range" ? last : last - 1}
            min={0}
            minStepsBetweenValues={1}
            onValueChange={(next) => {
              const [start, end] = Array.isArray(next) ? next : [next]
              onChange({
                from: start === 0 ? undefined : stops.boundaries[start],
                to:
                  mode === "range" && end !== undefined && end < last
                    ? addDays(stops.boundaries[end], -1)
                    : undefined,
              })
            }}
            step={1}
            value={positions}
          />
          <div className="flex justify-between text-supporting text-muted-foreground tabular-nums">
            <span>{formatPeriod(stops.boundaries[0], stops.unit)}</span>
            <span>{formatPeriod(stops.boundaries[last - 1], stops.unit)}</span>
          </div>
        </div>
      ) : null}
      <FieldDescription id={zoneId}>Days in {timeZone}</FieldDescription>
    </div>
  )
}
