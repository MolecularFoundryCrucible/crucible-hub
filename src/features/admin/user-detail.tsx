import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { ApiCredentialCard } from "@/components/crucible/api-credential-card"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import {
  AddMemberIcon,
  EditResourceIcon,
  OpenFullPageIcon,
  PersonIcon,
  ProjectIcon,
  RemoveMemberIcon,
  RotateCredentialIcon,
  SavingChangesIcon,
  UserGroupIcon,
} from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import {
  addUserToAccessGroupFn,
  provisionWorkspaceUserApiKeyFn,
  removeUserFromAccessGroupFn,
} from "@/data/crucible/users.functions"
import {
  userAccessGroupsQueryOptions,
  userApiKeyStatusQueryOptions,
  userProjectsQueryOptions,
} from "@/data/crucible/users.queries"
import type {
  WorkspaceAdminUser,
  WorkspaceMode,
} from "@/data/crucible/workspace-source"
import { OneTimeCredentialDialog } from "@/features/service-accounts/one-time-credential-dialog"
import { formatUsername } from "@/lib/username"

import { UserEditDialog } from "./user-edit-dialog"

export function UserDetailView({
  scope,
  user: initialUser,
}: {
  mode?: WorkspaceMode
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const [user, setUser] = useState<WorkspaceAdminUser>(initialUser)
  const [editOpen, setEditOpen] = useState(false)
  const [credential, setCredential] = useState<{
    api_key: string
    unique_id: string
    username: string | null
  }>()

  return (
    <div className="flex flex-col gap-6">
      <UserProfileCard onEdit={() => setEditOpen(true)} user={user} />
      <UserApiCredentialSection
        onCredentialMinted={setCredential}
        scope={scope}
        user={user}
      />
      <UserAccessGroupsSection scope={scope} user={user} />
      <UserProjectsSection scope={scope} user={user} />
      <UserEditDialog
        onOpenChange={setEditOpen}
        onUpdated={setUser}
        open={editOpen}
        scope={scope}
        user={user}
      />
      <OneTimeCredentialDialog
        credential={credential}
        onClose={() => setCredential(undefined)}
        title="User API key provisioned"
      />
    </div>
  )
}

function UserProfileCard({
  onEdit,
  user,
}: {
  onEdit: () => void
  user: WorkspaceAdminUser
}) {
  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle className="flex items-center gap-2">
          <PersonIcon aria-hidden="true" />
          Profile
        </CardTitle>
        <CardAction>
          <Button onClick={onEdit} size="sm" type="button" variant="outline">
            <EditResourceIcon data-icon="inline-start" />
            Edit profile
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

function UserProjectsSection({
  scope,
  user,
}: {
  scope: IdentityScope
  user: WorkspaceAdminUser
}) {
  const projectsQuery = useQuery(
    userProjectsQueryOptions(scope, user.unique_id)
  )
  const projects = projectsQuery.data ?? []

  return (
    <Card aria-busy={projectsQuery.isPending}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ProjectIcon aria-hidden="true" />
          Projects
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {projects.length > 0 ? (
          <Table aria-label="User projects">
            <TableHeader>
              <TableRow>
                <TableHead>Project ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Crucible ID</TableHead>
                <TableHead className="text-center">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.unique_id}>
                  <TableCell>{project.project_id}</TableCell>
                  <TableCell>
                    {project.title || (
                      <span className="text-muted-foreground">Untitled</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <MfidText value={project.unique_id} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Link
                      aria-label={`Open project ${project.project_id}`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                      params={{ projectMfid: project.unique_id }}
                      to="/projects/$projectMfid"
                    >
                      <OpenFullPageIcon aria-hidden="true" className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
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
