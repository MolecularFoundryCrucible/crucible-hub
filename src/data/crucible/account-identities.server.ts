import "@tanstack/react-start/server-only"

import { hubApiAuthorizationUrl } from "@/server/crucible/hub-auth.server"
import { createHubLink } from "@/server/crucible/hub-link.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { WorkspaceAccountIdentity } from "./workspace-source"

function apiConfiguration() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  return configuration
}

function toWorkspaceAccountIdentity(
  identity: WorkspaceAccountIdentity
): WorkspaceAccountIdentity {
  return {
    created_at: identity.created_at,
    id: identity.id,
    label: identity.label ?? null,
    last_used_at: identity.last_used_at ?? null,
    orcid: identity.orcid ?? null,
    provider_key: identity.provider_key ?? null,
    provider_name: identity.provider_name,
    verified_at: identity.verified_at ?? null,
  }
}

export async function readWorkspaceAccountIdentities(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAccountIdentity[]> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const { account, referenceTime } = source.workspace
    return [
      {
        created_at: referenceTime,
        id: 1,
        label: null,
        last_used_at: referenceTime,
        orcid: account.orcid ?? null,
        provider_key: "orcid",
        provider_name: "ORCID",
        verified_at: account.orcid_verified ? referenceTime : null,
      },
    ]
  }
  const result = await createCrucibleClient(configuration).GET(
    "/account/identities",
    { signal: crucibleRequestSignal(requestSignal) }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return result.data.map(toWorkspaceAccountIdentity)
}

export async function removeWorkspaceAccountIdentity(
  identityId: number,
  requestSignal?: AbortSignal
) {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") {
    throw new CrucibleResponseError(new Response(null, { status: 409 }), {
      detail: { code: "last_sign_in_method" },
    })
  }
  const result = await createCrucibleClient(configuration).DELETE(
    "/account/identities/{identity_id}",
    {
      params: { path: { identity_id: identityId } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}

export async function startWorkspaceAccountLink(
  providerKey: string,
  requestSignal?: AbortSignal
): Promise<{ authorizationUrl: string }> {
  const configuration = apiConfiguration()
  if (
    configuration.mode === "fixture" ||
    process.env.HUB_DATA_SOURCE !== "hub-auth"
  ) {
    throw new CrucibleResponseError(403)
  }
  const link = await createHubLink(providerKey)
  const result = await createCrucibleClient(configuration).POST(
    "/account/identities/{provider_key}/link",
    {
      body: {
        callback_uri: link.callbackUri,
        code_challenge: link.challenge,
        state: link.state,
      },
      params: { path: { provider_key: providerKey } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    authorizationUrl: hubApiAuthorizationUrl(result.data.authorization_url),
  }
}
