import { useHydrated } from "@tanstack/react-router"

export function useHomeGreeting({
  accountMfid,
  firstName,
}: {
  accountMfid?: string
  firstName?: string
}) {
  const hydrated = useHydrated()
  const name = firstName?.trim() || "researcher"
  if (!hydrated) return `Welcome to Crucible, ${name}`
  return selectHomeGreeting(name, accountMfid ?? "anonymous", new Date())
}

function selectHomeGreeting(name: string, accountMfid: string, date: Date) {
  const hour = date.getHours()
  const hourlyKey = `${accountMfid}:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}:${hour}`
  const choice = stableHash(hourlyKey) % 12
  if (choice === 0) return `Welcome to the Crux, ${name}`
  if (choice < 6) return timeAwareGreeting(name, hour)
  return `Welcome to Crucible, ${name}`
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
