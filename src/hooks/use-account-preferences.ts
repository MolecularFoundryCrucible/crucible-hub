import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { notifyError } from "@/components/crucible/notifications"
import {
  useAccountPreferencesEnabled,
  useOptionalWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { applyMergePatch } from "@/data/crucible/preferences"
import type {
  AccountPreferences,
  AccountPreferencesDocument,
  AccountPreferencesPatch,
} from "@/data/crucible/preferences"
import { updateAccountPreferences } from "@/data/crucible/preferences.functions"
import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import { identityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"

const noPreferences: AccountPreferences = {}

export function useAccountPreferences() {
  const workspaceScope = useOptionalWorkspaceScope()
  const enabled = useAccountPreferencesEnabled() && Boolean(workspaceScope)
  const scope =
    workspaceScope ?? identityScope("anonymous", "anonymous", "normal")
  const queryClient = useQueryClient()
  const options = accountPreferencesQueryOptions(scope)
  const query = useQuery({ ...options, enabled })

  const mutation = useMutation({
    scope: { id: "account-preferences" },
    mutationFn: async (patch: AccountPreferencesPatch) => {
      const current = await queryClient.ensureQueryData(options)
      return unwrapHubResult(
        await updateAccountPreferences({
          data: {
            etag: current.etag,
            patch,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      )
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey })
      const previous = queryClient.getQueryData(options.queryKey)
      if (previous) {
        queryClient.setQueryData(options.queryKey, {
          ...previous,
          preferences: applyMergePatch(
            previous.preferences,
            patch
          ) as AccountPreferences,
        } satisfies AccountPreferencesDocument)
      }
      return { previous }
    },
    onError: (error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(options.queryKey, context.previous)
      }
      notifyError(
        "Preference not saved",
        hubErrorMessage(error, "Crucible could not save your preference.")
      )
    },
    onSuccess: (update) => {
      queryClient.setQueryData(options.queryKey, update.document)
    },
  })

  return {
    enabled,
    error: query.error,
    loaded: query.isSuccess,
    preferences: query.data?.preferences ?? noPreferences,
    saving: mutation.isPending,
    update: (patch: AccountPreferencesPatch) => {
      if (enabled) mutation.mutate(patch)
    },
    updatedAt: query.data?.updatedAt ?? null,
  }
}
