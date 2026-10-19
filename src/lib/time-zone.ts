export const timeZoneCookie = "crucible_hub_time_zone"

export function isValidTimeZone(value: string | null | undefined) {
  if (!value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

function zoneOffset(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value)
  const wallClock = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  )
  return wallClock - (instant - (((instant % 1000) + 1000) % 1000))
}

function startOfDay(year: number, month: number, day: number, zone: string) {
  const wallClock = Date.UTC(year, month - 1, day)
  const estimate = wallClock - zoneOffset(wallClock, zone)
  return wallClock - zoneOffset(estimate, zone)
}

export function dayStartUtc(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(startOfDay(year, month, day, timeZone)).toISOString()
}

export function dayEndUtc(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number)
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
  const end = new Date(
    startOfDay(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate(),
      timeZone
    ) - 1
  )
  return end.toISOString().replace(/Z$/, "999Z")
}
