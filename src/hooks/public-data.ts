import type { QueryClient } from "@tanstack/react-query"

import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"

import { useAccountPreferences } from "./use-account-preferences"

export async function loadIncludePublicByDefault(
  queryClient: QueryClient,
  scope: IdentityScope
) {
  const document = await queryClient
    .ensureQueryData(accountPreferencesQueryOptions(scope))
    .catch(() => undefined)
  return document?.preferences.hub?.include_public_data === true
}

export function useIncludePublicByDefault(loaded = false) {
  const { loaded: preferencesLoaded, preferences } = useAccountPreferences()
  return preferencesLoaded
    ? preferences.hub?.include_public_data === true
    : loaded
}
