import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  useAccountPreferencesEnabled,
  useOptionalWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { identityScope, sameAccountKey } from "@/data/crucible/query-keys"
import type { RecentResource } from "@/data/crucible/recent-resources"
import { recentResourceLimit } from "@/data/crucible/recent-resources"
import {
  clearRecentResourceHistory,
  recordRecentResourceView,
} from "@/data/crucible/recent-resources.functions"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import { notifyError, notifySuccess } from "@/components/crucible/notifications"
import { recentResourcesQueryOptions } from "@/data/crucible/recent-resources.queries"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"

export type RecentlyViewedResource = RecentResource

const recordInterval = 60 * 1000
const lastRecorded = new Map<string, number>()

type RecentlyViewedResourceInput = Omit<RecentlyViewedResource, "viewedAt">

type RecentlyViewedContextValue = {
  activate: (identityKey: string) => void
  identityKey: string | null
  items: readonly RecentlyViewedResource[]
  remember: (identityKey: string, item: RecentlyViewedResourceInput) => void
}

const RecentlyViewedIdentityContext = createContext<string | null>(null)

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(
  null
)

export function RecentlyViewedProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<{
    identityKey: string | null
    items: readonly RecentlyViewedResource[]
  }>({ identityKey: null, items: [] })
  const activate = useCallback((identityKey: string) => {
    setState((current) =>
      current.identityKey === identityKey ? current : { identityKey, items: [] }
    )
  }, [])
  const remember = useCallback(
    (identityKey: string, item: RecentlyViewedResourceInput) => {
      setState((current) => {
        const items = current.identityKey === identityKey ? current.items : []
        return {
          identityKey,
          items: [
            { ...item, viewedAt: new Date().toISOString() },
            ...items.filter(
              (candidate) =>
                candidate.kind !== item.kind ||
                candidate.uniqueId !== item.uniqueId
            ),
          ].slice(0, 8),
        }
      })
    },
    []
  )
  const value = useMemo<RecentlyViewedContextValue>(
    () => ({
      activate,
      identityKey: state.identityKey,
      items: state.items,
      remember,
    }),
    [activate, remember, state]
  )

  return (
    <RecentlyViewedContext.Provider value={value}>
      {children}
    </RecentlyViewedContext.Provider>
  )
}

export function RecentlyViewedScope({
  children,
  identityKey,
}: {
  children: React.ReactNode
  identityKey: string
}) {
  const context = useContext(RecentlyViewedContext)
  if (!context) {
    throw new Error("Recently viewed resources require the root provider.")
  }

  const { activate } = context
  useEffect(() => {
    activate(identityKey)
  }, [activate, identityKey])

  return (
    <RecentlyViewedIdentityContext.Provider value={identityKey}>
      {children}
    </RecentlyViewedIdentityContext.Provider>
  )
}

function useRecentlyViewedContext() {
  const context = useContext(RecentlyViewedContext)
  const identityKey = useContext(RecentlyViewedIdentityContext)
  if (!context || !identityKey) {
    throw new Error("Recently viewed resources require the app shell.")
  }
  return { context, identityKey }
}

function useAccountHistory() {
  const workspaceScope = useOptionalWorkspaceScope()
  const enabled = useAccountPreferencesEnabled() && Boolean(workspaceScope)
  const scope =
    workspaceScope ?? identityScope("anonymous", "anonymous", "normal")
  return { enabled, options: recentResourcesQueryOptions(scope), scope }
}

export function useRecentlyViewed() {
  const { context, identityKey } = useRecentlyViewedContext()
  const history = useAccountHistory()
  const query = useQuery({
    ...history.options,
    enabled: history.enabled,
    // Keep the list on screen while Administrator view switches modes.
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      sameAccountKey(previousQuery.queryKey, history.options.queryKey)
        ? previous
        : undefined,
  })
  const local = context.identityKey === identityKey ? context.items : []
  if (!history.enabled || !query.data) return local
  return query.data
}

export function useRememberRecentlyViewed(
  item: RecentlyViewedResourceInput | null
) {
  const { context, identityKey } = useRecentlyViewedContext()
  const { remember } = context
  const history = useAccountHistory()
  const queryClient = useQueryClient()
  const recording =
    useAccountPreferences().preferences.record_recent_resources !== false

  useEffect(() => {
    if (!item) return
    remember(identityKey, item)
    if (!history.enabled || !recording) return
    const viewedAt = new Date().toISOString()
    queryClient.setQueryData(history.options.queryKey, (current) =>
      current
        ? [
            { ...item, viewedAt },
            ...current.filter(
              (candidate) => candidate.uniqueId !== item.uniqueId
            ),
          ].slice(0, recentResourceLimit)
        : current
    )
    const key = `${identityKey}:${item.uniqueId}`
    const now = Date.now()
    if (now - (lastRecorded.get(key) ?? 0) < recordInterval) return
    lastRecorded.set(key, now)
    void recordRecentResourceView({
      data: {
        resourceMfid: item.uniqueId,
        scenario: fixtureScenarioFromScope(history.scope),
      },
    })
      .then((result) => {
        if (result.status === "error") lastRecorded.delete(key)
      })
      .catch(() => lastRecorded.delete(key))
  }, [
    history.enabled,
    identityKey,
    item?.kind,
    item?.name,
    item?.projectId,
    item?.uniqueId,
    recording,
    remember,
  ])
}

export function useClearRecentHistory(onCleared: () => void) {
  const history = useAccountHistory()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await clearRecentResourceHistory({
          data: { scenario: fixtureScenarioFromScope(history.scope) },
        })
      ),
    onError: (error) =>
      notifyError(
        "History not cleared",
        hubErrorMessage(error, "Crucible could not clear your history.")
      ),
    onSuccess: () => {
      lastRecorded.clear()
      queryClient.setQueryData(history.options.queryKey, [])
      onCleared()
      notifySuccess(
        "History cleared",
        "Your recently viewed list is now empty."
      )
    },
  })
}
