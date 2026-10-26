import { useHydrated } from "@tanstack/react-router"

import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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

function dayString(dayIndex: number) {
  return new Date(dayIndex * dayMs).toISOString().slice(0, 10)
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

/**
 * Slider positions for a span of days: one step per day for a few months,
 * per week for up to two years, and per 30 days beyond. The end is rounded up
 * to a whole step so both ends stay reachable.
 */
export function dateSliderScale(earliest: string, latest: string) {
  const min = dayNumber(earliest)
  const span = Math.max(dayNumber(latest) - min, 1)
  const step = span <= 120 ? 1 : span <= 730 ? 7 : 30
  return { max: min + Math.ceil(span / step) * step, min, step }
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
  errors = {},
  idPrefix,
  mode = "range",
  onChange,
  value,
}: {
  bounds?: DateRangeBounds
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
  const scale = earliest && latest ? dateSliderScale(earliest, latest) : null
  const clamp = (day: number) =>
    scale ? Math.min(scale.max, Math.max(scale.min, day)) : day
  const positions = scale
    ? mode === "range"
      ? [
          clamp(value.from ? dayNumber(value.from) : scale.min),
          clamp(value.to ? dayNumber(value.to) : scale.max),
        ]
      : [clamp(value.from ? dayNumber(value.from) : scale.min)]
    : []
  const edgeFormat =
    scale && scale.max - scale.min > 730 ? monthFormat : dayFormat

  return (
    <div className="flex flex-col gap-3">
      {scale ? (
        <div className="flex flex-col gap-2">
          <Slider
            getThumbLabel={(index) =>
              mode === "since"
                ? "Since"
                : index === 0
                  ? "Start date"
                  : "End date"
            }
            getThumbValueText={(position) => formatDay(dayString(position))}
            max={scale.max}
            min={scale.min}
            onValueChange={(next) => {
              const [start, end] = Array.isArray(next) ? next : [next]
              onChange({
                from: start <= scale.min ? undefined : dayString(start),
                to:
                  mode === "range"
                    ? end >= scale.max
                      ? undefined
                      : dayString(end)
                    : undefined,
              })
            }}
            step={scale.step}
            value={positions}
          />
          <div className="flex justify-between text-supporting text-muted-foreground tabular-nums">
            <span>{edgeFormat.format(new Date(scale.min * dayMs))}</span>
            <span>{edgeFormat.format(new Date(scale.max * dayMs))}</span>
          </div>
        </div>
      ) : null}
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
