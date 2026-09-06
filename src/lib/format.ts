export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "Unknown"
  if (bytes < 1_000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} kB`
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value))
}

const standardTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/

function standardTimestampDate(value: string) {
  if (!standardTimestampPattern.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatLocalDateTime(value: string | null | undefined) {
  if (!value) return null
  const date = standardTimestampDate(value)
  if (!date) return value
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZoneName: "short",
    year: "numeric",
  }).format(date)
}

function padDateTimePart(value: number) {
  return value.toString().padStart(2, "0")
}

export function timestampToLocalInput(value: string | null | undefined) {
  if (!value) return ""
  const date = standardTimestampDate(value)
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

export function initials(firstName: string, lastName: string) {
  return `${firstName.at(0) ?? ""}${lastName.at(0) ?? ""}`.toUpperCase()
}
