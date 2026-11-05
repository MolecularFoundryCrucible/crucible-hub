export function hubLoginHref(origin: string | null, returnTo?: string) {
  const path = returnTo
    ? `/hub/auth/login?${new URLSearchParams({ returnTo })}`
    : "/hub/auth/login"
  return `${origin ?? ""}${path}`
}
