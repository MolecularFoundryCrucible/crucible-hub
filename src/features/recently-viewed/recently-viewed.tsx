import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type RecentlyViewedResource = {
  kind: "dataset" | "instrument" | "project" | "sample"
  name: string
  projectId: string | null
  uniqueId: string
  viewedAt: string
}

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

export function useRecentlyViewed() {
  const { context, identityKey } = useRecentlyViewedContext()
  return context.identityKey === identityKey ? context.items : []
}

export function useRememberRecentlyViewed(
  item: RecentlyViewedResourceInput | null
) {
  const { context, identityKey } = useRecentlyViewedContext()
  const { remember } = context

  useEffect(() => {
    if (item) remember(identityKey, item)
  }, [
    identityKey,
    item?.kind,
    item?.name,
    item?.projectId,
    item?.uniqueId,
    remember,
  ])
}
