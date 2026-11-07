import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { useStore } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  CollectionTablePending,
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import {
  EditableCardActions,
  EditableCardTrigger,
} from "@/components/crucible/editable-card-actions"
import { MfidValue } from "@/components/crucible/mfid-value"
import { notifySuccess } from "@/components/crucible/notifications"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import { PlatformRoleDialog } from "@/components/crucible/platform-role-dialog"
import type { PlatformRole } from "@/components/crucible/platform-role-dialog"
import { ProjectRoleBadge } from "@/components/crucible/project-members"
import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceDirectoryNameCell } from "@/components/crucible/resource-directory-name-cell"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { ActivityTime } from "@/components/crucible/activity-time"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SortDirection } from "@/data/crucible/collection-query"
import { applyPersonProfileUpdate } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  hubConflictFields,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import { emailSchema, usernameSchema } from "@/data/crucible/slugs"
import {
  updateWorkspaceUser,
  updateWorkspaceUserPlatformRoleFn,
} from "@/data/crucible/users.functions"
import { userProjectsQueryOptions } from "@/data/crucible/projects.queries"
import type {
  WorkspaceAdminUser,
  WorkspaceUserPlatformRole,
  WorkspaceUserUpdate,
} from "@/data/crucible/workspace-source"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import { EmailField, UsernameField } from "@/features/forms/identifier-fields"
import { useSlugConflict } from "@/features/forms/slug-availability"
import { resourceDisplayName } from "@/lib/resource-name"
import { formatUsername } from "@/lib/username"
import { PendingUserActions } from "@/features/admin/pending-users-card"
import { PersonSecurityCard } from "@/features/account-profile/security-card"
import { useAppForm } from "@/features/forms/app-form"

const platformRoleDescriptions = {
  admin: "Full platform administration.",
  contributor: "Platform-wide read and create access.",
  none: "No platform-wide role. Resource-specific access remains unchanged.",
} satisfies Record<WorkspaceUserPlatformRole, string>

function mergeAdminUserDetail(
  updated: WorkspaceAdminUser,
  current: WorkspaceAdminUser | undefined
): WorkspaceAdminUser {
  return {
    ...updated,
    api_key_status: updated.api_key_status ?? current?.api_key_status ?? null,
    user_capabilities:
      updated.user_capabilities ?? current?.user_capabilities ?? null,
  }
}

const editUserSchema = z.object({
  email: emailSchema.or(z.literal("")),
  first_name: z.string().trim().min(1, "Enter a first name.").max(255),
  last_name: z.string().trim().min(1, "Enter a last name.").max(255),
  username: usernameSchema,
})

type EditUserFormValues = z.infer<typeof editUserSchema>

function userFormValues(user: WorkspaceAdminUser): EditUserFormValues {
  return {
    email: user.email ?? "",
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username ?? "",
  }
}

function userHasChanges(
  user: WorkspaceAdminUser,
  values: EditUserFormValues
): boolean {
  return (
    values.first_name.trim() !== user.first_name.trim() ||
    values.last_name.trim() !== user.last_name.trim() ||
    values.email.trim() !== (user.email ?? "").trim() ||
    values.username.trim() !== (user.username ?? "").trim()
  )
}

function userChanges(
  user: WorkspaceAdminUser,
  values: EditUserFormValues
): WorkspaceUserUpdate {
  const changes: WorkspaceUserUpdate = {}
  if (values.first_name.trim() !== user.first_name.trim()) {
    changes.first_name = values.first_name.trim()
  }
  if (values.last_name.trim() !== user.last_name.trim()) {
    changes.last_name = values.last_name.trim()
  }
  const emailNorm = values.email.trim() || null
  if (emailNorm !== (user.email ?? null)) {
    changes.email = emailNorm
  }
  const userNorm = values.username.trim()
  if (userNorm !== (user.username ?? "")) {
    changes.username = userNorm
  }
  return changes
}

export function UserDetailView({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const canManageApiKeys = user.user_capabilities?.can_manage_api_key !== false

  return (
    <div className="flex flex-col gap-6">
      {user.pending_at ? (
        <PendingApprovalBanner scope={scope} user={user} />
      ) : null}
      <div className="grid gap-4 @split/content:grid-cols-2 @split/content:items-start">
        <UserProfileCard scope={scope} user={user} />
        <PersonSecurityCard
          canManageApiKeys={canManageApiKeys}
          personName={personDisplayName(user)}
          scope={scope}
          userId={user.unique_id}
        />
      </div>
      <UserProjectsSection scope={scope} user={user} />
    </div>
  )
}

function PendingApprovalBanner({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const navigate = useNavigate()
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-label">
            <Badge variant="warning">Waiting for approval</Badge>
          </span>
          <span className="text-supporting text-muted-foreground">
            Requested <ActivityTime fallback="" value={user.pending_at} />. This
            person can sign in once approved.
          </span>
        </div>
        <PendingUserActions
          onRejected={() => void navigate({ to: "/admin/users" })}
          scope={scope}
          user={user}
        />
      </CardContent>
    </Card>
  )
}

function UserProfileCard({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const usernameConflict = useSlugConflict()
  const emailConflict = useSlugConflict()
  const resetUsernameConflict = usernameConflict.reset
  const resetEmailConflict = emailConflict.reset
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleUpdated, setRoleUpdated] = useState(false)

  const roleMutation = useMutation({
    mutationFn: async (platformRole: WorkspaceUserPlatformRole) =>
      unwrapHubResult(
        await updateWorkspaceUserPlatformRoleFn({
          data: {
            platformRole,
            scenario: fixtureScenarioFromScope(scope),
            userId: user.unique_id,
          },
        })
      ),
  })

  const mutation = useMutation({
    mutationFn: async (changes: WorkspaceUserUpdate) =>
      unwrapHubResult(
        await updateWorkspaceUser({
          data: {
            changes,
            scenario: fixtureScenarioFromScope(scope),
            userId: user.unique_id,
          },
        })
      ),
  })

  const form = useAppForm({
    defaultValues: userFormValues(user),
    validators: {
      onChange: editUserSchema,
      onSubmit: editUserSchema,
    },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      const changes = userChanges(user, value)
      if (Object.keys(changes).length === 0) {
        setEditing(false)
        return
      }
      try {
        const updated = await mutation.mutateAsync(changes)
        queryClient.setQueryData(
          crucibleKeys.userAdminDetail(scope, user.unique_id),
          (current: WorkspaceAdminUser | undefined) =>
            mergeAdminUserDetail(updated, current)
        )
        void Promise.all([
          applyPersonProfileUpdate(queryClient, scope, {
            ...updated,
            is_service_account: Boolean(updated.is_service_account),
          }),
          queryClient.invalidateQueries({
            queryKey: crucibleKeys.userAdminLists(scope),
          }),
        ])
        form.reset(userFormValues(updated))
        notifySuccess("User profile saved")
        setEditing(false)
      } catch (cause) {
        const conflicts = hubConflictFields(cause, ["username", "email"])
        if (conflicts.includes("username"))
          usernameConflict.reject(changes.username)
        if (conflicts.includes("email")) emailConflict.reject(changes.email)
        setSaveError(
          hubErrorMessage(
            cause,
            "User details could not be updated. Your changes are still here."
          )
        )
      }
    },
  })

  const hasChanges = useStore(form.store, (state) =>
    userHasChanges(user, state.values)
  )
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const discard = useDiscardProtection(hasChanges, () => {
    form.reset(userFormValues(user))
    setSaveError(undefined)
    usernameConflict.reset()
    emailConflict.reset()
    setEditing(false)
  })

  const userRef = useRef(user.unique_id)
  useEffect(() => {
    if (userRef.current !== user.unique_id) {
      userRef.current = user.unique_id
      form.reset(userFormValues(user))
      setEditing(false)
      setSaveError(undefined)
      resetUsernameConflict()
      resetEmailConflict()
      setRoleDialogOpen(false)
      setRoleUpdated(false)
    } else if (!editing) {
      form.reset(userFormValues(user))
    }
  }, [editing, form, resetEmailConflict, resetUsernameConflict, user])

  const formId = `user-profile-${user.unique_id}`

  function openRoleDialog() {
    setRoleUpdated(false)
    setRoleDialogOpen(true)
  }

  async function changePlatformRole(role: PlatformRole) {
    const updated = await roleMutation.mutateAsync(role)
    queryClient.setQueryData(
      crucibleKeys.userAdminDetail(scope, user.unique_id),
      (current: WorkspaceAdminUser | undefined) =>
        mergeAdminUserDetail(updated, current)
    )
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.userAdminLists(scope),
    })
  }

  if (!editing) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardAction>
              <div className="flex flex-wrap justify-end gap-2">
                {user.user_capabilities?.can_change_platform_role === true ? (
                  <Button
                    onClick={openRoleDialog}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Change role
                  </Button>
                ) : null}
                {user.user_capabilities?.can_edit_profile !== false ? (
                  <EditableCardTrigger
                    label="Edit profile"
                    onClick={() => setEditing(true)}
                  />
                ) : null}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {roleUpdated ? (
              <p aria-live="polite" className="text-body text-success">
                Platform role updated. Access changes may take about a minute to
                propagate.
              </p>
            ) : null}
            <PersonIdentity person={user} presentation="avatar" size="lg" />
            <dl className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">Username</dt>
                <dd className="mt-1 font-mono text-body break-words">
                  {formatUsername(user.username, "raw")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">
                  Platform role
                </dt>
                <dd className="mt-1">
                  {user.platform_role ? (
                    <PlatformRoleBadge role={user.platform_role} />
                  ) : (
                    <span className="text-body text-muted-foreground">
                      None
                    </span>
                  )}
                </dd>
              </div>
              <div className="col-span-2 min-w-0 @fields:col-span-1">
                <dt className="text-label text-muted-foreground">Email</dt>
                <dd className="mt-1 text-body break-words">
                  {user.email || (
                    <span className="text-muted-foreground">None</span>
                  )}
                </dd>
              </div>
              <div className="col-span-2 min-w-0 @fields:col-span-1">
                <dt className="text-label text-muted-foreground">
                  Last active
                </dt>
                <dd className="mt-1 text-body">
                  <ActivityTime fallback="Never" value={user.last_active_at} />
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-label text-muted-foreground">
                  Crucible ID
                </dt>
                <dd className="mt-1">
                  <MfidValue value={user.unique_id} />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <PlatformRoleDialog
          currentRole={user.platform_role}
          id="user-platform-role"
          onChanged={() => setRoleUpdated(true)}
          onChange={changePlatformRole}
          onOpenChange={setRoleDialogOpen}
          open={roleDialogOpen}
          roleDescriptions={platformRoleDescriptions}
        />
      </>
    )
  }

  return (
    <>
      <Card aria-busy={isSubmitting}>
        <CardHeader>
          <CardTitle>Edit identity</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <fieldset disabled={isSubmitting}>
              <FieldGroup>
                <form.Field name="username">
                  {(field) => (
                    <UsernameField
                      {...usernameConflict.fieldProps}
                      currentValue={user.username}
                      field={field}
                      required
                      scenario={fixtureScenarioFromScope(scope)}
                    />
                  )}
                </form.Field>
                <div className="grid grid-cols-2 gap-4">
                  <form.AppField name="first_name">
                    {(field) => (
                      <field.TextField
                        label="First name"
                        maxLength={255}
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="last_name">
                    {(field) => (
                      <field.TextField
                        label="Last name"
                        maxLength={255}
                        required
                      />
                    )}
                  </form.AppField>
                </div>
                <form.Field name="email">
                  {(field) => (
                    <EmailField
                      {...emailConflict.fieldProps}
                      currentValue={user.email}
                      field={field}
                      scenario={fixtureScenarioFromScope(scope)}
                    />
                  )}
                </form.Field>
              </FieldGroup>
            </fieldset>
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">
                  Platform role
                </dt>
                <dd className="mt-1">
                  {user.platform_role ? (
                    <PlatformRoleBadge role={user.platform_role} />
                  ) : (
                    <span className="text-body text-muted-foreground">
                      None
                    </span>
                  )}
                </dd>
              </div>
              <div className="col-span-2 min-w-0 @fields:col-span-1">
                <dt className="text-label text-muted-foreground">
                  Crucible ID
                </dt>
                <dd className="mt-1">
                  <MfidValue value={user.unique_id} />
                </dd>
              </div>
            </dl>
            {saveError ? (
              <p className="mt-4 text-body text-destructive" role="alert">
                {saveError}
              </p>
            ) : null}
          </form>
        </CardContent>
        <form.Subscribe
          selector={(state) => [
            state.canSubmit &&
              !usernameConflict.isTaken(state.values.username) &&
              !emailConflict.isTaken(state.values.email),
            hasChanges,
            state.isSubmitting,
          ]}
        >
          {([canSubmit, dirty, submitting]) => (
            <EditableCardActions
              canSubmit={canSubmit}
              dirty={dirty}
              formId={formId}
              onCancel={discard.requestCancel}
              pending={submitting}
            />
          )}
        </form.Subscribe>
      </Card>
      <DiscardChangesDialog {...discard.dialog} />
    </>
  )
}

type ProjectSortColumn = "name" | "created" | "updated"

function UserProjectsSection({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const [sortColumn, setSortColumn] = useState<ProjectSortColumn>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  useEffect(() => {
    setSortColumn("name")
    setSortDirection("asc")
  }, [user.unique_id])

  const apiSort = sortColumn === "name" ? "title" : sortColumn

  const projectsQuery = useQuery(
    userProjectsQueryOptions(scope, user.unique_id, {
      direction: sortDirection,
      limit: 100,
      sort: apiSort,
    })
  )
  const projects = projectsQuery.data?.items ?? []

  function handleSortChange(
    column: ProjectSortColumn,
    direction: SortDirection
  ) {
    setSortColumn(column)
    setSortDirection(direction)
  }

  return (
    <Card aria-busy={projectsQuery.isFetching}>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        {projectsQuery.data !== undefined ? (
          <CardAction>
            <Badge variant="outline">{projects.length}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {projectsQuery.isPending ? (
          <CollectionTablePending
            framed={false}
            label="user projects"
            presentation="user-projects"
          />
        ) : projectsQuery.isError && projects.length === 0 ? (
          <div className="px-6 py-4">
            <PanelState
              retry={() => void projectsQuery.refetch()}
              role="alert"
              title="Projects could not be loaded"
            />
          </div>
        ) : projects.length > 0 ? (
          <>
            {projectsQuery.isError ? (
              <div className="border-b px-6 py-4">
                <PanelUpdateError
                  description="Projects could not be refreshed."
                  retry={() => void projectsQuery.refetch()}
                />
              </div>
            ) : null}
            <Table
              aria-label="User projects"
              className="resource-directory-table resource-directory-project-table table-fixed"
            >
              <colgroup>
                <col className="resource-directory-name-column" />
                <col className="resource-directory-person-column" />
                <col className="resource-directory-role-column" />
                <col className="resource-directory-date-column resource-directory-created-column" />
                <col className="resource-directory-date-column" />
                <col className="resource-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={sortColumn === "name"}
                    direction={sortDirection}
                    field="name"
                    label="Project"
                    onChange={handleSortChange}
                    preferredDirection="asc"
                  />
                  <TableHead className="resource-directory-person">
                    Lead
                  </TableHead>
                  <TableHead className="resource-directory-role">
                    Role
                  </TableHead>
                  <SortableTableHead
                    active={sortColumn === "created"}
                    className="resource-directory-created"
                    direction={sortDirection}
                    field="created"
                    kind="date"
                    label="Created"
                    onChange={handleSortChange}
                    preferredDirection="desc"
                  />
                  <SortableTableHead
                    active={sortColumn === "updated"}
                    direction={sortDirection}
                    field="updated"
                    kind="date"
                    label="Updated"
                    onChange={handleSortChange}
                    preferredDirection="desc"
                  />
                  <TableHead kind="action">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const complete = "status" in project
                  const title = project.title?.trim()
                  const name = resourceDisplayName("project", project.title, {
                    identifier: project.project_id,
                    mfid: project.unique_id,
                  })
                  const effectiveRole =
                    project.role ??
                    (project.lead?.unique_id === user.unique_id ||
                    project.project_lead_orcid === user.unique_id
                      ? "owner"
                      : null)
                  return (
                    <TableRow key={project.unique_id}>
                      <ResourceDirectoryNameCell
                        identifier={title ? project.project_id : null}
                        kind="project"
                        mfid={project.unique_id}
                        name={name}
                      />
                      <TableCell
                        className="resource-directory-person"
                        data-label="Lead"
                      >
                        {complete && "lead" in project && project.lead ? (
                          <PersonLink
                            nameStyle="abbreviated"
                            person={project.lead}
                            presentation="collection"
                          />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="resource-directory-role"
                        data-label="Role"
                      >
                        {effectiveRole ? (
                          <ProjectRoleBadge role={effectiveRole} />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <ResourceCreatedCell
                        className="resource-directory-created"
                        value={
                          complete && "creation_time" in project
                            ? project.creation_time
                            : undefined
                        }
                      />
                      <ResourceUpdatedCell
                        value={
                          complete && "modification_time" in project
                            ? project.modification_time
                            : undefined
                        }
                      />
                      <ResourceOpenCell
                        kind="project"
                        mfid={project.unique_id}
                        name={name}
                      />
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="px-6 py-4">
            <p className="text-body text-muted-foreground">
              This user has no associated projects.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
