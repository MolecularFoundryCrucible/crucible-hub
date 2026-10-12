export function readRetryAfterSeconds(headers: Headers): number | undefined {
  const value = headers.get("Retry-After")
  if (value === null) {
    return undefined
  }
  const trimmed = value.trim()
  const seconds = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined
  return seconds !== undefined && Number.isSafeInteger(seconds)
    ? seconds
    : undefined
}
