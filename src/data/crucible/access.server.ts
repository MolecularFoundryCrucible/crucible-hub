import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import { readWorkspaceResource } from "./resources.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceResourceAccessGrant,
  WorkspaceResourceAccessPermission,
  WorkspaceResourceAccessPrincipalKind,
  WorkspaceResourceDetail,
  WorkspaceResourcePublicAccessMutation,
} from "./workspace-source"

type FixtureAccessState = {
  grants: WorkspaceResourceAccessGrant[]
  resource: WorkspaceResourceDetail
}

const fixtureAccessStates = new Map<string, FixtureAccessState>()

function fixtureAccessStateKey(
  resourceMfid: string,
  scenario?: FixtureScenario
) {
  return `${scenario ?? "populated"}:${resourceMfid}`
}

function cloneFixtureGrants(grants: readonly WorkspaceResourceAccessGrant[]) {
  return grants.map((grant) => ({ ...grant }))
}

export function resetWorkspaceFixtureAccessState() {
  fixtureAccessStates.clear()
}

async function fixtureResource(
  resourceMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourceDetail> {
  if (requestSignal?.aborted) throw requestSignal.reason
  const resource = await readWorkspaceResource(
    resourceMfid,
    scenario,
    requestSignal
  )
  if (!resource) throw new CrucibleResponseError(404)
  return resource
}

function fixtureOwnerGrant(
  resource: WorkspaceResourceDetail
): WorkspaceResourceAccessGrant | null {
  if (!resource.owner) return null
  return {
    display_name: `${resource.owner.first_name} ${resource.owner.last_name}`,
    permission: "owner",
    principal_id: resource.owner.unique_id,
    principal_type: "user",
    slug: resource.owner.username,
  }
}

function fixtureProjectGrant(
  resource: WorkspaceResourceDetail
): WorkspaceResourceAccessGrant | null {
  if (
    (resource.kind !== "sample" && resource.kind !== "dataset") ||
    !resource.project
  ) {
    return null
  }
  return {
    display_name: resource.project.title,
    permission: "viewer",
    principal_id: resource.project.unique_id,
    principal_type: "project",
    slug: resource.project.project_id,
  }
}

function fixturePublicGrant(
  resource: WorkspaceResourceDetail
): WorkspaceResourceAccessGrant | null {
  if (
    (resource.kind !== "sample" && resource.kind !== "dataset") ||
    !resource.public
  ) {
    return null
  }
  return {
    display_name: "Public",
    permission: "viewer",
    principal_id: "public",
    principal_type: "public",
    slug: null,
  }
}

function fixtureInstrumentSeedGrants(
  resource: WorkspaceResourceDetail
): WorkspaceResourceAccessGrant[] {
  if (
    resource.kind !== "instrument" ||
    resource.unique_id !== "01J6Y8N4Q2R7M9K3T5V0W1X2Z4"
  ) {
    return []
  }
  return [
    {
      display_name: "Morgan Lee",
      permission: "editor",
      principal_id: "0000-0000-0000-0018",
      principal_type: "user",
      slug: "morgan.lee",
    },
  ]
}

function fixtureAccessGrants(
  resource: WorkspaceResourceDetail
): WorkspaceResourceAccessGrant[] {
  return [
    fixtureOwnerGrant(resource),
    ...fixtureInstrumentSeedGrants(resource),
    fixtureProjectGrant(resource),
    fixturePublicGrant(resource),
  ].filter((grant): grant is WorkspaceResourceAccessGrant => grant !== null)
}

async function fixtureAccessState(
  resourceMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
) {
  const key = fixtureAccessStateKey(resourceMfid, scenario)
  const existing = fixtureAccessStates.get(key)
  if (existing) return existing
  const resource = await fixtureResource(resourceMfid, scenario, requestSignal)
  const state = { grants: fixtureAccessGrants(resource), resource }
  fixtureAccessStates.set(key, state)
  return state
}

function fixtureGrant(
  kind: WorkspaceResourceAccessPrincipalKind,
  principal: string,
  permission: WorkspaceResourceAccessPermission,
  scenario?: FixtureScenario
): WorkspaceResourceAccessGrant {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  if (kind === "users") {
    const person = source.workspace.people.find(
      (candidate) => candidate.unique_id === principal
    )
    return {
      display_name: person ? `${person.first_name} ${person.last_name}` : null,
      permission,
      principal_id: principal,
      principal_type: "user",
      slug: person?.username ?? null,
    }
  }
  const project = source.workspace.projects.find(
    (candidate) => candidate.unique_id === principal
  )
  return {
    display_name: project?.title ?? null,
    permission,
    principal_id: principal,
    principal_type: "project",
    slug: project?.project_id ?? null,
  }
}

function fixturePrincipalType(kind: WorkspaceResourceAccessPrincipalKind) {
  return kind === "users" ? "user" : "project"
}

function fixtureResourceWithPublic(
  resource: WorkspaceResourceDetail,
  publicAccess: boolean
) {
  if (resource.kind !== "sample" && resource.kind !== "dataset") {
    throw new CrucibleResponseError(404)
  }
  return { ...resource, public: publicAccess }
}

export async function readWorkspaceResourceAccess(
  resourceMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceResourceAccessGrant[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return cloneFixtureGrants(
      (await fixtureAccessState(resourceMfid, scenario, requestSignal)).grants
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/resources/{mfid}/access", {
    params: { path: { mfid: resourceMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response)
  return result.data
}

export async function setWorkspaceResourceAccessGrant(
  resourceMfid: string,
  kind: WorkspaceResourceAccessPrincipalKind,
  principal: string,
  permission: WorkspaceResourceAccessPermission,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceResourceAccessGrant[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const state = await fixtureAccessState(
      resourceMfid,
      scenario,
      requestSignal
    )
    const grants = state.grants
    const principalType = fixturePrincipalType(kind)
    const existing = grants.find(
      (grant) =>
        grant.principal_id === principal &&
        grant.principal_type === principalType
    )
    if (existing?.permission === "owner") throw new CrucibleResponseError(403)
    const replacement = fixtureGrant(kind, principal, permission, scenario)
    state.grants = existing
      ? grants.map((grant) => (grant === existing ? replacement : grant))
      : [...grants, replacement]
    return cloneFixtureGrants(state.grants)
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PUT(
    "/resources/{mfid}/access/{kind}/{principal}",
    {
      body: { permission },
      params: { path: { kind, mfid: resourceMfid, principal } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response)
  }
  return readWorkspaceResourceAccess(resourceMfid, scenario, requestSignal)
}

export async function revokeWorkspaceResourceAccessGrant(
  resourceMfid: string,
  kind: WorkspaceResourceAccessPrincipalKind,
  principal: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceResourceAccessGrant[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const state = await fixtureAccessState(
      resourceMfid,
      scenario,
      requestSignal
    )
    const grants = state.grants
    const principalType = fixturePrincipalType(kind)
    const existing = grants.find(
      (grant) =>
        grant.principal_id === principal &&
        grant.principal_type === principalType
    )
    if (!existing) throw new CrucibleResponseError(404)
    if (existing.permission === "owner") throw new CrucibleResponseError(403)
    state.grants = grants.filter((grant) => grant !== existing)
    return cloneFixtureGrants(state.grants)
  }

  const client = createCrucibleClient(configuration)
  const result = await client.DELETE(
    "/resources/{mfid}/access/{kind}/{principal}",
    {
      params: { path: { kind, mfid: resourceMfid, principal } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response)
  }
  return readWorkspaceResourceAccess(resourceMfid, scenario, requestSignal)
}

async function mutateWorkspaceResourcePublicAccess(
  resourceMfid: string,
  publicAccess: boolean,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourcePublicAccessMutation> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const state = await fixtureAccessState(
      resourceMfid,
      scenario,
      requestSignal
    )
    state.resource = fixtureResourceWithPublic(state.resource, publicAccess)
    const publicGrant = fixturePublicGrant(state.resource)
    state.grants = [
      ...state.grants.filter((grant) => grant.principal_type !== "public"),
      ...(publicGrant ? [publicGrant] : []),
    ]
    return {
      grants: cloneFixtureGrants(state.grants),
      resource: { ...state.resource },
    }
  }

  const client = createCrucibleClient(configuration)
  const result = publicAccess
    ? await client.PUT("/resources/{mfid}/access/public", {
        params: { path: { mfid: resourceMfid } },
        signal: crucibleRequestSignal(requestSignal),
      })
    : await client.DELETE("/resources/{mfid}/access/public", {
        params: { path: { mfid: resourceMfid } },
        signal: crucibleRequestSignal(requestSignal),
      })
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response)
  }
  const [grants, resource] = await Promise.all([
    readWorkspaceResourceAccess(resourceMfid, scenario, requestSignal),
    readWorkspaceResource(resourceMfid, scenario, requestSignal),
  ])
  if (!resource) throw new CrucibleResponseError(404)
  return { grants, resource }
}

export function publishWorkspaceResourceAccess(
  resourceMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
) {
  return mutateWorkspaceResourcePublicAccess(
    resourceMfid,
    true,
    scenario,
    requestSignal
  )
}

export function unpublishWorkspaceResourceAccess(
  resourceMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
) {
  return mutateWorkspaceResourcePublicAccess(
    resourceMfid,
    false,
    scenario,
    requestSignal
  )
}
