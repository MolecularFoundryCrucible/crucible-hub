import { useHydrated } from "@tanstack/react-router"

const standardGreetings = [
  (name: string) => `Welcome back, ${name}`,
  (name: string) => `Good to see you, ${name}`,
  (name: string) => `Ready when you are, ${name}`,
  (name: string) => `Let's get started, ${name}`,
  (name: string) => `What are we exploring today, ${name}?`,
] as const

const snarkyGreetings = [
  (name: string) => `The data did not organize itself, ${name}`,
  (name: string) => `Your samples were starting to worry, ${name}`,
] as const

export function useHomeGreeting({
  accountMfid,
  firstName,
}: {
  accountMfid?: string
  firstName?: string
}) {
  const hydrated = useHydrated()
  const name = firstName?.trim() || "researcher"
  if (!hydrated) return `Welcome back, ${name}`
  return selectHomeGreeting(name, accountMfid ?? "anonymous", new Date())
}

function selectHomeGreeting(name: string, accountMfid: string, date: Date) {
  const dailyKey = `${accountMfid}:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  const dailyChoice = stableHash(dailyKey) % 20
  if (dailyChoice === 0) {
    return selectGreeting(snarkyGreetings, name, `${dailyKey}:snarky`)
  }
  if (dailyChoice < 9) return timeAwareGreeting(name, date.getHours())
  return selectGreeting(standardGreetings, name, `${dailyKey}:standard`)
}

function timeAwareGreeting(name: string, hour: number) {
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

function selectGreeting(
  greetings: readonly ((name: string) => string)[],
  name: string,
  key: string
) {
  return greetings[stableHash(key) % greetings.length](name)
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
