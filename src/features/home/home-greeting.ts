export function homeGreeting({
  accountMfid,
  at,
  firstName,
  timeZone,
}: {
  accountMfid?: string
  at: number
  firstName?: string
  timeZone?: string
}) {
  const name = firstName?.trim() || "researcher"
  if (!timeZone) return `Welcome to Crucible, ${name}`
  const { day, hour } = zonedClock(at, timeZone)
  const choice = stableHash(`${accountMfid ?? "anonymous"}:${day}:${hour}`) % 12
  if (choice === 0) return `Welcome to the Crux, ${name}`
  if (choice < 6) return timeAwareGreeting(name, hour)
  return `Welcome to Crucible, ${name}`
}

function zonedClock(at: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
      month: "numeric",
      timeZone,
      year: "numeric",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value])
  )
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  }
}

function timeAwareGreeting(name: string, hour: number) {
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
