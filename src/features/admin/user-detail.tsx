import { useMemo, useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { ApiCredentialCard } from "@/components/crucible/api-credential-card"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import {
  AddMemberIcon,
  EditResourceIcon,
  PersonIcon,
  ProjectIcon,
  RemoveMemberIcon,
  RotateCredentialIcon,
  SavingChangesIcon,
  UserGroupIcon,
} from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { notifySuccess } from "@/components/crucible/notifications"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceDirectoryNameCell } from "@/components/crucible/resource-directory-name-cell"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { checkWorkspaceUsername } from "@/data/crucible/account.functions"
import type { SortDirection } from "@/data/crucible/collection-query"
import { applyPersonProfileUpdate } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import { USERNAME_MAX_LENGTH, usernameSchema } from "@/data/crucible/slugs"
import {
  addUserToAccessGroupFn,
  checkWorkspaceEmail,
  provisionWorkspaceUserApiKeyFn,
  removeUserFromAccessGroupFn,
  updateWorkspaceUser,
} from "@/data/crucible/users.functions"
import {
  userAccessGroupsQueryOptions,
  userApiKeyStatusQueryOptions,
  userProjectsQueryOptions,
} from "@/data/crucible/users.queries"
import type {
  WorkspaceAdminUser,
  WorkspaceMode,
  WorkspaceUserUpdate,
} from "@/data/crucible/workspace-source"
import {
  DiscardChangesDialog,
  useDiscardProtection,
} from "@/features/forms/discard-changes"
import {
  isSlugTakenOrRejected,
  SlugAvailabilityField,
} from "@/features/forms/slug-availability"
import { OneTimeCredentialDialog } from "@/features/service-accounts/one-time-credential-dialog"
import { resourceDisplayName } from "@/lib/resource-name"
import { formatUsername } from "@/lib/username"

const userEmailSchema = z
  .string()
  .trim()
  .max(320, "Use 320 characters or fewer for email.")
  .email("Enter a valid email address.")

const editUserSchema = z.object({
  email: userEmailSchema.or(z.literal("")),
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
  mode?: WorkspaceMode
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const [credential, setCredential] = useState<{
    api_key: string
    unique_id: string
    username: string | null
  }>()

  return (
    <div className="flex flex-col gap-6">
      <UserProfileCard scope={scope} user={user} />
      <UserApiCredentialSection
        onCredentialMinted={setCredential}
        scope={scope}
        user={user}
      />
      <UserAccessGroupsSection scope={scope} user={user} />
      <UserProjectsSection scope={scope} user={user} />
      <OneTimeCredentialDialog
        credential={credential}
        onClose={() => setCredential(undefined)}
        title="User API key provisioned"
      />
    </div>
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
  const [liveTakenUsername, setLiveTakenUsername] = useState<string>()
  const [rejectedUsername, setRejectedUsername] = useState<string>()
  const [liveTakenEmail, setLiveTakenEmail] = useState<string>()
  const [rejectedEmail, setRejectedEmail] = useState<string>()

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

  const form = useForm({
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
          updated
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
        if (
          cause instanceof HubApiClientError &&
          cause.details.kind === "conflict"
        ) {
          if (changes.username) {
            setRejectedUsername(changes.username)
          }
          if (changes.email) {
            setRejectedEmail(changes.email)
          }
        }
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
    setLiveTakenUsername(undefined)
    setRejectedUsername(undefined)
    setLiveTakenEmail(undefined)
    setRejectedEmail(undefined)
    setEditing(false)
  })

  const formId = `user-profile-${user.unique_id}`

  if (!editing) {
    return (
      <Card>
        <CardHeader actionLayout="inline">
          <CardTitle className="flex items-center gap-2">
            <PersonIcon aria-hidden="true" />
            Profile
          </CardTitle>
          <CardAction>
            <Button
              onClick={() => setEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <EditResourceIcon data-icon="inline-start" />
              Edit profile
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-label text-muted-foreground">User</dt>
              <dd className="mt-1">
                <PersonIdentity person={user} presentation="avatar" size="sm" />
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Username</dt>
              <dd className="mt-1 font-mono text-body">
                {formatUsername(user.username, "raw")}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">
                Platform role
              </dt>
              <dd className="mt-1">
                {user.platform_role ? (
                  <PlatformRoleBadge role={user.platform_role} />
                ) : (
                  <span className="text-body text-muted-foreground">None</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Email</dt>
              <dd className="mt-1 text-body">
                {user.email || (
                  <span className="text-muted-foreground">None</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">
                Crucible ID / ORCID
              </dt>
              <dd className="mt-1">
                <MfidText value={user.unique_id} />
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Account type</dt>
              <dd className="mt-1">
                <Badge
                  variant={user.is_service_account ? "secondary" : "default"}
                >
                  {user.is_service_account ? "Service account" : "Regular user"}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card aria-busy={isSubmitting}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PersonIcon aria-hidden="true" />
            Edit profile
          </CardTitle>
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
                    <SlugAvailabilityField
                      autoComplete="nickname"
                      checkAvailability={async (candidate, signal) => {
                        const result = await checkWorkspaceUsername({
                          data: {
                            scenario: fixtureScenarioFromScope(scope),
                            username: candidate,
                          },
                          signal,
                        })
                        return unwrapHubResult(result)
                      }}
                      currentValue={user.username}
                      entityLabel="Username"
                      field={field}
                      label="Username"
                      maxLength={USERNAME_MAX_LENGTH}
                      onLiveTakenChange={setLiveTakenUsername}
                      rejectedValue={rejectedUsername}
                      required
                      schema={usernameSchema}
                    />
                  )}
                </form.Field>
                <div className="grid grid-cols-2 gap-4">
                  <form.Field name="first_name">
                    {(field) => (
                      <Field data-invalid={!field.state.meta.isValid}>
                        <FieldLabel htmlFor={field.name}>First name</FieldLabel>
                        <Input
                          aria-invalid={!field.state.meta.isValid || undefined}
                          id={field.name}
                          maxLength={255}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="last_name">
                    {(field) => (
                      <Field data-invalid={!field.state.meta.isValid}>
                        <FieldLabel htmlFor={field.name}>Last name</FieldLabel>
                        <Input
                          aria-invalid={!field.state.meta.isValid || undefined}
                          id={field.name}
                          maxLength={255}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                </div>
                <form.Field name="email">
                  {(field) => (
                    <SlugAvailabilityField
                      autoComplete="email"
                      checkAvailability={async (candidate, signal) => {
                        const result = await checkWorkspaceEmail({
                          data: {
                            email: candidate,
                            scenario: fixtureScenarioFromScope(scope),
                          },
                          signal,
                        })
                        return unwrapHubResult(result)
                      }}
                      currentValue={user.email}
                      entityLabel="Email"
                      field={field}
                      label="Email address"
                      maxLength={320}
                      onLiveTakenChange={setLiveTakenEmail}
                      rejectedValue={rejectedEmail}
                      schema={userEmailSchema}
                      type="email"
                    />
                  )}
                </form.Field>
              </FieldGroup>
            </fieldset>
            <dl className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
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
              <div>
                <dt className="text-label text-muted-foreground">
                  Crucible ID / ORCID
                </dt>
                <dd className="mt-1">
                  <MfidText value={user.unique_id} />
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">
                  Account type
                </dt>
                <dd className="mt-1">
                  <Badge
                    variant={user.is_service_account ? "secondary" : "default"}
                  >
                    {user.is_service_account
                      ? "Service account"
                      : "Regular user"}
                  </Badge>
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
              !isSlugTakenOrRejected(
                state.values.username,
                liveTakenUsername,
                rejectedUsername
              ) &&
              !isSlugTakenOrRejected(
                state.values.email,
                liveTakenEmail,
                rejectedEmail
              ),
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

function UserApiCredentialSection({
  onCredentialMinted,
  scope,
  user,
}: {
  onCredentialMinted: (cred: {
    api_key: string
    unique_id: string
    username: string | null
  }) => void
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState<string>()
  const statusQuery = useQuery(
    userApiKeyStatusQueryOptions(scope, user.unique_id)
  )

  const mutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await provisionWorkspaceUserApiKeyFn({
          data: {
            scenario: fixtureScenarioFromScope(scope),
            userId: user.unique_id,
          },
        })
      ),
    onSuccess: (result) => {
      onCredentialMinted({
        api_key: result.api_key,
        unique_id: user.unique_id,
        username: user.username ?? null,
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.userAdminApiKeyStatus(scope, user.unique_id),
      })
    },
    onError: (err) => {
      setActionError(hubErrorMessage(err, "Failed to provision API key."))
    },
  })

  return (
    <>
      <ApiCredentialCard
        action={
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              setActionError(undefined)
              setConfirmOpen(true)
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {mutation.isPending ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <RotateCredentialIcon data-icon="inline-start" />
            )}
            {statusQuery.data?.valid ? "Rotate API key" : "Provision API key"}
          </Button>
        }
        error={
          actionError ||
          (statusQuery.isError
            ? "Could not read API credential status."
            : undefined)
        }
        loading={statusQuery.isPending}
        onRetry={() => void statusQuery.refetch()}
        status={statusQuery.data}
      />
      <ConfirmationAlertDialog
        confirmLabel={statusQuery.data?.valid ? "Rotate key" : "Provision key"}
        description={
          statusQuery.data?.valid
            ? "Rotating will immediately invalidate the existing API key for this user. Any scripts using it will stop working until updated."
            : "This will generate a new active API credential for this user."
        }
        onConfirm={() => void mutation.mutateAsync()}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={
          statusQuery.data?.valid
            ? "Rotate user API key"
            : "Provision user API key"
        }
      />
    </>
  )
}

function UserAccessGroupsSection({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const queryClient = useQueryClient()
  const groupsQuery = useQuery(
    userAccessGroupsQueryOptions(scope, user.unique_id)
  )
  const [newGroupInput, setNewGroupInput] = useState("")
  const [actionError, setActionError] = useState<string>()

  const addMutation = useMutation({
    mutationFn: async (groupName: string) =>
      unwrapHubResult(
        await addUserToAccessGroupFn({
          data: {
            groupName,
            scenario: fixtureScenarioFromScope(scope),
            userId: user.unique_id,
          },
        })
      ),
    onSuccess: () => {
      setNewGroupInput("")
      setActionError(undefined)
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.userAdminAccessGroups(scope, user.unique_id),
      })
    },
    onError: (err) => {
      setActionError(
        hubErrorMessage(err, "Could not add user to access group.")
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (groupName: string) =>
      unwrapHubResult(
        await removeUserFromAccessGroupFn({
          data: {
            groupName,
            scenario: fixtureScenarioFromScope(scope),
            userId: user.unique_id,
          },
        })
      ),
    onSuccess: () => {
      setActionError(undefined)
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.userAdminAccessGroups(scope, user.unique_id),
      })
    },
    onError: (err) => {
      setActionError(
        hubErrorMessage(err, "Could not remove user from access group.")
      )
    },
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newGroupInput.trim()
    if (!trimmed) return
    addMutation.mutate(trimmed)
  }

  const groups = groupsQuery.data ?? []

  return (
    <Card aria-busy={groupsQuery.isPending}>
      <CardHeader actionLayout="inline">
        <CardTitle className="flex items-center gap-2">
          <UserGroupIcon aria-hidden="true" />
          Access groups
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex max-w-sm gap-2" onSubmit={handleAdd}>
          <Input
            aria-label="New group name"
            disabled={addMutation.isPending}
            onChange={(e) => setNewGroupInput(e.target.value)}
            placeholder="e.g. spectroscopy-core"
            value={newGroupInput}
          />
          <Button
            disabled={!newGroupInput.trim() || addMutation.isPending}
            size="sm"
            type="submit"
            variant="outline"
          >
            {addMutation.isPending ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <AddMemberIcon data-icon="inline-start" />
            )}
            Add
          </Button>
        </form>
        {actionError ? (
          <p className="text-body text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}
        {groups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {groups.map((groupName) => (
              <Badge
                className="flex items-center gap-1.5 py-1 text-body"
                key={groupName}
                variant="outline"
              >
                <span>{groupName}</span>
                <Button
                  aria-label={`Remove from ${groupName}`}
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(groupName)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <RemoveMemberIcon aria-hidden="true" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-body text-muted-foreground">
            This user does not belong to any access groups.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

type ProjectSortColumn = "name" | "lead" | "created" | "updated"

function UserProjectsSection({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const [sortColumn, setSortColumn] = useState<ProjectSortColumn>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const projectsQuery = useQuery(
    userProjectsQueryOptions(scope, user.unique_id)
  )
  const projects = projectsQuery.data ?? []

  function handleSortChange(
    column: ProjectSortColumn,
    direction: SortDirection
  ) {
    setSortColumn(column)
    setSortDirection(direction)
  }

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      let aVal = ""
      let bVal = ""
      switch (sortColumn) {
        case "name":
          aVal = a.title?.trim() || a.project_id
          bVal = b.title?.trim() || b.project_id
          break
        case "lead":
          aVal =
            "lead" in a && a.lead
              ? personDisplayName(a.lead, "abbreviated")
              : ""
          bVal =
            "lead" in b && b.lead
              ? personDisplayName(b.lead, "abbreviated")
              : ""
          break
        case "created":
          aVal =
            "creation_time" in a && typeof a.creation_time === "string"
              ? a.creation_time
              : ""
          bVal =
            "creation_time" in b && typeof b.creation_time === "string"
              ? b.creation_time
              : ""
          break
        case "updated":
          aVal =
            "modification_time" in a && typeof a.modification_time === "string"
              ? a.modification_time
              : ""
          bVal =
            "modification_time" in b && typeof b.modification_time === "string"
              ? b.modification_time
              : ""
          break
      }
      const cmp = aVal.localeCompare(bVal, undefined, {
        sensitivity: "base",
      })
      return sortDirection === "asc" ? cmp : -cmp
    })
  }, [projects, sortColumn, sortDirection])

  return (
    <Card aria-busy={projectsQuery.isPending}>
      <CardHeader actionLayout="inline">
        <CardTitle className="flex items-center gap-2">
          <ProjectIcon aria-hidden="true" />
          Projects
        </CardTitle>
        <CardAction>
          <Badge variant="outline">{projects.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {sortedProjects.length > 0 ? (
          <Table
            aria-label="User projects"
            className="resource-directory-table resource-directory-project-table table-fixed"
          >
            <colgroup>
              <col className="resource-directory-name-column" />
              <col className="resource-directory-person-column" />
              <col className="resource-directory-date-column hidden xl:table-column" />
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
                <SortableTableHead
                  active={sortColumn === "lead"}
                  direction={sortDirection}
                  field="lead"
                  label="Lead"
                  onChange={handleSortChange}
                  preferredDirection="asc"
                />
                <SortableTableHead
                  active={sortColumn === "created"}
                  className="hidden xl:table-cell"
                  direction={sortDirection}
                  field="created"
                  label="Created"
                  onChange={handleSortChange}
                  preferredDirection="desc"
                />
                <SortableTableHead
                  active={sortColumn === "updated"}
                  direction={sortDirection}
                  field="updated"
                  label="Updated"
                  onChange={handleSortChange}
                  preferredDirection="desc"
                />
                <TableHead className="text-center">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map((project) => {
                const complete = "status" in project
                const title = project.title?.trim()
                const name = resourceDisplayName("project", project.title, {
                  identifier: project.project_id,
                  mfid: project.unique_id,
                })
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
                    <ResourceCreatedCell
                      className="hidden xl:table-cell"
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
