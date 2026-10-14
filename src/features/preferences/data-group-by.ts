import type { QueryClient } from "@tanstack/react-query"

import type { AccountPreferences } from "@/data/crucible/preferences"
import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"

import { useAccountPreferences } from "./use-account-preferences"

export type DataGroupBy = NonNullable<
  NonNullable<AccountPreferences["hub"]>["data_group_by"]
>

export async function loadDataGroupBy(
  queryClient: QueryClient,
  scope: IdentityScope,
  enabled: boolean
): Promise<DataGroupBy | undefined> {
  if (!enabled) return undefined
  const document = await queryClient
    .ensureQueryData(accountPreferencesQueryOptions(scope))
    .catch(() => undefined)
  return document?.preferences.hub?.data_group_by
}

export function useDataGroupBy(loaded: DataGroupBy | undefined) {
  const { loaded: preferencesLoaded, preferences } = useAccountPreferences()
  return preferencesLoaded ? preferences.hub?.data_group_by : loaded
}
