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
  NextSiblingIcon,
  PreviousSiblingIcon,
} from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import { PendingIcon } from "@/components/crucible/pending-icon"

export type ResourceSibling = {
  kind: "dataset" | "sample"
  mfid: string
  name: string
}

type ResourceSiblingPage = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  items: readonly ResourceSibling[]
}

export type ResourceSiblingCollection = ResourceSiblingPage & {
  anchorMfid?: string
  configuration?: ResourceSiblingConfiguration
  label: string
  loadNext: () => Promise<ResourceSiblingPage>
  loadPrevious: () => Promise<ResourceSiblingPage>
}

export type ResourceSiblingConfiguration = {
  direction: SortDirection
  scope: "all" | "instrument" | "owner" | "project" | "subtype"
  sort: ResourceSort
}

type ResourceSiblingSequenceFilters = {
  createdFrom?: string
  createdTo?: string
  dataFormat?: string
  dataFormatIsNull?: true
  direction?: SortDirection
  instrumentMfid?: string
  instrumentMfidIsNull?: true
  measurement?: string
  measurementIsNull?: true
  ownerId?: string
  ownerIdIsNull?: true
  projectMfid?: string
  projectMfidIsNull?: true
  sampleType?: string
  sampleTypeIsNull?: true
  sessionName?: string
  sessionNameIsNull?: true
  sort?: ResourceSort
}

type ActiveResourceSiblingSession = ResourceSiblingCollection & {
  id: string
  loadErrorDirection: "next" | "previous" | null
  loadingDirection: "next" | "previous" | null
}

type ResourceSiblingNavigationContextValue = {
  active: ActiveResourceSiblingSession | null
  activate: (collection: ResourceSiblingCollection) => void
  candidateId: string
  clear: () => void
  loadSibling: (
    direction: "next" | "previous",
    sessionId: string,
    currentMfid: string
  ) => Promise<ResourceSibling | undefined>
  registered: readonly ResourceSiblingCollection[]
  registeredByItem: ReadonlyMap<string, ResourceSiblingCollection>
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
  resetKey,
}: {
  children: React.ReactNode
  /** Clears the active sequence when it changes, e.g. on an access mode switch. */
  resetKey?: string
}) {
  const [registered, setRegistered] = useState<
    readonly ResourceSiblingCollection[]
  >([])
  const [active, setActive] = useState<ActiveResourceSiblingSession | null>(
    null
  )
  const [previousResetKey, setPreviousResetKey] = useState(resetKey)
  if (resetKey !== previousResetKey) {
    setPreviousResetKey(resetKey)
    setActive(null)
  }
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
        loadErrorDirection: null,
        loadingDirection: null,
      })
      setCandidateId(createSiblingSessionId())
    },
    []
  )
  const activate = useCallback(
    (collection: ResourceSiblingCollection) => {
      start(createSiblingSessionId(), collection)
    },
    [start]
  )
  const clear = useCallback(() => {
    setActive(null)
    setCandidateId(createSiblingSessionId())
  }, [])
  const loadSibling = useCallback(
    async (
      direction: "next" | "previous",
      sessionId: string,
      currentMfid: string
    ) => {
      const session = active
      const hasMore =
        direction === "next" ? session?.hasNextPage : session?.hasPreviousPage
      if (
        !session ||
        session.id !== sessionId ||
        session.loadingDirection ||
        loadingSession.current === sessionId ||
        !hasMore
      ) {
        return undefined
      }
      loadingSession.current = sessionId
      setActive((current) =>
        current?.id === sessionId
          ? {
              ...current,
              loadErrorDirection: null,
              loadingDirection: direction,
            }
          : current
      )
      try {
        const page = await (direction === "next"
          ? session.loadNext()
          : session.loadPrevious())
        const currentIndex = page.items.findIndex(
          (item) => item.mfid === currentMfid
        )
        setActive((current) =>
          current?.id === sessionId
            ? {
                ...current,
                ...page,
                loadErrorDirection: null,
                loadingDirection: null,
              }
            : current
        )
        return currentIndex >= 0
          ? page.items[currentIndex + (direction === "next" ? 1 : -1)]
          : undefined
      } catch {
        setActive((current) =>
          current?.id === sessionId
            ? {
                ...current,
                loadErrorDirection: direction,
                loadingDirection: null,
              }
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
  const registeredByItem = useMemo(() => {
    const map = new Map<string, ResourceSiblingCollection>()
    for (const candidate of registered) {
      for (const item of candidate.items) {
        const key = `${item.kind}:${item.mfid}`
        if (!map.has(key)) {
          map.set(key, candidate)
        }
      }
    }
    return map
  }, [registered])
  const value = useMemo(
    () => ({
      active,
      activate,
      candidateId,
      clear,
      loadSibling,
      registered,
      registeredByItem,
      register,
      start,
    }),
    [
      active,
      activate,
      candidateId,
      clear,
      loadSibling,
      register,
      registered,
      registeredByItem,
      start,
    ]
  )

  return (
    <ResourceSiblingNavigationContext.Provider value={value}>
      {children}
    </ResourceSiblingNavigationContext.Provider>
  )
}

export function useActivateResourceSiblingCollection() {
  const navigation = useContext(ResourceSiblingNavigationContext)
  return navigation?.activate
}

export function useClearResourceSiblingNavigation() {
  return useContext(ResourceSiblingNavigationContext)?.clear
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
      ? navigation?.registeredByItem.get(`${kind}:${mfid}`)
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
    navigation?.active &&
    (navigation.active.id === sessionId ||
      navigation.active.anchorMfid === currentMfid)
      ? navigation.active
      : undefined
  const index = session?.items.findIndex((item) => item.mfid === currentMfid)
  if (!session || index === undefined || index < 0 || !navigation) return null

  return {
    ...session,
    loadNext: () => navigation.loadSibling("next", session.id, currentMfid),
    loadPrevious: () =>
      navigation.loadSibling("previous", session.id, currentMfid),
    next: session.items.at(index + 1),
    previous: index > 0 ? session.items.at(index - 1) : undefined,
  }
}

export type ActiveResourceSiblingNavigation = NonNullable<
  ReturnType<typeof useActiveResourceSiblingNavigation>
>

export function ResourceSiblingNavigationControls({
  configurationAction,
  fromProject,
  navigation,
}: {
  configurationAction: React.ReactNode
  fromProject?: string
  navigation: ActiveResourceSiblingNavigation | null
}) {
  const navigate = useNavigate()
  const navigateTo = useCallback(
    (target: ResourceSibling) => {
      const common = {
        search: { fromProject, preview: undefined },
        state: navigation
          ? { resourceSiblingSession: navigation.id }
          : undefined,
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
    [fromProject, navigate, navigation]
  )
  const movePrevious = useEffectEvent(() => {
    if (!navigation) return
    if (navigation.previous) {
      void navigateTo(navigation.previous)
      return
    }
    void navigation.loadPrevious().then((target) => {
      if (target) void navigateTo(target)
    })
  })
  const moveNext = useEffectEvent(async () => {
    if (!navigation) return
    if (navigation.next) {
      await navigateTo(navigation.next)
      return
    }
    const target = await navigation.loadNext()
    if (target) await navigateTo(target)
  })

  useEffect(() => {
    if (!navigation) return
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
      if (
        event.key === "ArrowLeft" &&
        (navigation.previous || navigation.hasPreviousPage) &&
        !navigation.loadingDirection
      ) {
        event.preventDefault()
        movePrevious()
      }
      if (
        event.key === "ArrowRight" &&
        (navigation.next || navigation.hasNextPage) &&
        !navigation.loadingDirection
      ) {
        event.preventDefault()
        void moveNext()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    navigation?.hasNextPage,
    navigation?.hasPreviousPage,
    navigation?.loadingDirection,
    navigation?.next,
    navigation?.previous,
  ])

  const canMovePrevious = Boolean(
    navigation?.previous || navigation?.hasPreviousPage
  )
  const canMoveNext = Boolean(navigation?.next || navigation?.hasNextPage)
  if (!navigation) {
    return <nav aria-label="Browse nearby resources">{configurationAction}</nav>
  }
  return (
    <nav
      aria-label="Resource sequence navigation"
      className="flex min-w-0 flex-col items-end gap-1"
    >
      <ButtonGroup aria-label={navigation.label} className="max-w-full">
        {navigation.previous ? (
          <ResourceSiblingAction
            direction="previous"
            fromProject={fromProject}
            sessionId={navigation.id}
            target={navigation.previous}
          />
        ) : (
          <SiblingBoundaryAction
            canLoad={canMovePrevious}
            direction="previous"
            loading={navigation.loadingDirection === "previous"}
            onLoad={movePrevious}
          />
        )}
        {configurationAction}
        {navigation.next ? (
          <ResourceSiblingAction
            direction="next"
            fromProject={fromProject}
            sessionId={navigation.id}
            target={navigation.next}
          />
        ) : (
          <SiblingBoundaryAction
            canLoad={canMoveNext}
            direction="next"
            loading={navigation.loadingDirection === "next"}
            onLoad={() => void moveNext()}
          />
        )}
      </ButtonGroup>
      {navigation.loadErrorDirection ? (
        <p className="text-supporting text-destructive" role="alert">
          The {navigation.loadErrorDirection} items could not be loaded. Try
          again.
        </p>
      ) : null}
    </nav>
  )
}

function SiblingBoundaryAction({
  canLoad,
  direction,
  loading,
  onLoad,
}: {
  canLoad: boolean
  direction: "next" | "previous"
  loading: boolean
  onLoad: () => void
}) {
  const label = direction === "next" ? "Next" : "Previous"
  const Icon = direction === "next" ? NextSiblingIcon : PreviousSiblingIcon
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={`${label} item`}
            disabled={!canLoad || loading}
            onClick={onLoad}
            size="icon"
            type="button"
            variant="outline"
          />
        }
      >
        {loading ? <PendingIcon /> : <Icon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent>
        {canLoad ? `Load the ${direction} items` : `No ${direction} item`}
      </TooltipContent>
    </Tooltip>
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
  const icon =
    direction === "previous" ? (
      <PreviousSiblingIcon aria-hidden="true" />
    ) : (
      <NextSiblingIcon aria-hidden="true" />
    )
  if (!target || disabled) {
    return (
      <Button
        aria-label={`${label} item`}
        disabled
        size="icon"
        type="button"
        variant="outline"
      >
        {icon}
      </Button>
    )
  }

  const common = {
    "aria-label": `${label} item: ${target.name}`,
    children: icon,
    search: { fromProject, preview: undefined },
    state: { resourceSiblingSession: sessionId },
  }
  const action =
    target.kind === "sample" ? (
      <Button
        nativeButton={false}
        render={
          <Link
            {...common}
            params={{ sampleMfid: target.mfid }}
            preload={false}
            to="/samples/$sampleMfid"
          />
        }
        size="icon"
        variant="outline"
      />
    ) : (
      <Button
        nativeButton={false}
        render={
          <Link
            {...common}
            params={{ datasetMfid: target.mfid }}
            preload={false}
            to="/datasets/$datasetMfid"
          />
        }
        size="icon"
        variant="outline"
      />
    )
  return (
    <Tooltip>
      <TooltipTrigger render={action} />
      <TooltipContent>
        {label}: {target.name}
      </TooltipContent>
    </Tooltip>
  )
}

export function resourceSiblingSequenceLabel({
  filters,
  kind,
  scope,
}: {
  filters: ResourceSiblingSequenceFilters
  kind: "dataset" | "sample"
  scope?: "instrument" | "owner" | "project"
}) {
  const context =
    kind === "dataset" && filters.measurement !== undefined
      ? filters.measurement
      : kind === "dataset" && filters.measurementIsNull
        ? "Unspecified measurement"
        : kind === "sample" && filters.sampleType !== undefined
          ? filters.sampleType
          : kind === "sample" && filters.sampleTypeIsNull
            ? "Unspecified sample type"
            : scope === "project"
              ? `Project ${kind}s`
              : scope === "instrument"
                ? "Instrument datasets"
                : scope === "owner"
                  ? `Owner ${kind}s`
                  : hasSequenceFilters(filters)
                    ? `Filtered ${kind}s`
                    : `${kind === "dataset" ? "Datasets" : "Samples"}`
  return `${context} · ${resourceSequenceOrder(filters.sort, filters.direction)}`
}

function hasSequenceFilters(filters: ResourceSiblingSequenceFilters) {
  return Boolean(
    filters.createdFrom ||
    filters.createdTo ||
    filters.dataFormat !== undefined ||
    filters.dataFormatIsNull ||
    filters.instrumentMfid ||
    filters.instrumentMfidIsNull ||
    filters.ownerId !== undefined ||
    filters.ownerIdIsNull ||
    filters.projectMfid ||
    filters.projectMfidIsNull ||
    filters.sessionName !== undefined ||
    filters.sessionNameIsNull
  )
}

function resourceSequenceOrder(
  sort: ResourceSort | undefined,
  direction: SortDirection | undefined
) {
  if (!sort) return "Default order"
  const ascending = direction === "asc"
  if (sort === "name") return ascending ? "Name A-Z" : "Name Z-A"
  if (sort === "created") {
    return ascending ? "Created oldest" : "Created newest"
  }
  return ascending ? "Updated oldest" : "Updated newest"
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
      document.querySelector(
        "[role='dialog'], [role='alertdialog'], [role='listbox'], [role='menu']"
      )
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
  items: readonly ResourceSibling[],
  label: string
): ResourceSiblingCollection {
  const page = {
    hasNextPage: false,
    hasPreviousPage: false,
    items,
  }
  return {
    ...page,
    label,
    loadNext: async () => page,
    loadPrevious: async () => page,
  }
}
