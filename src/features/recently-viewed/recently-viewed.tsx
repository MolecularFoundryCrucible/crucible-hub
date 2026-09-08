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
  uniqueId: string
}

type RecentlyViewedContextValue = {
  items: readonly RecentlyViewedResource[]
  remember: (item: RecentlyViewedResource) => void
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(
  null
)

export function RecentlyViewedProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [items, setItems] = useState<readonly RecentlyViewedResource[]>([])
  const remember = useCallback((item: RecentlyViewedResource) => {
    setItems((current) =>
      [
        item,
        ...current.filter(
          (candidate) =>
            candidate.kind !== item.kind || candidate.uniqueId !== item.uniqueId
        ),
      ].slice(0, 8)
    )
  }, [])
  const value = useMemo<RecentlyViewedContextValue>(
    () => ({
      items,
      remember,
    }),
    [items, remember]
  )

  return (
    <RecentlyViewedContext.Provider value={value}>
      {children}
    </RecentlyViewedContext.Provider>
  )
}

export function useRecentlyViewed() {
  const context = useContext(RecentlyViewedContext)
  if (!context) {
    throw new Error("Recently viewed resources require the app shell.")
  }
  return context.items
}

export function useRememberRecentlyViewed(item: RecentlyViewedResource | null) {
  const context = useContext(RecentlyViewedContext)
  if (!context) {
    throw new Error("Recently viewed resources require the app shell.")
  }
  const { remember } = context

  useEffect(() => {
    if (item) remember(item)
  }, [item?.kind, item?.name, item?.uniqueId, remember])
}
