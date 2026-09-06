import { createContext, useContext, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import {
  getRouteApi,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { z } from "zod"

import { useWorkspaceScope } from "./workspace-provider"

const previewMfidSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)
const invalidPreviewSearchValue = ""
export const globalDataPreviewOrigin = "global-data"
export const resourcePreviewSearchSchema = z.object({
  preview: previewMfidSchema.optional().catch(invalidPreviewSearchValue),
})
const trailSchema = z.object({
  hostKind: z.enum(["data", "project-data", "resource"]).default("resource"),
  owner: z.string(),
  origin: previewMfidSchema,
  previous: z.array(previewMfidSchema).max(20),
  returnIndex: z.number().int().nonnegative().optional(),
})
type PreviewTrail = z.infer<typeof trailSchema>
export type ResourcePreviewHost =
  | { kind: "data"; preview: unknown }
  | { kind: "project-data"; preview: unknown; projectMfid: string }
  | {
      kind: "resource"
      preview: unknown
      resourceKind: "dataset" | "sample"
      resourceMfid: string
    }

export function resolveResourcePreview(value: unknown) {
  const result = previewMfidSchema.safeParse(value)
  return {
    preview: result.success ? result.data : undefined,
    invalidPreview: value !== undefined && !result.success,
  }
}

export function resolveResourcePreviewTrail(
  value: unknown,
  owner: string,
  hostKind: ResourcePreviewHost["kind"],
  origin: string
) {
  const result = trailSchema.safeParse(value)
  return result.success &&
    result.data.owner === owner &&
    result.data.hostKind === hostKind &&
    result.data.origin === origin
    ? result.data
    : undefined
}

export function updateResourcePreviewTrail(
  previous: readonly string[],
  preview: string | undefined,
  target: string,
  back = false
) {
  if (back) return previous.slice(0, -1)
  if (!preview || preview === target) return [...previous]
  return [...previous, preview].slice(-20)
}

export function isPlainPreviewNavigation(event: {
  altKey: boolean
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  target: string
}) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.target !== "_blank"
  )
}

export function createResourcePreviewOwnerMarker() {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}

declare module "@tanstack/react-router" {
  interface HistoryState {
    resourcePreview?: PreviewTrail
  }
}

const owners = new WeakMap<QueryClient, { scope: string; token: string }>()
const dataRoute = getRouteApi("/_app/data")
const sampleRoute = getRouteApi("/_app/samples/$sampleMfid")
const projectDataRoute = getRouteApi("/_app/projects/$projectMfid/")
type DataSearch = ReturnType<typeof dataRoute.useSearch>
type ResourceSearch = ReturnType<typeof sampleRoute.useSearch>
type ProjectDataSearch = ReturnType<typeof projectDataRoute.useSearch>

export function useResourcePreviewNavigation(host: ResourcePreviewHost) {
  const origin =
    host.kind === "resource"
      ? host.resourceMfid
      : host.kind === "project-data"
        ? host.projectMfid
        : globalDataPreviewOrigin
  const { preview, invalidPreview } = resolveResourcePreview(host.preview)
  const hasPreview = preview !== undefined || invalidPreview
  const scope = useWorkspaceScope()
  const client = useQueryClient()
  const router = useRouter()
  const trigger = useRef<HTMLElement | null>(null)
  const location = useRouterState({ select: (state) => state.location })
  const identity = JSON.stringify(scope)
  let ownership = owners.get(client)
  if (!ownership || ownership.scope !== identity) {
    ownership = { scope: identity, token: createResourcePreviewOwnerMarker() }
    owners.set(client, ownership)
  }
  const owner = ownership.token
  const ownedTrail = resolveResourcePreviewTrail(
    location.state.resourcePreview,
    owner,
    host.kind,
    origin
  )
  const trail = preview ? ownedTrail : undefined
  const previous = trail?.previous.at(-1)
  const state = (target: string, back = false) => ({
    resourcePreview: {
      hostKind: host.kind,
      owner,
      origin,
      previous: updateResourcePreviewTrail(
        trail?.previous ?? [],
        preview,
        target,
        back
      ),
      returnIndex: hasPreview
        ? ownedTrail?.returnIndex
        : router.history.location.state.__TSR_index,
    },
  })
  const targetPreview = (target: string) =>
    previewMfidSchema.safeParse(target).success
      ? target
      : invalidPreviewSearchValue

  const close = () => {
    if (
      ownedTrail?.returnIndex !== undefined &&
      location.state.__TSR_index === ownedTrail.returnIndex + 1
    ) {
      router.history.back()
      return
    }
    const common = {
      hash: true as const,
      state: {},
      replace: true,
      resetScroll: false,
    }
    if (host.kind === "resource") {
      const search = (currentSearch: ResourceSearch) => ({
        ...currentSearch,
        preview: undefined,
      })
      if (host.resourceKind === "sample") {
        void router.navigate({
          ...common,
          to: "/samples/$sampleMfid",
          params: { sampleMfid: host.resourceMfid },
          search,
        })
      } else {
        void router.navigate({
          ...common,
          to: "/datasets/$datasetMfid",
          params: { datasetMfid: host.resourceMfid },
          search,
        })
      }
      return
    }
    if (host.kind === "data") {
      void router.navigate({
        ...common,
        from: "/data",
        to: "/data",
        search: (currentSearch: DataSearch) => ({
          ...currentSearch,
          preview: undefined,
        }),
      })
      return
    }
    void router.navigate({
      ...common,
      from: "/projects/$projectMfid",
      to: "/projects/$projectMfid",
      params: { projectMfid: host.projectMfid },
      search: (currentSearch: ProjectDataSearch) => ({
        ...currentSearch,
        preview: undefined,
      }),
    })
  }
  return {
    host,
    preview,
    invalidPreview,
    previous,
    state,
    targetPreview,
    close,
    trigger,
    replace: hasPreview,
  }
}

export type ResourcePreviewNavigation = ReturnType<
  typeof useResourcePreviewNavigation
>

export const ResourcePreviewContext =
  createContext<ResourcePreviewNavigation | null>(null)

export function ResourcePreviewLink({
  mfid,
  children,
  className,
  back = false,
  resourceKind,
  ...props
}: {
  mfid: string
  children: React.ReactNode
  className?: string
  back?: boolean
  resourceKind?: "dataset" | "instrument" | "project" | "sample"
} & Omit<
  React.ComponentProps<typeof Link>,
  "children" | "className" | "to" | "params" | "search" | "state"
>) {
  const navigation = useContext(ResourcePreviewContext)
  if (!navigation) {
    if (resourceKind === "sample") {
      return (
        <Link
          {...props}
          to="/samples/$sampleMfid"
          params={{ sampleMfid: mfid }}
          className={className}
        >
          {children}
        </Link>
      )
    }
    if (resourceKind === "dataset") {
      return (
        <Link
          {...props}
          to="/datasets/$datasetMfid"
          params={{ datasetMfid: mfid }}
          className={className}
        >
          {children}
        </Link>
      )
    }
    if (resourceKind === "project") {
      return (
        <Link
          {...props}
          to="/projects/$projectMfid"
          params={{ projectMfid: mfid }}
          className={className}
        >
          {children}
        </Link>
      )
    }
    if (resourceKind === "instrument") {
      return (
        <Link
          {...props}
          to="/instruments/$instrumentMfid"
          params={{ instrumentMfid: mfid }}
          className={className}
        >
          {children}
        </Link>
      )
    }
    return (
      <Link
        {...props}
        to="/resources/$resourceMfid"
        params={{ resourceMfid: mfid }}
        className={className}
      >
        {children}
      </Link>
    )
  }

  const sameTarget = navigation.preview === mfid
  const onClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    props.onClick?.(event)
    if (event.defaultPrevented) return
    const plainNavigation = isPlainPreviewNavigation({
      altKey: event.altKey,
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      target: event.currentTarget.target,
    })
    if (!navigation.preview && !navigation.invalidPreview && plainNavigation) {
      navigation.trigger.current = event.currentTarget
    }
    if (sameTarget && plainNavigation) event.preventDefault()
  }
  const common = {
    ...props,
    className,
    hash: true as const,
    onClick,
    preload: false as const,
    replace: navigation.replace,
    resetScroll: false,
    state: navigation.state(mfid, back),
  }

  if (navigation.host.kind === "resource") {
    const search = (currentSearch: ResourceSearch) => ({
      ...currentSearch,
      preview: navigation.targetPreview(mfid),
    })
    if (navigation.host.resourceKind === "sample") {
      return (
        <Link
          {...common}
          to="/samples/$sampleMfid"
          params={{ sampleMfid: navigation.host.resourceMfid }}
          search={search}
        >
          {children}
        </Link>
      )
    }
    return (
      <Link
        {...common}
        to="/datasets/$datasetMfid"
        params={{ datasetMfid: navigation.host.resourceMfid }}
        search={search}
      >
        {children}
      </Link>
    )
  }
  if (navigation.host.kind === "data") {
    return (
      <Link
        {...common}
        from="/data"
        to="/data"
        search={(currentSearch: DataSearch) => ({
          ...currentSearch,
          preview: navigation.targetPreview(mfid),
        })}
      >
        {children}
      </Link>
    )
  }
  return (
    <Link
      {...common}
      to="/projects/$projectMfid"
      params={{ projectMfid: navigation.host.projectMfid }}
      search={(currentSearch: ProjectDataSearch) => ({
        ...currentSearch,
        preview: navigation.targetPreview(mfid),
      })}
    >
      {children}
    </Link>
  )
}
