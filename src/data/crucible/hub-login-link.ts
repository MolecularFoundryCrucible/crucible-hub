export function hubLoginHref(
  origin: string | null,
  returnTo?: string,
  provider?: string
) {
  const search = new URLSearchParams({
    ...(returnTo ? { returnTo } : {}),
    ...(provider ? { provider } : {}),
  })
  const query = search.toString()
  return `${origin ?? ""}/hub/auth/login${query ? `?${query}` : ""}`
}

export type HubSignInChoice = {
  href: string
  isOrcid: boolean
  label: string
}

export function hubSignInChoices(
  methods:
    readonly { display_name: string; is_orcid: boolean; key: string }[] | null,
  origin: string | null,
  returnTo?: string
): HubSignInChoice[] {
  if (methods && methods.length > 1) {
    return methods.map((method) => ({
      href: hubLoginHref(origin, returnTo, method.key),
      isOrcid: method.is_orcid,
      label: `Sign in with ${method.display_name}`,
    }))
  }
  const only = methods?.[0]
  return [
    {
      href: hubLoginHref(origin, returnTo),
      isOrcid: only?.is_orcid ?? false,
      label: only ? `Sign in with ${only.display_name}` : "Sign in",
    },
  ]
}
