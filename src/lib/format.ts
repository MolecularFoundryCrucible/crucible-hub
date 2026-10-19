export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "Unknown"
  if (bytes < 1_000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} kB`
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

const timestampPattern =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/

const localDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "short",
  year: "numeric",
})

const zonedLocalDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "short",
  timeZoneName: "short",
  year: "numeric",
})

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  timeZoneName: "short",
  year: "numeric",
})

const calendarDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})

export function parseTimestamp(value: string | null | undefined) {
  if (!value) return null
  const match = timestampPattern.exec(value)
  if (!match) return null
  const [, calendarDate, hourMinute, seconds, fraction, offset] = match
  const normalizedFraction = fraction
    ? `.${fraction.slice(0, 3).padEnd(3, "0")}`
    : ""
  const normalizedOffset =
    !offset || offset === "Z"
      ? "Z"
      : offset.length === 3
        ? `${offset}:00`
        : offset.length === 5
          ? `${offset.slice(0, 3)}:${offset.slice(3)}`
          : offset
  const normalizedValue = `${calendarDate}T${hourMinute}${seconds ? `:${seconds}${normalizedFraction}` : ""}${normalizedOffset}`
  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatStandardDateTime(value: string, formatter: Intl.DateTimeFormat) {
  const date = parseTimestamp(value)
  return date ? formatter.format(date) : value
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`)
    if (!Number.isNaN(date.getTime())) return calendarDateFormatter.format(date)
  }
  return formatStandardDateTime(value, localDateTimeFormatter)
}

export function formatLocalDateTime(value: string | null | undefined) {
  if (!value) return null
  return formatStandardDateTime(value, localDateTimeFormatter)
}

export function formatZonedLocalDateTime(value: string | null | undefined) {
  if (!value) return null
  return formatStandardDateTime(value, zonedLocalDateTimeFormatter)
}

export function formatUtcDateTime(value: string | null | undefined) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`)
    if (!Number.isNaN(date.getTime())) return calendarDateFormatter.format(date)
  }
  return formatStandardDateTime(value, utcDateTimeFormatter)
}

function padDateTimePart(value: number) {
  return value.toString().padStart(2, "0")
}

export function currentLocalDateTimeInput(date = new Date()) {
  return `${date.getFullYear()}-${padDateTimePart(date.getMonth() + 1)}-${padDateTimePart(date.getDate())}T${padDateTimePart(date.getHours())}:${padDateTimePart(date.getMinutes())}`
}

export function timestampToLocalInput(value: string | null | undefined) {
  if (!value) return ""
  const date = parseTimestamp(value)
  if (!date) return ""
  return `${date.getFullYear()}-${padDateTimePart(date.getMonth() + 1)}-${padDateTimePart(date.getDate())}T${padDateTimePart(date.getHours())}:${padDateTimePart(date.getMinutes())}:${padDateTimePart(date.getSeconds())}`
}

export function isValidLocalDateTime(value: string) {
  if (value === "") return true
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value
  )
  if (!match) return false
  const [, year, month, day, hour, minute, second = "0"] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hour) &&
    date.getMinutes() === Number(minute) &&
    date.getSeconds() === Number(second)
  )
}

export function localDateTimeToUtc(value: string) {
  if (value === "") return null
  if (!isValidLocalDateTime(value)) {
    throw new RangeError("Invalid local date and time")
  }
  return new Date(value).toISOString()
}

const localDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatRecentActivity(
  value: string | null | undefined,
  now = new Date()
) {
  const date = parseTimestamp(value)
  if (!date) return null
  if (now.getTime() - date.getTime() < 60 * 60 * 1000) {
    return "Within the last hour"
  }
  const days = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(date).getTime()) /
      (24 * 60 * 60 * 1000)
  )
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return localDateFormatter.format(date)
}
