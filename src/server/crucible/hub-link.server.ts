import "@tanstack/react-start/server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { z } from "zod"

import {
  hubIssuerMatches,
  hubClientPost,
  hubLinkCallbackUri,
  hubSessionAccessToken,
  hubSessionId,
  hubSharedSessions,
} from "./hub-auth.server"
import { readLink, saveLink, takeLink } from "./hub-session-store.server"
import type { SharedLink } from "./hub-session-store.server"
import { CrucibleResponseError } from "./request-error.server"

const linkLifetime = 10 * 60 * 1000

const linksKey = Symbol.for("crucible.hub.auth.local-links")
const globals = globalThis as typeof globalThis & {
  [linksKey]?: Map<string, SharedLink>
}
const localLinks = (globals[linksKey] ??= new Map())

const linkStatuses = [
  "available",
  "already_yours",
  "linked_elsewhere",
  "second_orcid",
  "orcid_of_another",
] as const

export type HubLinkStatus = (typeof linkStatuses)[number] | "unknown"

const previewSchema = z.object({
  label: z.string().nullable().optional(),
  orcid: z.string().nullable().optional(),
  provider_key: z.string().nullable().optional(),
  provider_name: z.string(),
  status: z.string(),
})

export type HubLinkPreview = {
  label: string | null
  orcid: string | null
  providerName: string
  status: HubLinkStatus
}

export type HubLinkCallbackOutcome =
  "pending" | "retry" | "cancelled" | "expired" | "failed" | "signed-out"

function randomValue() {
  return randomBytes(32).toString("base64url")
}

async function storeLink(sessionId: string, link: SharedLink) {
  if (hubSharedSessions()) await saveLink(sessionId, link)
  else localLinks.set(sessionId, link)
}

async function pendingLink(sessionId: string) {
  const link = hubSharedSessions()
    ? await readLink(sessionId)
    : (localLinks.get(sessionId) ?? null)
  if (!link) return null
  if (link.expiresAt <= Date.now()) {
    await endLink(sessionId)
    return null
  }
  return link
}

async function endLink(sessionId: string) {
  if (hubSharedSessions()) await takeLink(sessionId)
  else localLinks.delete(sessionId)
}

function linkExpired() {
  return new CrucibleResponseError(new Response(null, { status: 409 }), {
    detail: { code: "link_expired" },
  })
}

function stateMatches(expected: string, actual: string) {
  const left = Buffer.from(expected)
  const right = Buffer.from(actual)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function createHubLink(providerKey: string) {
  const sessionId = hubSessionId()
  for (const [id, link] of localLinks) {
    if (link.expiresAt <= Date.now()) localLinks.delete(id)
  }
  const state = randomValue()
  const verifier = randomValue()
  await storeLink(sessionId, {
    state,
    verifier,
    providerKey,
    expiresAt: Date.now() + linkLifetime,
  })
  return {
    callbackUri: hubLinkCallbackUri(),
    challenge: createHash("sha256").update(verifier).digest("base64url"),
    state,
  }
}

export async function finishHubLinkCallback(input: {
  code: string | null
  error: string | null
  iss: string | null
  state: string | null
}): Promise<HubLinkCallbackOutcome> {
  let sessionId: string
  try {
    sessionId = hubSessionId()
  } catch {
    return "signed-out"
  }
  const link = await pendingLink(sessionId)
  if (!link) return "expired"
  if (!input.state || !stateMatches(link.state, input.state)) return "failed"
  if (!hubIssuerMatches(input.iss)) {
    await endLink(sessionId)
    return "failed"
  }
  if (input.error !== null) {
    await endLink(sessionId)
    if (input.error === "login_required") return "retry"
    return input.error === "access_denied" ? "cancelled" : "failed"
  }
  if (!input.code) {
    await endLink(sessionId)
    return "failed"
  }
  await storeLink(sessionId, { ...link, code: input.code })
  return "pending"
}

async function linkRequest(path: string, signal?: AbortSignal) {
  const sessionId = hubSessionId()
  const link = await pendingLink(sessionId)
  if (!link?.code) return null
  const response = await hubClientPost(
    path,
    {
      code: link.code,
      code_verifier: link.verifier,
      redirect_uri: hubLinkCallbackUri(),
      session_token: await hubSessionAccessToken(),
    },
    signal
  )
  if (response.ok) return { response, sessionId }
  const body: unknown = await response.json().catch(() => undefined)
  if (response.status === 401) {
    await endLink(sessionId)
    throw linkExpired()
  }
  if (response.status === 409) await endLink(sessionId)
  throw new CrucibleResponseError(response, body)
}

export async function previewHubLink(
  signal?: AbortSignal
): Promise<HubLinkPreview | null> {
  const result = await linkRequest("/oauth/link/preview", signal)
  if (!result) return null
  const preview = previewSchema.parse(await result.response.json())
  return {
    label: preview.label ?? null,
    orcid: preview.orcid ?? null,
    providerName: preview.provider_name,
    status:
      linkStatuses.find((status) => status === preview.status) ?? "unknown",
  }
}

export async function confirmHubLink(signal?: AbortSignal) {
  const result = await linkRequest("/oauth/link/confirm", signal)
  if (!result) throw linkExpired()
  await endLink(result.sessionId)
}

export async function cancelHubLink() {
  await endLink(hubSessionId())
}
