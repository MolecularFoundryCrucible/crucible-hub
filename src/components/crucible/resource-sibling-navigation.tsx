import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"

import {
  LoadingMoreIcon,
  NextSiblingIcon,
  PreviousSiblingIcon,
} from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"

export type ResourceSibling = {
  kind: "dataset" | "sample"
  mfid: string
  name: string
}

type ResourceSiblingPage = {
  hasNextPage: boolean
  items: readonly ResourceSibling[]
  total: number | null
}

export type ResourceSiblingCollection = ResourceSiblingPage & {
  loadMore: () => Promise<ResourceSiblingPage>
  startsAtBeginning: boolean
}

type ActiveResourceSiblingSession = ResourceSiblingCollection & {
  id: string
  isLoading: boolean
  loadError: boolean
}

type ResourceSiblingNavigationContextValue = {
  active: ActiveResourceSiblingSession | null
  candidateId: string
  loadNext: (
    sessionId: string,
    currentMfid: string
  ) => Promise<ResourceSibling | undefined>
  registered: readonly ResourceSiblingCollection[]
  register: (collections: readonly ResourceSiblingCollection[]) => void
  start: (sessionId: string, collection: ResourceSiblingCollection) => void
}

declare module "@tanstack/react-router" {
  interface HistoryState {
    resourceSiblingSession?: string
  }
}

const ResourceSiblingNavigationContext =
  createContext<ResourceSiblingNavigationContextValue | null>(null)

export function ResourceSiblingNavigationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [registered, setRegistered] = useState<
    readonly ResourceSiblingCollection[]
  >([])
  const [active, setActive] = useState<ActiveResourceSiblingSession | null>(
    null
  )
  const [candidateId, setCandidateId] = useState(createSiblingSessionId)
  const loadingSession = useRef<string | null>(null)

  const register = useCallback(
    (collections: readonly ResourceSiblingCollection[]) => {
      setRegistered(collections)
    },
    []
  )
  const start = useCallback(
    (sessionId: string, collection: ResourceSiblingCollection) => {
      setActive({
        ...collection,
        id: sessionId,
        isLoading: false,
        loadError: false,
      })
      setCandidateId(createSiblingSessionId())
    },
    []
  )
  const loadNext = useCallback(
    async (sessionId: string, currentMfid: string) => {
      const session = active
      if (
        !session ||
        session.id !== sessionId ||
        session.isLoading ||
        loadingSession.current === sessionId ||
        !session.hasNextPage
      ) {
        return undefined
      }
      loadingSession.current = sessionId
      setActive((current) =>
        current?.id === sessionId
          ? { ...current, isLoading: true, loadError: false }
          : current
      )
      try {
        const page = await session.loadMore()
        const currentIndex = page.items.findIndex(
          (item) => item.mfid === currentMfid
        )
        setActive((current) =>
          current?.id === sessionId
            ? {
                ...current,
                ...page,
                isLoading: false,
                loadError: false,
              }
            : current
        )
        return currentIndex >= 0 ? page.items[currentIndex + 1] : undefined
      } catch {
        setActive((current) =>
          current?.id === sessionId
            ? { ...current, isLoading: false, loadError: true }
            : current
        )
        return undefined
      } finally {
        if (loadingSession.current === sessionId) {
          loadingSession.current = null
        }
      }
    },
    [active]
  )
  const value = useMemo(
    () => ({
      active,
      candidateId,
      loadNext,
      registered,
      register,
      start,
    }),
    [active, candidateId, loadNext, register, registered, start]
  )

  return (
    <ResourceSiblingNavigationContext.Provider value={value}>
      {children}
    </ResourceSiblingNavigationContext.Provider>
  )
}

export function useRegisterResourceSiblings(
  collections: readonly ResourceSiblingCollection[]
) {
  const navigation = useContext(ResourceSiblingNavigationContext)
  const register = navigation?.register
  useEffect(() => {
    if (!register) return
    register(collections)
    return () => register([])
  }, [collections, register])
}

export function useResourceSiblingCandidate(
  mfid: string,
  kind: "dataset" | "instrument" | "project" | "sample" | undefined
) {
  const navigation = useContext(ResourceSiblingNavigationContext)
  const collection =
    kind === "dataset" || kind === "sample"
      ? navigation?.registered.find((candidate) =>
          candidate.items.some(
            (item) => item.kind === kind && item.mfid === mfid
          )
        )
      : undefined
  const sessionId = collection ? navigation?.candidateId : undefined
  return {
    sessionId,
    start: () => {
      if (navigation && collection && sessionId) {
        navigation.start(sessionId, collection)
      }
    },
  }
}

export function useActiveResourceSiblingNavigation(currentMfid: string) {
  const navigation = useContext(ResourceSiblingNavigationContext)
  const sessionId = useRouterState({
    select: (state) => state.location.state.resourceSiblingSession,
  })
  const session =
    navigation?.active?.id === sessionId ? navigation?.active : undefined
  const index = session?.items.findIndex((item) => item.mfid === currentMfid)
  if (!session || index === undefined || index < 0 || !navigation) return null

  return {
    ...session,
    loadNext: () => navigation.loadNext(session.id, currentMfid),
    next: session.items.at(index + 1),
    position:
      session.startsAtBeginning && session.total !== null
        ? `${index + 1} of ${session.total}`
        : `${index + 1} of ${session.items.length} loaded`,
    previous: index > 0 ? session.items.at(index - 1) : undefined,
  }
}

export type ActiveResourceSiblingNavigation = NonNullable<
  ReturnType<typeof useActiveResourceSiblingNavigation>
>

export function ResourceSiblingNavigationControls({
  fromProject,
  navigation,
}: {
  fromProject?: string
  navigation: ActiveResourceSiblingNavigation
}) {
  const navigate = useNavigate()
  const navigateTo = useCallback(
    (target: ResourceSibling) => {
      const common = {
        search: { fromProject, preview: undefined },
        state: { resourceSiblingSession: navigation.id },
      }
      return target.kind === "sample"
        ? navigate({
            ...common,
            params: { sampleMfid: target.mfid },
            to: "/samples/$sampleMfid",
          })
        : navigate({
            ...common,
            params: { datasetMfid: target.mfid },
            to: "/datasets/$datasetMfid",
          })
    },
    [fromProject, navigate, navigation.id]
  )
  const movePrevious = useEffectEvent(() => {
    if (navigation.previous) void navigateTo(navigation.previous)
  })
  const moveNext = useEffectEvent(async () => {
    if (navigation.next) {
      await navigateTo(navigation.next)
      return
    }
    const target = await navigation.loadNext()
    if (target) await navigateTo(target)
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditingOrOverlayTarget(event.target)
      ) {
        return
      }
      if (event.key === "ArrowLeft" && navigation.previous) {
        event.preventDefault()
        movePrevious()
      }
      if (
        event.key === "ArrowRight" &&
        (navigation.next || navigation.hasNextPage) &&
        !navigation.isLoading
      ) {
        event.preventDefault()
        void moveNext()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    navigation.hasNextPage,
    navigation.isLoading,
    navigation.next,
    navigation.previous,
  ])

  const canMoveNext = Boolean(navigation.next || navigation.hasNextPage)
  return (
    <nav
      aria-label="Resources in the originating collection"
      className="flex min-w-0 flex-wrap items-center justify-end gap-2"
    >
      <ResourceSiblingAction
        direction="previous"
        disabled={!navigation.previous}
        fromProject={fromProject}
        sessionId={navigation.id}
        target={navigation.previous}
      />
      <span className="text-supporting text-muted-foreground">
        {navigation.position}
      </span>
      {navigation.next ? (
        <ResourceSiblingAction
          direction="next"
          fromProject={fromProject}
          sessionId={navigation.id}
          target={navigation.next}
        />
      ) : (
        <Button
          aria-label="Next item"
          disabled={!canMoveNext || navigation.isLoading}
          onClick={() => void moveNext()}
          size="sm"
          type="button"
          variant="outline"
        >
          Next
          {navigation.isLoading ? (
            <LoadingMoreIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
              data-icon="inline-end"
            />
          ) : (
            <NextSiblingIcon aria-hidden="true" data-icon="inline-end" />
          )}
        </Button>
      )}
      {navigation.loadError ? (
        <p
          className="basis-full text-right text-supporting text-destructive"
          role="alert"
        >
          The next items could not be loaded. Try again.
        </p>
      ) : null}
    </nav>
  )
}

function ResourceSiblingAction({
  direction,
  disabled = false,
  fromProject,
  sessionId,
  target,
}: {
  direction: "next" | "previous"
  disabled?: boolean
  fromProject?: string
  sessionId: string
  target?: ResourceSibling
}) {
  const label = direction === "previous" ? "Previous" : "Next"
  if (!target || disabled) {
    return (
      <Button disabled size="sm" type="button" variant="outline">
        {direction === "previous" ? (
          <PreviousSiblingIcon aria-hidden="true" data-icon="inline-start" />
        ) : null}
        {label}
        {direction === "next" ? (
          <NextSiblingIcon aria-hidden="true" data-icon="inline-end" />
        ) : null}
      </Button>
    )
  }

  const content = (
    <>
      {direction === "previous" ? (
        <PreviousSiblingIcon aria-hidden="true" data-icon="inline-start" />
      ) : null}
      {label}
      {direction === "next" ? (
        <NextSiblingIcon aria-hidden="true" data-icon="inline-end" />
      ) : null}
    </>
  )
  const common = {
    "aria-label": `${label} item: ${target.name}`,
    children: content,
    search: { fromProject, preview: undefined },
    state: { resourceSiblingSession: sessionId },
  }
  return target.kind === "sample" ? (
    <Button
      render={
        <Link
          {...common}
          params={{ sampleMfid: target.mfid }}
          preload={false}
          to="/samples/$sampleMfid"
        />
      }
      size="sm"
      variant="outline"
    />
  ) : (
    <Button
      render={
        <Link
          {...common}
          params={{ datasetMfid: target.mfid }}
          preload={false}
          to="/datasets/$datasetMfid"
        />
      }
      size="sm"
      variant="outline"
    />
  )
}

function createSiblingSessionId() {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}

function isEditingOrOverlayTarget(target: EventTarget | null) {
  return (
    Boolean(
      document.querySelector("[role='dialog'], [role='listbox'], [role='menu']")
    ) ||
    (target instanceof Element &&
      Boolean(
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='textbox']"
        )
      ))
  )
}

export function staticResourceSiblingCollection(
  items: readonly ResourceSibling[]
): ResourceSiblingCollection {
  const page = { hasNextPage: false, items, total: items.length }
  return {
    ...page,
    loadMore: async () => page,
    startsAtBeginning: true,
  }
}
