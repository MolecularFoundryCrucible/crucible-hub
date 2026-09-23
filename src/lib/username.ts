export type UsernamePresentation = "handle" | "raw"

export function formatUsername(
  username: string | null | undefined,
  presentation: UsernamePresentation
) {
  const value = username?.trim().replace(/^@/, "")
  if (!value) {
    return ""
  }
  return presentation === "handle" ? `@${value}` : value
}
