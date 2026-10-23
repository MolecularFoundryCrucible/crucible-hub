/** An API ingestion status as a sentence-case label, e.g. `in_progress` as "In progress". */
export function ingestionStatusLabel(status: string) {
  const words = status.trim().toLowerCase().replaceAll("_", " ")
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}
