import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import { normalizeScientificMetadata } from "./scientific-metadata"
import type { WorkspaceProject, WorkspaceProjectPage } from "./workspace-source"
import type { FixtureScenario } from "./fixture-scenarios"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

export type WorkspaceProjectMember = Schema<"AccessGroupMemberRead">
export type WorkspaceProjectMembershipRole = Exclude<
  Schema<"ProjectMembershipRole">,
  "owner"
>

function toWorkspaceProject(
  project: Schema<"ProjectWithLead"> | Schema<"ProjectMinimalRead">
): WorkspaceProject {
  if (!("organization" in project)) {
    return {
      unique_id: project.unique_id,
      project_id: project.project_id,
      title: project.title,
      capabilities: null,
    }
  }

  return {
    unique_id: project.unique_id,
    project_id: project.project_id,
    title: project.title,
    organization: project.organization,
    lead: project.lead ?? null,
    project_lead_orcid: project.project_lead_orcid,
    scientific_metadata: normalizeScientificMetadata(
      project.scientific_metadata
    ),
    capabilities: project.capabilities ?? null,
    status: project.status ?? null,
    ...(project.members === undefined ? {} : { members: project.members }),
    creation_time: project.creation_time,
    modification_time: project.modification_time,
  }
}

type ProjectDescriptiveChanges = {
  organization?: string
  project_id?: string
  title?: string | null
}

export async function readWorkspaceProjects(
  {
    limit,
    offset,
    scenario,
  }: {
    limit: number
    offset: number
    scenario?: FixtureScenario
  },
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return {
      items: source.workspace.projects.slice(offset, offset + limit),
      limit,
      offset,
      total: source.workspace.projects.length,
    }
  }

  const client = createCrucibleClient(configuration)
  const accountResult = await client.GET("/account/profile", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!accountResult.data) {
    throw new CrucibleResponseError(accountResult.response.status)
  }

  const projectsResult = await client.GET("/users/{user_id}/projects", {
    params: {
      path: { user_id: accountResult.data.unique_id },
      query: { limit, offset },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!projectsResult.data) {
    throw new CrucibleResponseError(projectsResult.response.status)
  }

  return {
    items: projectsResult.data.items.map(toWorkspaceProject),
    limit: projectsResult.data.limit,
    offset: projectsResult.data.offset ?? offset,
    total: projectsResult.data.total ?? null,
  }
}

export async function readWorkspaceProject(
  projectMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProject | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return (
      source.workspace.projects.find(
        (project) => project.unique_id === projectMfid
      ) ?? null
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/projects/{project_ref}", {
    params: {
      path: { project_ref: projectMfid },
      query: { include_members: true, include_metadata: true },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return toWorkspaceProject(result.data)
}

export async function patchWorkspaceProject(
  projectMfid: string,
  changes: ProjectDescriptiveChanges,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProject> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const project = source.workspace.projects.find(
      (candidate) => candidate.unique_id === projectMfid
    )
    if (!project || !("organization" in project)) {
      throw new CrucibleResponseError(404)
    }
    return toWorkspaceProject({ ...project, ...changes })
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PATCH("/projects/{project_ref}", {
    body: changes,
    params: { path: { project_ref: projectMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return toWorkspaceProject(result.data)
}

function fixtureProjectMembers(
  projectMfid: string,
  scenario: FixtureScenario | undefined
): WorkspaceProjectMember[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const project = source.workspace.projects.find(
    (candidate) => candidate.unique_id === projectMfid
  )
  if (!project) throw new CrucibleResponseError(404)
  return "members" in project && project.members ? [...project.members] : []
}

function fixtureMemberForUser(
  userId: string,
  role: WorkspaceProjectMembershipRole,
  scenario: FixtureScenario | undefined
): WorkspaceProjectMember {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const person = source.workspace.people.find(
    (candidate) => candidate.unique_id === userId
  )
  return {
    first_name: person?.first_name ?? "Fixture",
    is_service_account: false,
    last_name: person?.last_name ?? "Member",
    role,
    unique_id: userId,
    username: person?.username ?? userId,
  }
}

export async function addWorkspaceProjectMember(
  projectMfid: string,
  userId: string,
  role: WorkspaceProjectMembershipRole,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectMember[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const members = fixtureProjectMembers(projectMfid, scenario)
    const existingMember = members.find((member) => member.unique_id === userId)
    if (existingMember) {
      if (existingMember.role !== role) throw new CrucibleResponseError(409)
      return members
    }
    return [...members, fixtureMemberForUser(userId, role, scenario)]
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/projects/{project_ref}/users/{orcid}", {
    params: {
      path: { orcid: userId, project_ref: projectMfid },
      query: { role },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return result.data
}

export async function updateWorkspaceProjectMemberRole(
  projectMfid: string,
  userId: string,
  role: WorkspaceProjectMembershipRole,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectMember[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const members = fixtureProjectMembers(projectMfid, scenario)
    if (
      members.some(
        (member) => member.unique_id === userId && member.role === "owner"
      )
    ) {
      throw new CrucibleResponseError(403)
    }
    if (!members.some((member) => member.unique_id === userId)) {
      throw new CrucibleResponseError(404)
    }
    return members.map((member) =>
      member.unique_id === userId ? { ...member, role } : member
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PATCH("/projects/{project_ref}/users/{orcid}", {
    params: {
      path: { orcid: userId, project_ref: projectMfid },
      query: { role },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return result.data
}

export async function removeWorkspaceProjectMember(
  projectMfid: string,
  userId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectMember[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const members = fixtureProjectMembers(projectMfid, scenario)
    const member = members.find((candidate) => candidate.unique_id === userId)
    if (!member) throw new CrucibleResponseError(404)
    if (member.role === "owner") throw new CrucibleResponseError(403)
    return members.filter((candidate) => candidate.unique_id !== userId)
  }

  const client = createCrucibleClient(configuration)
  const result = await client.DELETE("/projects/{project_ref}/users/{orcid}", {
    params: { path: { orcid: userId, project_ref: projectMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return result.data
}
