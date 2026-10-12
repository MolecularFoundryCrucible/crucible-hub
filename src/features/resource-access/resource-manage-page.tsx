import { useState } from "react"
import { resourceDetailDisplayName } from "@/lib/resource-name"
import { Link } from "@tanstack/react-router"
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"

import {
  AccessRoleBadge,
  accessRoleLabel,
  isAccessGrantRole,
  permittedAccessGrantRoles,
  sortAccessGrants,
} from "@/components/crucible/access-role-badge"
import { AccessGrantRow } from "@/components/crucible/access-grant-row"
import { useAccessListManagement } from "@/components/crucible/access-list-management"
import { AccessManagementToggle } from "@/components/crucible/access-management-toggle"
import { AddMembersDialog } from "@/components/crucible/add-members-dialog"
import { ContentBoundary } from "@/components/crucible/content-layout"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  AddAccessGrantIcon,
  RemoveMemberIcon,
} from "@/components/crucible/icons"
import { RemoveMembersDialog } from "@/components/crucible/remove-members-dialog"
import type { RemovableMember } from "@/components/crucible/remove-members-dialog"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceName } from "@/components/crucible/resource-name"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { VisibilityBadge } from "@/components/crucible/visibility-badge"
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  publishWorkspaceResource,
  revokeWorkspaceResourceAccess,
  setWorkspaceResourceAccess,
  unpublishWorkspaceResource,
} from "@/data/crucible/access.functions"
import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  isPrimaryProjectAccessGrant,
  grantKey,
  grantName,
  principalKindFor,
} from "@/data/crucible/resource-access"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceResourceAccessGrant,
  WorkspaceResourceAccessPrincipalKind,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { DatasetInstrumentAssignmentCard } from "@/features/dataset-instrument/dataset-instrument-assignment-card"
import { OwnershipTransferCard } from "@/features/resource-ownership/ownership-transfer-card"
import { ProjectAssignmentCard } from "@/features/resource-project-assignment/project-assignment-card"
import { ResourceDeletionRequestCard } from "@/features/resource-deletion/resource-deletion-request"

type AccessResource = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" | "sample" }
>
type GrantRole = "viewer" | "contributor" | "editor" | "admin"
type PrincipalKind = WorkspaceResourceAccessPrincipalKind

export function ResourceManagePage({
  resourceKind,
  resourceMfid,
}: {
  resourceKind: "dataset" | "sample"
  resourceMfid: string
}) {
  const scope = useWorkspaceScope()
  const mode = useWorkspaceMode()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, resourceMfid)
  )

  if (!resource || resource.kind !== resourceKind) return null
  const canManageAccess = resource.capabilities?.can_manage_access === true
  const canTransfer = resource.capabilities?.can_transfer === true
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {canManageAccess ? (
        <ContentBoundary width="reading">
          <ManagedResourceAccess resource={resource} scope={scope} />
        </ContentBoundary>
      ) : (
        <ContentBoundary width="reading">
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Access management is unavailable</EmptyTitle>
              <EmptyDescription>
                You do not have permission to manage access to this resource.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </ContentBoundary>
      )}
      <ContentBoundary width="reading">
        <Card>
          <CardHeader>
            <CardTitle>Resource management</CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {canManageAccess ? (
              <ProjectAssignmentCard
                mode={mode}
                presentation="row"
                resource={resource}
                scope={scope}
              />
            ) : null}
            {canManageAccess && resource.kind === "dataset" ? (
              <DatasetInstrumentAssignmentCard
                mode={mode}
                presentation="row"
                resource={resource}
                scope={scope}
              />
            ) : null}
            {canTransfer ? (
              <OwnershipTransferCard
                mode={mode}
                presentation="row"
                resource={resource}
                scope={scope}
              />
            ) : null}
            <ResourceDeletionRequestCard
              mode={mode}
              presentation="row"
              resource={resource}
              scope={scope}
            />
          </CardContent>
        </Card>
      </ContentBoundary>
    </div>
  )
}

function ManagedResourceAccess({
  resource,
  scope,
}: {
  resource: AccessResource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const {
    data: grants,
    isError,
    isPending,
    refetch,
  } = useQuery(resourceAccessQueryOptions(scope, resource.unique_id))
  const [addOpen, setAddOpen] = useState(false)
  const [pendingPublic, setPendingPublic] = useState<boolean>()
  const [changingPublic, setChangingPublic] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [error, setError] = useState<{
    message: string
    surface: "direct" | "public"
  }>()
  const {
    managing,
    setManaging,
    savingAnything,
    selection: selectedForRevoke,
    isSaving,
    stageOne,
    startSaving,
    stopSaving,
    toggleSelection,
  } = useAccessListManagement()
  const roles = permittedAccessGrantRoles(resource.capabilities?.max_grant_role)
  const mutationPending = savingAnything || changingPublic
  const canGrant = roles.length > 0

  function applyGrants(nextGrants: readonly WorkspaceResourceAccessGrant[]) {
    queryClient.setQueryData(
      resourceAccessQueryOptions(scope, resource.unique_id).queryKey,
      nextGrants
    )
  }

  async function commitGrant(
    kind: PrincipalKind,
    principal: string,
    permission: GrantRole
  ) {
    applyGrants(
      unwrapHubResult(
        await setWorkspaceResourceAccess({
          data: {
            kind,
            permission,
            principal,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      )
    )
  }

  async function setGrant(
    grant: WorkspaceResourceAccessGrant,
    permission: GrantRole
  ) {
    const kind = principalKindFor(grant)
    if (!kind) return
    startSaving(grantKey(grant))
    setError(undefined)
    try {
      await commitGrant(kind, grant.principal_id, permission)
    } catch (mutationError) {
      setError({
        message: accessError(mutationError, "update this access grant"),
        surface: "direct",
      })
    } finally {
      stopSaving()
    }
  }

  async function commitRevoke(key: string) {
    const grant = directGrants.find((candidate) => grantKey(candidate) === key)
    if (!grant) {
      toggleSelection(key, false)
      return
    }
    const kind = principalKindFor(grant)
    if (!kind) return
    applyGrants(
      unwrapHubResult(
        await revokeWorkspaceResourceAccess({
          data: {
            kind,
            principal: grant.principal_id,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      )
    )
    toggleSelection(key, false)
  }

  async function changePublicAccess(publicAccess: boolean) {
    setChangingPublic(true)
    setError(undefined)
    try {
      const result = unwrapHubResult(
        await (publicAccess
          ? publishWorkspaceResource({
              data: {
                resourceMfid: resource.unique_id,
                scenario: fixtureScenarioFromScope(scope),
              },
            })
          : unpublishWorkspaceResource({
              data: {
                resourceMfid: resource.unique_id,
                scenario: fixtureScenarioFromScope(scope),
              },
            }))
      )
      applyGrants(result.grants)
      queryClient.setQueryData(
        resourceQueryOptions(scope, resource.unique_id).queryKey,
        result.resource
      )
      setPendingPublic(undefined)
    } catch (mutationError) {
      setError({
        message: accessError(
          mutationError,
          publicAccess ? "publish this resource" : "make this resource private"
        ),
        surface: "public",
      })
    } finally {
      setChangingPublic(false)
    }
  }

  if (isPending) {
    return (
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle>Access management</CardTitle>
        </CardHeader>
        <CardContent
          aria-label="Loading access management"
          className="grid gap-6"
          role="status"
        >
          <section className="grid gap-3">
            <h3 className="font-heading text-label">Direct access</h3>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
          </section>
          <section className="grid gap-3 border-t pt-4">
            <h3 className="font-heading text-label">Public access</h3>
            <Skeleton className="h-8 w-32" />
          </section>
        </CardContent>
      </Card>
    )
  }
  if (isError) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Access details could not be loaded</EmptyTitle>
          <EmptyDescription>
            <Button
              onClick={() => void refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const directGrants = sortAccessGrants(
    grants.filter((grant) => grant.principal_type !== "public")
  )
  const selectedGrants = directGrants.filter((grant) =>
    selectedForRevoke.has(grantKey(grant))
  )
  const removableSelection: readonly RemovableMember[] = selectedGrants.map(
    (grant) => ({ id: grantKey(grant), label: grantName(grant) })
  )

  return (
    <>
      <Card>
        <CardHeader actionLayout="inline">
          <CardTitle>Access management</CardTitle>
          <CardAction>
            <AccessManagementToggle
              active={managing}
              disabled={mutationPending}
              onChange={setManaging}
              subject="access"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <h3 className="font-heading text-label">Direct access</h3>
          {managing ? (
            <p className="mb-3 text-body text-muted-foreground" role="status">
              Role changes save automatically.
            </p>
          ) : (
            <p className="mb-3 text-body text-muted-foreground">
              Direct access grants for people and projects.
            </p>
          )}
          {directGrants.length ? (
            <ul
              aria-label="Direct access grants"
              className="flex flex-col gap-3"
            >
              {directGrants.map((grant) => {
                const kind = principalKindFor(grant)
                const primaryProject = isPrimaryProjectAccessGrant(
                  resource,
                  grant
                )
                const editable =
                  managing &&
                  !primaryProject &&
                  canGrant &&
                  kind !== undefined &&
                  isAccessGrantRole(grant.permission) &&
                  roles.includes(grant.permission)
                const revocable =
                  managing &&
                  !primaryProject &&
                  kind !== undefined &&
                  grant.permission !== "owner" &&
                  canGrant
                const revokeBlockedReason = primaryProject
                  ? "Managed through project assignment"
                  : grant.permission === "owner"
                    ? "The manager cannot be revoked here"
                    : kind === undefined
                      ? "This grant is read-only"
                      : "This member cannot be revoked here"
                return (
                  <AccessGrantRow
                    badge={
                      primaryProject ? (
                        <Badge
                          aria-label="Primary project. Managed through project assignment."
                          variant="outline"
                        >
                          Primary project
                        </Badge>
                      ) : undefined
                    }
                    identity={
                      <div className="min-w-0 flex-1">
                        <p className="min-w-0 truncate text-label">
                          <PrincipalName grant={grant} />
                        </p>
                        <p className="flex min-w-0 items-center gap-1.5 text-body text-muted-foreground">
                          <PrincipalTypeIcon
                            label={principalLabel(grant)}
                            type={grant.principal_type}
                          />
                          <span className="truncate">
                            {grant.slug ?? grant.principal_id}
                          </span>
                        </p>
                      </div>
                    }
                    key={grantKey(grant)}
                    lockedReason={revokeBlockedReason}
                    managing={managing}
                    mutationPending={mutationPending}
                    onRevoke={() => {
                      stageOne(grantKey(grant))
                      setRemoveDialogOpen(true)
                    }}
                    pending={isSaving(grantKey(grant))}
                    pendingAriaLabel={`Saving access for ${grantName(grant)}`}
                    revocable={revocable}
                    revokeAriaLabel={`Revoke access for ${grantName(grant)}`}
                    revokeTooltipLabel="Revoke access"
                    roleBadge={<AccessRoleBadge role={grant.permission} />}
                    roleEditor={
                      editable ? (
                        <NativeSelect
                          aria-label={`Role for ${grantName(grant)}`}
                          className="w-full sm:w-fit"
                          disabled={mutationPending}
                          onChange={(event) => {
                            if (isAccessGrantRole(event.target.value)) {
                              void setGrant(grant, event.target.value)
                            }
                          }}
                          value={grant.permission}
                        >
                          {roles.map((role) => (
                            <NativeSelectOption key={role} value={role}>
                              {accessRoleLabel(role)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : undefined
                    }
                    selectable={revocable}
                    selected={selectedForRevoke.has(grantKey(grant))}
                    selectionLabel={`Select ${grantName(grant)} for revocation`}
                    onSelectionChange={(checked) =>
                      toggleSelection(grantKey(grant), checked)
                    }
                  />
                )
              })}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">
              No direct access grants are recorded.
            </p>
          )}
          {error?.surface === "direct" && !addOpen ? (
            <p className="mt-3 text-body text-destructive" role="alert">
              {error.message}
            </p>
          ) : null}
          {canGrant ? (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {removableSelection.length > 0 ? (
                <Button
                  disabled={mutationPending}
                  onClick={() => setRemoveDialogOpen(true)}
                  type="button"
                  variant="destructive"
                >
                  <RemoveMemberIcon data-icon="inline-start" />
                  {removableSelection.length > 1
                    ? `Revoke access for ${removableSelection.length} members`
                    : "Revoke access"}
                </Button>
              ) : null}
              <Button
                className="max-sm:w-full"
                disabled={mutationPending}
                onClick={() => {
                  setError(undefined)
                  setAddOpen(true)
                }}
                type="button"
              >
                <AddAccessGrantIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Add access
              </Button>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-heading text-label">Public access</h3>
              <VisibilityBadge isPublic={resource.public} />
            </div>
            <Button
              className="max-sm:w-full"
              disabled={mutationPending}
              onClick={() => {
                setError(undefined)
                setPendingPublic(!resource.public)
              }}
              type="button"
              variant={resource.public ? "outline" : "default"}
            >
              {resource.public ? "Make private" : "Publish"}
            </Button>
            {error?.surface === "public" ? (
              <p className="basis-full text-body text-destructive" role="alert">
                {error.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AddMembersDialog
        disabled={mutationPending}
        existingIds={(kind) =>
          directGrants
            .filter((grant) => principalKindFor(grant) === kind)
            .map((grant) => grant.principal_id)
        }
        onAdd={commitGrant}
        onOpenChange={setAddOpen}
        open={addOpen}
        principalKinds={["users", "projects"]}
        resourceName={resourceDetailDisplayName(resource)}
        roleLabel="Access role"
        roles={roles}
        scope={scope}
        title="Add direct access"
      />
      <RemoveMembersDialog
        confirmLabel={(count) =>
          count > 1 ? `Revoke access for ${count} members` : "Revoke access"
        }
        description={
          removableSelection.length > 1 ? (
            <>
              These {removableSelection.length} members will no longer have
              direct access to{" "}
              <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>
              .
            </>
          ) : removableSelection[0] ? (
            <>
              <ResourceName>{removableSelection[0].label}</ResourceName> will no
              longer have direct access to{" "}
              <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>
              .
            </>
          ) : null
        }
        disabled={mutationPending}
        errorLabel={(count) =>
          count === 1
            ? "1 member could not be revoked. Try again."
            : `${count} members could not be revoked. Try again.`
        }
        members={removableSelection}
        onOpenChange={setRemoveDialogOpen}
        onRemove={commitRevoke}
        open={removeDialogOpen}
        title="Revoke access?"
      />
      <ConfirmationDialog
        confirmLabel={pendingPublic ? "Publish" : "Make private"}
        description={
          pendingPublic ? (
            <>
              <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>{" "}
              will be available to anyone who can access this Crucible server.
            </>
          ) : (
            <>
              <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>{" "}
              will no longer be publicly available.
            </>
          )
        }
        error={error?.surface === "public" ? error.message : undefined}
        onOpenChange={(open) => {
          if (mutationPending) return
          if (!open) setPendingPublic(undefined)
        }}
        onConfirm={() => {
          if (pendingPublic !== undefined)
            void changePublicAccess(pendingPublic)
        }}
        open={pendingPublic !== undefined}
        pending={mutationPending}
        title={pendingPublic ? "Publish resource?" : "Make resource private?"}
      />
    </>
  )
}

function principalLabel(grant: WorkspaceResourceAccessGrant) {
  const labels: Record<WorkspaceResourceAccessGrant["principal_type"], string> =
    {
      instrument: "Instrument",
      project: "Project",
      public: "Public",
      service_account: "Service account",
      system: "System",
      unknown: "Unknown principal",
      user: "Person",
    }
  return labels[grant.principal_type]
}

function PrincipalName({ grant }: { grant: WorkspaceResourceAccessGrant }) {
  const name = grantName(grant)
  if (
    grant.principal_type === "user" ||
    grant.principal_type === "service_account"
  ) {
    return (
      <PersonLink
        person={{
          name,
          is_service_account: grant.principal_type === "service_account",
          unique_id: grant.principal_id,
          username: grant.slug,
        }}
      />
    )
  }
  if (grant.principal_type === "project") {
    return (
      <Link
        className="hover:underline"
        params={{ projectMfid: grant.principal_id }}
        search={{ preview: undefined }}
        state={{}}
        to="/projects/$projectMfid"
      >
        {name}
      </Link>
    )
  }
  if (grant.principal_type === "instrument") {
    return (
      <Link
        className="hover:underline"
        params={{ instrumentMfid: grant.principal_id }}
        search={{}}
        state={{}}
        to="/instruments/$instrumentMfid"
      >
        {name}
      </Link>
    )
  }
  return name
}

function accessError(error: unknown, action: string) {
  return hubErrorMessage(error, `Could not ${action}. Try again.`)
}
