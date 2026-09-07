import { useEffect, useId, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"

import {
  AccessRoleBadge,
  accessRoleLabel,
  accessRoleRank,
  isAccessGrantRole,
  permittedAccessGrantRoles,
} from "@/components/crucible/access-role-badge"
import {
  ContentBoundary,
  ContentGrid,
} from "@/components/crucible/content-layout"
import {
  AccessPendingIcon,
  AddAccessGrantIcon,
  ManageAccessIcon,
  PrivateAccessIcon,
  PublicAccessIcon,
  RevokeAccessGrantIcon,
  OpenFullPageIcon,
} from "@/components/crucible/icons"
import { ResourceName } from "@/components/crucible/resource-name"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  publishWorkspaceResource,
  revokeWorkspaceResourceAccess,
  setWorkspaceResourceAccess,
  unpublishWorkspaceResource,
} from "@/data/crucible/access.functions"
import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import { searchQueryOptions } from "@/data/crucible/search.queries"
import type {
  WorkspaceResourceAccessGrant,
  WorkspaceResourceAccessPrincipalKind,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { OwnershipTransferCard } from "@/features/resource-ownership/ownership-transfer-card"
import { ProjectAssignmentCard } from "@/features/resource-project-assignment/project-assignment-card"

type AccessResource = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" | "sample" }
>
type GrantRole = "viewer" | "contributor" | "editor" | "admin"
type PrincipalKind = WorkspaceResourceAccessPrincipalKind

const principalChoices: readonly {
  kind: PrincipalKind
  label: string
  searchKind: "person" | "project"
}[] = [
  { kind: "users", label: "Person", searchKind: "person" },
  { kind: "projects", label: "Project", searchKind: "project" },
]

export function ResourceAccessPage({
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
  if (!canManageAccess && !canTransfer) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Access management is unavailable</EmptyTitle>
          <EmptyDescription>
            You do not have permission to manage access to this resource.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {canManageAccess ? (
        <ContentBoundary width="reading">
          <ManagedResourceAccess resource={resource} scope={scope} />
        </ContentBoundary>
      ) : null}
      <ContentGrid variant="actions">
        <ProjectAssignmentCard mode={mode} resource={resource} scope={scope} />
        <OwnershipTransferCard mode={mode} resource={resource} scope={scope} />
      </ContentGrid>
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
  const [managing, setManaging] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<string>()
  const [pendingPublic, setPendingPublic] = useState<boolean>()
  const [pendingRevoke, setPendingRevoke] =
    useState<WorkspaceResourceAccessGrant>()
  const [error, setError] = useState<{
    message: string
    surface: "direct" | "public"
  }>()
  const roles = permittedAccessGrantRoles(resource.capabilities?.max_grant_role)
  const mutationPending = pendingAction !== undefined
  const canGrant = roles.length > 0

  function applyGrants(nextGrants: readonly WorkspaceResourceAccessGrant[]) {
    queryClient.setQueryData(
      resourceAccessQueryOptions(scope, resource.unique_id).queryKey,
      nextGrants
    )
  }

  async function setGrant(
    kind: PrincipalKind,
    principal: string,
    permission: GrantRole
  ) {
    const action = `set:${kind}:${principal}`
    setPendingAction(action)
    setError(undefined)
    try {
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
      setAddOpen(false)
    } catch (mutationError) {
      setError({
        message: accessError(mutationError, "update this access grant"),
        surface: "direct",
      })
    } finally {
      setPendingAction(undefined)
    }
  }

  async function revokeGrant(grant: WorkspaceResourceAccessGrant) {
    const kind = principalKindFor(grant)
    if (!kind) return
    setPendingAction(`revoke:${grant.principal_type}:${grant.principal_id}`)
    setError(undefined)
    try {
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
      setPendingRevoke(undefined)
    } catch (mutationError) {
      setError({
        message: accessError(mutationError, "revoke this access grant"),
        surface: "direct",
      })
    } finally {
      setPendingAction(undefined)
    }
  }

  async function changePublicAccess(publicAccess: boolean) {
    setPendingAction(`public:${publicAccess}`)
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
      setPendingAction(undefined)
    }
  }

  if (isPending) {
    return (
      <p className="text-body text-muted-foreground" role="status">
        Loading access…
      </p>
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Public access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={resource.public ? "default" : "outline"}>
            {resource.public ? (
              <PublicAccessIcon data-icon="inline-start" />
            ) : (
              <PrivateAccessIcon data-icon="inline-start" />
            )}
            {resource.public ? "Public" : "Private"}
          </Badge>
          <Button
            disabled={mutationPending}
            onClick={() => {
              setError(undefined)
              setPendingPublic(!resource.public)
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {resource.public ? "Make private" : "Publish"}
          </Button>
          {error?.surface === "public" ? (
            <p className="basis-full text-body text-destructive" role="alert">
              {error.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direct access</CardTitle>
          <CardAction>
            <div className="flex flex-wrap justify-end gap-2">
              {managing && canGrant ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label="Add access"
                        disabled={mutationPending}
                        onClick={() => {
                          setError(undefined)
                          setAddOpen(true)
                        }}
                        size="icon-sm"
                        type="button"
                      />
                    }
                  >
                    <AddAccessGrantIcon aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Add access</TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={
                        managing ? "Finish managing access" : "Manage access"
                      }
                      aria-pressed={managing}
                      disabled={mutationPending}
                      onClick={() => setManaging((current) => !current)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    />
                  }
                >
                  <ManageAccessIcon aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>
                  {managing ? "Finish managing access" : "Manage access"}
                </TooltipContent>
              </Tooltip>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {directGrants.length ? (
            <ul
              aria-label="Direct access grants"
              className="flex flex-col gap-3"
            >
              {directGrants.map((grant) => {
                const kind = principalKindFor(grant)
                const editable =
                  managing &&
                  canGrant &&
                  kind !== undefined &&
                  isAccessGrantRole(grant.permission) &&
                  roles.includes(grant.permission)
                const revocable =
                  managing && kind !== undefined && grant.permission !== "owner"
                const pending =
                  pendingAction === `set:${kind ?? ""}:${grant.principal_id}`
                return (
                  <li
                    className="flex min-w-0 items-center gap-3"
                    key={grantKey(grant)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label">{grantName(grant)}</p>
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
                    <div className="flex min-h-8 shrink-0 items-center gap-2">
                      <span className="flex w-access-role-control justify-end">
                        {editable ? (
                          <NativeSelect
                            aria-label={`Role for ${grantName(grant)}`}
                            disabled={mutationPending}
                            onChange={(event) => {
                              if (isAccessGrantRole(event.target.value)) {
                                void setGrant(
                                  kind,
                                  grant.principal_id,
                                  event.target.value
                                )
                              }
                            }}
                            size="sm"
                            value={grant.permission}
                          >
                            {roles.map((role) => (
                              <NativeSelectOption key={role} value={role}>
                                {accessRoleLabel(role)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        ) : (
                          <AccessRoleBadge role={grant.permission} />
                        )}
                      </span>
                      <span className="inline-flex size-4 items-center justify-center">
                        {pending ? (
                          <AccessPendingIcon
                            aria-label={`Saving access for ${grantName(grant)}`}
                            className="motion-safe:animate-spin"
                          />
                        ) : null}
                      </span>
                      {revocable ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                aria-label={`Revoke access for ${grantName(grant)}`}
                                disabled={mutationPending}
                                onClick={() => {
                                  setError(undefined)
                                  setPendingRevoke(grant)
                                }}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                              />
                            }
                          >
                            <RevokeAccessGrantIcon aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Revoke access</TooltipContent>
                        </Tooltip>
                      ) : kind ? (
                        <PrincipalNavigation grant={grant} />
                      ) : (
                        <span className="size-7" />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">
              No direct access grants are recorded.
            </p>
          )}
          {error?.surface === "direct" ? (
            <p className="mt-3 text-body text-destructive" role="alert">
              {error.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AddAccessDialog
        error={error?.surface === "direct" ? error.message : undefined}
        existingGrants={directGrants}
        onOpenChange={setAddOpen}
        onSetGrant={setGrant}
        open={addOpen}
        pending={mutationPending}
        resource={resource}
        roles={roles}
        scope={scope}
      />
      <AlertDialog
        onOpenChange={(open) => {
          if (mutationPending) return
          if (!open) setPendingRevoke(undefined)
        }}
        open={pendingRevoke !== undefined}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke ? (
                <>
                  <ResourceName>{grantName(pendingRevoke)}</ResourceName> will
                  no longer have direct access to{" "}
                  <ResourceName>{resource.name}</ResourceName>.
                </>
              ) : null}
            </AlertDialogDescription>
            {error?.surface === "direct" ? (
              <p className="text-body text-destructive" role="alert">
                {error.message}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutationPending}
              onClick={(event) => {
                event.preventDefault()
                if (pendingRevoke) void revokeGrant(pendingRevoke)
              }}
              variant="destructive"
            >
              {mutationPending ? (
                <AccessPendingIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <RevokeAccessGrantIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
              )}
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        onOpenChange={(open) => {
          if (mutationPending) return
          if (!open) setPendingPublic(undefined)
        }}
        open={pendingPublic !== undefined}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPublic ? "Publish resource?" : "Make resource private?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPublic ? (
                <>
                  <ResourceName>{resource.name}</ResourceName> will be available
                  to anyone who can access this Crucible server.
                </>
              ) : (
                <>
                  <ResourceName>{resource.name}</ResourceName> will no longer be
                  publicly available.
                </>
              )}
            </AlertDialogDescription>
            {error?.surface === "public" ? (
              <p className="text-body text-destructive" role="alert">
                {error.message}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutationPending}
              onClick={(event) => {
                event.preventDefault()
                if (pendingPublic !== undefined) {
                  void changePublicAccess(pendingPublic)
                }
              }}
            >
              {mutationPending ? (
                <AccessPendingIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {pendingPublic ? "Publish" : "Make private"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AddAccessDialog({
  error,
  existingGrants,
  onOpenChange,
  onSetGrant,
  open,
  pending,
  resource,
  roles,
  scope,
}: {
  error: string | undefined
  existingGrants: readonly WorkspaceResourceAccessGrant[]
  onOpenChange: (open: boolean) => void
  onSetGrant: (
    kind: PrincipalKind,
    principal: string,
    permission: GrantRole
  ) => Promise<void>
  open: boolean
  pending: boolean
  resource: AccessResource
  roles: readonly GrantRole[]
  scope: IdentityScope
}) {
  const queryInputId = useId()
  const principalInputId = useId()
  const roleInputId = useId()
  const [principalIndex, setPrincipalIndex] = useState(0)
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [role, setRole] = useState<GrantRole>(defaultGrantRole(roles))
  const [selected, setSelected] = useState<WorkspaceSearchResult>()
  const [validationError, setValidationError] = useState<string>()
  const choice = principalChoices[principalIndex] ?? principalChoices[0]
  const search = useQuery({
    ...searchQueryOptions(scope, submitted, [choice.searchKind]),
    enabled: open && submitted.length >= 3,
  })
  const group = search.data?.groups.find(
    (candidate) => candidate.kind === choice.searchKind
  )
  const existing = new Set(
    existingGrants
      .filter((grant) => principalKindFor(grant) === choice.kind)
      .map((grant) => grant.principal_id)
  )
  const results =
    group?.items.filter((item) => !existing.has(item.unique_id)) ?? []

  useEffect(() => {
    if (!open) reset()
  }, [open])

  useEffect(() => {
    if (!roles.includes(role)) setRole(defaultGrantRole(roles))
  }, [role, roles])

  function reset() {
    setPrincipalIndex(0)
    setQuery("")
    setSubmitted("")
    setRole(defaultGrantRole(roles))
    setSelected(undefined)
    setValidationError(undefined)
  }

  function changeOpen(nextOpen: boolean) {
    if (pending) return
    onOpenChange(nextOpen)
  }

  function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = query.trim()
    if (nextQuery.length < 3) {
      setValidationError("Enter at least 3 characters.")
      return
    }
    setValidationError(undefined)
    setSelected(undefined)
    if (nextQuery === submitted) {
      void search.refetch()
    } else {
      setSubmitted(nextQuery)
    }
  }

  async function addGrant() {
    if (!selected) {
      setValidationError("Choose a person or project.")
      return
    }
    await onSetGrant(choice.kind, selected.unique_id, role)
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Add direct access</DialogTitle>
          <DialogDescription>
            Choose a person or project, then set the access role for{" "}
            <ResourceName>{resource.name}</ResourceName>.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={principalInputId}>Principal type</FieldLabel>
            <NativeSelect
              disabled={pending}
              id={principalInputId}
              onChange={(event) => {
                setPrincipalIndex(Number(event.target.value))
                setSubmitted("")
                setSelected(undefined)
                setValidationError(undefined)
              }}
              value={String(principalIndex)}
            >
              {principalChoices.map((candidate, index) => (
                <NativeSelectOption key={candidate.kind} value={String(index)}>
                  {candidate.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <form onSubmit={runSearch}>
            <FieldGroup className="sm:flex-row sm:items-end">
              <Field
                className="min-w-0 flex-1"
                data-invalid={Boolean(validationError)}
              >
                <FieldLabel htmlFor={queryInputId}>
                  Search {choice.label.toLowerCase()}s
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(validationError) || undefined}
                  autoComplete="off"
                  disabled={pending}
                  id={queryInputId}
                  minLength={3}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSubmitted("")
                    setSelected(undefined)
                    setValidationError(undefined)
                  }}
                  required
                  type="search"
                  value={query}
                />
                <FieldDescription>
                  Enter at least 3 characters.
                </FieldDescription>
                {validationError ? (
                  <FieldError>{validationError}</FieldError>
                ) : null}
              </Field>
              <Button disabled={pending} type="submit" variant="outline">
                Search
              </Button>
            </FieldGroup>
          </form>
          <Field>
            <FieldLabel htmlFor={roleInputId}>Access role</FieldLabel>
            <NativeSelect
              disabled={pending}
              id={roleInputId}
              onChange={(event) => {
                if (isAccessGrantRole(event.target.value)) {
                  setRole(event.target.value)
                }
              }}
              value={role}
            >
              {roles.map((candidate) => (
                <NativeSelectOption key={candidate} value={candidate}>
                  {accessRoleLabel(candidate)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {!submitted ? null : search.isPending || search.isPlaceholderData ? (
            <p className="text-body text-muted-foreground" role="status">
              Searching {choice.label.toLowerCase()}s…
            </p>
          ) : search.isError || group?.error ? (
            <p className="text-body text-destructive" role="alert">
              {choice.label}s could not be searched.
            </p>
          ) : results.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No available {choice.label.toLowerCase()}s matched this search.
            </p>
          ) : (
            <ul aria-label={`${choice.label} search results`}>
              {results.map((item) => (
                <li className="border-b last:border-0" key={item.unique_id}>
                  <Button
                    aria-pressed={selected?.unique_id === item.unique_id}
                    className="h-auto w-full justify-start py-2 whitespace-normal"
                    disabled={pending}
                    onClick={() => {
                      setSelected(item)
                      setValidationError(undefined)
                    }}
                    type="button"
                    variant={
                      selected?.unique_id === item.unique_id
                        ? "secondary"
                        : "ghost"
                    }
                  >
                    <span className="min-w-0 text-left">
                      <span className="block text-label">{item.name}</span>
                      {item.context ? (
                        <span className="block text-supporting text-muted-foreground">
                          {item.context}
                        </span>
                      ) : null}
                      <span className="block font-mono text-identifier break-all text-muted-foreground">
                        {item.unique_id}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {selected ? (
            <p className="text-body">
              <ResourceName>{selected.name}</ResourceName> will have the{" "}
              {accessRoleLabel(role).toLowerCase()} role.
            </p>
          ) : null}
          {error ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => changeOpen(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!selected || pending}
            onClick={() => void addGrant()}
            type="button"
          >
            {pending ? (
              <AccessPendingIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <AddAccessGrantIcon aria-hidden="true" data-icon="inline-start" />
            )}
            Add access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function sortAccessGrants(
  grants: readonly WorkspaceResourceAccessGrant[]
) {
  return [...grants].sort((left, right) => {
    const roleDifference =
      accessRoleRank(left.permission) - accessRoleRank(right.permission)
    if (roleDifference !== 0) return roleDifference
    const nameDifference = grantName(left).localeCompare(grantName(right))
    if (nameDifference !== 0) return nameDifference
    return left.principal_id.localeCompare(right.principal_id)
  })
}

function principalKindFor(
  grant: WorkspaceResourceAccessGrant
): PrincipalKind | undefined {
  if (grant.principal_type === "user") return "users"
  if (grant.principal_type === "project") return "projects"
  return undefined
}

function grantName(grant: WorkspaceResourceAccessGrant) {
  return grant.display_name ?? grant.slug ?? grant.principal_id
}

function grantKey(grant: WorkspaceResourceAccessGrant) {
  return `${grant.principal_type}:${grant.principal_id}`
}

function defaultGrantRole(roles: readonly GrantRole[]): GrantRole {
  return roles.at(-1) ?? "viewer"
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

function PrincipalNavigation({
  grant,
}: {
  grant: WorkspaceResourceAccessGrant
}) {
  const common = {
    "aria-label": `Open ${grantName(grant)}`,
    className: buttonVariants({ size: "icon-sm", variant: "ghost" }),
    children: <OpenFullPageIcon aria-hidden="true" />,
    preload: false as const,
  }
  const link =
    grant.principal_type === "user" ? (
      <Link
        {...common}
        params={{ personId: grant.principal_id }}
        to="/people/$personId"
      />
    ) : (
      <Link
        {...common}
        params={{ projectMfid: grant.principal_id }}
        search={{ preview: undefined }}
        to="/projects/$projectMfid"
      />
    )
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>
        Open <ResourceName>{grantName(grant)}</ResourceName>
      </TooltipContent>
    </Tooltip>
  )
}

function accessError(error: unknown, action: string) {
  if (error instanceof HubApiClientError) return error.message
  return `Could not ${action}. Try again.`
}
