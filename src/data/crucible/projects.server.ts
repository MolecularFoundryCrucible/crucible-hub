import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { parseTimestamp } from "@/lib/format"
import { dayStartUtc } from "@/lib/time-zone"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { viewerTimeZone } from "@/server/crucible/time-zone.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import { normalizeScientificMetadata } from "./scientific-metadata"
import type { CollectionAffiliation } from "./collection-query"
import { fixtureCursorPage } from "./pagination"
import type {
  WorkspaceProject,
  WorkspaceProjectPage,
  WorkspaceProjectSort,
  WorkspaceSortDirection,
} from "./workspace-source"
import type { FixtureScenario } from "./fixture-scenarios"
import type { WorkspacePrivilegeMode } from "./privilege-mode"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

export type WorkspaceProjectMember = Schema<"AccessGroupMemberRead">
export type WorkspaceProjectMembershipRole = Exclude<
  Schema<"ProjectMembershipRole">,
  "owner"
>

export function toWorkspaceProject(
  project: Schema<"ProjectRead"> | Schema<"ProjectWithLead">
): WorkspaceProject {
  return {
    unique_id: project.unique_id,
    project_id: project.project_id,
    title: project.title,
    organization: project.organization,
    lead: "lead" in project ? (project.lead ?? null) : null,
    project_lead_orcid: project.project_lead_orcid,
    role: "role" in project ? (project.role ?? null) : null,
    scientific_metadata:
      "scientific_metadata" in project
        ? normalizeScientificMetadata(project.scientific_metadata)
        : null,
    capabilities: project.capabilities ?? null,
    status: project.status ?? null,
    ...("members" in project && project.members !== undefined
      ? { members: project.members }
      : {}),
    creation_time:
      "creation_time" in project ? project.creation_time : undefined,
    modification_time:
      "modification_time" in project ? project.modification_time : undefined,
    last_activity_at:
      "last_activity_at" in project ? project.last_activity_at : undefined,
  }
}

type ProjectDescriptiveChanges = {
  organization?: string
  project_id?: string
  title?: string | null
}

export async function readWorkspaceProjects(
  {
    activeSince,
    affiliation,
    cursor,
    direction,
    includeTotal,
    limit,
    memberRef,
    memberRole,
    privilegeMode,
    scenario,
    sort,
  }: {
    activeSince?: string
    affiliation?: CollectionAffiliation
    cursor?: string
    direction?: WorkspaceSortDirection
    includeTotal?: boolean
    limit: number
    memberRef?: string | readonly string[]
    memberRole?:
      | components["schemas"]["AccessPermission"]
      | components["schemas"]["AccessPermission"][]
    privilegeMode?: WorkspacePrivilegeMode
    scenario?: FixtureScenario
    sort?: WorkspaceProjectSort
  },
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  const activeSinceTimestamp = activeSince
    ? dayStartUtc(activeSince, viewerTimeZone())
    : undefined
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario, privilegeMode)
    if (source.status === "unavailable") throw new Error(source.reason)
    let projects = source.workspace.projects
    if (memberRef) {
      const matchRefs = Array.isArray(memberRef) ? memberRef : [memberRef]
      const matchRoles = memberRole
        ? Array.isArray(memberRole)
          ? memberRole
          : [memberRole]
        : null
      projects = projects.filter((project) => {
        return matchRefs.every((ref) => {
          const isAccount = ref === source.workspace.account.unique_id
          const member =
            "members" in project
              ? project.members?.find((m) => m.unique_id === ref)
              : undefined
          const effectiveRole =
            member?.role ??
            (project.lead?.unique_id === ref ||
            project.project_lead_orcid === ref
              ? "owner"
              : isAccount
                ? (project.role ?? null)
                : null)
          if (!effectiveRole) return false
          return (
            !matchRoles || matchRoles.some((role) => role === effectiveRole)
          )
        })
      })
      if (typeof memberRef === "string") {
        projects = projects.map((project) => {
          const member =
            "members" in project
              ? project.members?.find((m) => m.unique_id === memberRef)
              : undefined
          const role =
            member?.role ??
            (project.lead?.unique_id === memberRef ||
            project.project_lead_orcid === memberRef
              ? "owner"
              : (project.role ?? null))
          return {
            ...project,
            role,
          }
        })
      }
    } else if (affiliation) {
      projects = projects.filter(
        (project) =>
          "lead" in project &&
          project.lead?.unique_id === source.workspace.account.unique_id
      )
    }
    if (activeSinceTimestamp) {
      projects = projects.filter((project) => {
        const activityTime =
          "last_activity_at" in project ? project.last_activity_at : undefined
        const activity = parseTimestamp(activityTime)?.getTime()
        return (
          activity !== undefined && activity >= Date.parse(activeSinceTimestamp)
        )
      })
    }
    if (sort) {
      const dir = direction === "desc" ? -1 : 1
      projects = [...projects].sort((a, b) => {
        if (sort === "title")
          return dir * (a.title || "").localeCompare(b.title || "")
        if (sort === "project_id")
          return dir * (a.project_id || "").localeCompare(b.project_id || "")
        if (sort === "created")
          return (
            dir * ((a.creation_time || "") > (b.creation_time || "") ? 1 : -1)
          )
        if (sort === "activity")
          return (
            dir *
            ((a.last_activity_at || "") > (b.last_activity_at || "") ? 1 : -1)
          )
        return (
          dir *
          ((a.modification_time || "") > (b.modification_time || "") ? 1 : -1)
        )
      })
    }
    const page = fixtureCursorPage(projects, { cursor, limit })
    return includeTotal === false ? { ...page, total: null } : page
  }

  const client = createCrucibleClient(configuration, { privilegeMode })
  const memberRefs = memberRef
    ? Array.isArray(memberRef)
      ? [...memberRef]
      : [memberRef]
    : undefined
  const memberRoles = memberRole
    ? Array.isArray(memberRole)
      ? [...memberRole]
      : [memberRole]
    : undefined
  const projectsResult = await client.GET("/projects", {
    params: {
      query: {
        active_since: activeSinceTimestamp,
        affiliation: affiliation ? [affiliation] : undefined,
        cursor,
        direction: sort ? direction : undefined,
        include_total: includeTotal ?? true,
        limit,
        member_ref: memberRefs,
        member_role: memberRoles,
        sort: sort ?? undefined,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!projectsResult.data) {
    throw new CrucibleResponseError(projectsResult.response)
  }

  return {
    items: projectsResult.data.items.map(toWorkspaceProject),
    limit: projectsResult.data.limit,
    nextCursor: projectsResult.data.next_cursor ?? null,
    total: projectsResult.data.total ?? null,
  }
}

export async function readWorkspaceUserProjects(
  {
    cursor,
    direction,
    includeTotal,
    limit,
    privilegeMode,
    scenario,
    sort,
    userRef,
  }: {
    cursor?: string
    direction?: WorkspaceSortDirection
    includeTotal?: boolean
    limit: number
    privilegeMode?: WorkspacePrivilegeMode
    scenario?: FixtureScenario
    sort?: WorkspaceProjectSort
    userRef: string
  },
  requestSignal?: AbortSignal
): Promise<WorkspaceProjectPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return readWorkspaceProjects(
      {
        cursor,
        direction,
        includeTotal,
        limit,
        memberRef: userRef,
        privilegeMode,
        scenario,
        sort,
      },
      requestSignal
    )
  }

  const result = await createCrucibleClient(configuration, {
    privilegeMode,
  }).GET("/users/{user_ref}/projects", {
    params: {
      path: { user_ref: userRef },
      query: {
        cursor,
        direction: sort ? direction : undefined,
        include_total: includeTotal ?? true,
        limit,
        sort: sort ?? undefined,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response)

  return {
    items: result.data.items.map(toWorkspaceProject),
    limit: result.data.limit,
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? null,
  }
}

export async function readWorkspaceProject(
  projectMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal,
  projection: "overview" | "summary" = "overview",
  privilegeMode?: WorkspacePrivilegeMode
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

  const client = createCrucibleClient(configuration, { privilegeMode })
  const result = await client.GET("/projects/{project_ref}", {
    params: {
      path: { project_ref: projectMfid },
      query: {
        include_members: projection === "overview",
        include_metadata: projection === "overview",
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) {
    throw new CrucibleResponseError(result.response)
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
    if (
      changes.project_id &&
      source.workspace.projects.some(
        (candidate) =>
          candidate.unique_id !== projectMfid &&
          candidate.project_id.toLowerCase() ===
            changes.project_id?.toLowerCase()
      )
    ) {
      throw new CrucibleResponseError(409)
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
    throw new CrucibleResponseError(result.response)
  }
  return toWorkspaceProject(result.data)
}

export async function checkWorkspaceProjectIdExactMatch(
  projectId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<boolean> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return source.workspace.projects.some(
      (project) => project.project_id.toLowerCase() === projectId.toLowerCase()
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/projects", {
    params: { query: { limit: 1, project_id: projectId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response)
  return result.data.items.length > 0
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
  const result = await client.POST("/projects/{project_ref}/users/{user_ref}", {
    params: {
      path: { project_ref: projectMfid, user_ref: userId },
      query: { role },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response)
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
  const result = await client.PATCH(
    "/projects/{project_ref}/users/{user_ref}",
    {
      params: {
        path: { project_ref: projectMfid, user_ref: userId },
        query: { role },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response)
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
  const result = await client.DELETE(
    "/projects/{project_ref}/users/{user_ref}",
    {
      params: { path: { project_ref: projectMfid, user_ref: userId } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response)
  }
  return result.data
}
