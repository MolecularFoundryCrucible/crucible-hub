import { useId, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { resourceDetailDisplayName } from "@/lib/resource-name"

import {
  AddRelationshipIcon,
  FinishManagingRelationshipsIcon,
  ManageRelationshipsIcon,
  RelationshipPendingIcon,
  ResourceGraphIcon,
  UnlinkRelationshipIcon,
} from "@/components/crucible/icons"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import {
  ResourceRelationships,
  groupResourceRelationships,
} from "@/components/crucible/resource-relationships"
import {
  staticResourceSiblingCollection,
  useRegisterResourceSiblings,
} from "@/components/crucible/resource-sibling-navigation"
import { ResourceName } from "@/components/crucible/resource-name"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  isWorkspaceRelationshipType,
  workspaceRelationshipChoiceDescription,
  workspaceRelationshipChoices,
  workspaceRelationshipOperation,
  workspaceRelationshipTypeOptions,
} from "@/data/crucible/resource-relationships"
import type { WorkspaceRelationshipChoice } from "@/data/crucible/resource-relationships"
import { mutateWorkspaceResourceRelationship } from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceLinkedResource,
  WorkspaceRelationshipMutationResult,
  WorkspaceRelationshipOperation,
  WorkspaceRelationshipType,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

type RelationshipResource = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" | "sample" }
>
export function ResourceRelationshipManager({
  resource,
  scope,
}: {
  resource: RelationshipResource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const [pendingUnlink, setPendingUnlink] = useState<WorkspaceLinkedResource>()
  const [unlinkError, setUnlinkError] = useState<string>()
  const previewSiblingCollections = useMemo(() => {
    const items = groupResourceRelationships(
      resource.kind,
      resource.links ?? []
    )
      .flatMap((group) => group.links)
      .filter(isPreviewableRelationship)
      .map((link) => ({
        kind: link.resource_type,
        mfid: link.unique_id,
        name: link.name || link.unique_id,
      }))
    return items.length
      ? [staticResourceSiblingCollection(items, "Relationships")]
      : []
  }, [resource.kind, resource.links])
  useRegisterResourceSiblings(previewSiblingCollections)
  const canManage =
    resource.capabilities?.can_edit === true && resource.links !== null
  const hasRelationships = (resource.links?.length ?? 0) > 0
  const managementMode = canManage && hasRelationships && managing

  function applyResult(result: WorkspaceRelationshipMutationResult) {
    for (const detail of [result.source, result.target]) {
      queryClient.setQueryData(
        resourceQueryOptions(scope, detail.unique_id).queryKey,
        detail
      )
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.resourceGraphs(scope, detail.unique_id),
      })
    }
    if (
      result.source.unique_id === resource.unique_id &&
      (result.source.kind === "sample" || result.source.kind === "dataset") &&
      result.source.links?.length === 0
    ) {
      setManaging(false)
    }
  }

  const unlinkMutation = useMutation({
    mutationFn: async (link: WorkspaceLinkedResource) =>
      unwrapHubResult(
        await mutateWorkspaceResourceRelationship({
          data: operationFor(resource, link, "unlink", scope),
        })
      ),
  })

  async function unlink() {
    if (!pendingUnlink) return
    setUnlinkError(undefined)
    try {
      applyResult(await unlinkMutation.mutateAsync(pendingUnlink))
      setPendingUnlink(undefined)
    } catch (error) {
      setUnlinkError(relationshipError(error, "unlink"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle aria-level={2} role="heading">
          Relationships
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            <ResourceGraphLink resource={resource} />
            {canManage ? (
              <>
                <Button
                  aria-label={`Add relationship to ${resourceDetailDisplayName(resource)}`}
                  onClick={() => setAddOpen(true)}
                  type="button"
                >
                  <AddRelationshipIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  Add
                </Button>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Button
                      aria-label={
                        managementMode
                          ? `Finish managing relationships for ${resourceDetailDisplayName(resource)}`
                          : !hasRelationships
                            ? `No relationships to manage for ${resourceDetailDisplayName(resource)}`
                            : `Manage relationships for ${resourceDetailDisplayName(resource)}`
                      }
                      aria-pressed={managementMode}
                      disabled={!hasRelationships}
                      onClick={() => setManaging((current) => !current)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      {managementMode ? (
                        <FinishManagingRelationshipsIcon aria-hidden="true" />
                      ) : (
                        <ManageRelationshipsIcon aria-hidden="true" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {managementMode
                      ? "Done managing relationships for "
                      : !hasRelationships
                        ? "No relationships to manage for "
                        : "Manage relationships for "}
                    <ResourceName>
                      {resourceDetailDisplayName(resource)}
                    </ResourceName>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ResourceRelationships
          kind={resource.kind}
          links={resource.links}
          managing={managementMode}
          renderManagementAction={
            canManage
              ? (link) =>
                  isSupportedRelationship(resource, link) ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={`Unlink ${link.name || link.unique_id}`}
                            onClick={() => {
                              setUnlinkError(undefined)
                              setPendingUnlink(link)
                            }}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          />
                        }
                      >
                        <UnlinkRelationshipIcon aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Unlink{" "}
                        <ResourceName>
                          {link.name || link.unique_id}
                        </ResourceName>
                      </TooltipContent>
                    </Tooltip>
                  ) : null
              : undefined
          }
        />
      </CardContent>
      {canManage ? (
        <AddRelationshipDialog
          onApplied={applyResult}
          onOpenChange={setAddOpen}
          open={addOpen}
          resource={resource}
          scope={scope}
        />
      ) : null}
      <ConfirmationAlertDialog
        confirmLabel="Unlink"
        description={
          <>
            {pendingUnlink
              ? unlinkDescription(resource, pendingUnlink)
              : "This relationship will be removed."}{" "}
            Neither resource will be deleted.
          </>
        }
        error={unlinkError}
        onOpenChange={(open) => {
          if (unlinkMutation.isPending) return
          if (!open) {
            setPendingUnlink(undefined)
            setUnlinkError(undefined)
          }
        }}
        onConfirm={() => void unlink()}
        open={pendingUnlink !== undefined}
        pending={unlinkMutation.isPending}
        pendingLabel="Unlinking"
        title="Unlink relationship?"
      />
    </Card>
  )
}

function isPreviewableRelationship(
  link: WorkspaceLinkedResource
): link is WorkspaceLinkedResource & { resource_type: "dataset" | "sample" } {
  return link.resource_type === "dataset" || link.resource_type === "sample"
}

function ResourceGraphLink({ resource }: { resource: RelationshipResource }) {
  const link =
    resource.kind === "sample" ? (
      <Link
        aria-label={`Explore graph for ${resourceDetailDisplayName(resource)}`}
        className={buttonVariants({ variant: "outline" })}
        params={{ sampleMfid: resource.unique_id }}
        preload={false}
        search={{ preview: undefined }}
        to="/samples/$sampleMfid/graph"
      />
    ) : (
      <Link
        aria-label={`Explore graph for ${resourceDetailDisplayName(resource)}`}
        className={buttonVariants({ variant: "outline" })}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ preview: undefined }}
        to="/datasets/$datasetMfid/graph"
      />
    )
  return (
    <Tooltip>
      <TooltipTrigger render={link}>
        <ResourceGraphIcon aria-hidden="true" data-icon="inline-start" />
        Graph
      </TooltipTrigger>
      <TooltipContent>
        Explore graph for{" "}
        <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>
      </TooltipContent>
    </Tooltip>
  )
}

function AddRelationshipDialog({
  onApplied,
  onOpenChange,
  open,
  resource,
  scope,
}: {
  onApplied: (result: WorkspaceRelationshipMutationResult) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  resource: RelationshipResource
  scope: IdentityScope
}) {
  const inputId = useId()
  const typeId = useId()
  const relationshipTypeId = useId()
  const choices = workspaceRelationshipChoices[resource.kind]
  const [choiceIndex, setChoiceIndex] = useState(0)
  const [relationshipType, setRelationshipType] =
    useState<WorkspaceRelationshipType | null>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<WorkspaceSearchResult>()
  const [validationError, setValidationError] = useState<string>()
  const [mutationError, setMutationError] = useState<string>()
  const choice = choices[choiceIndex] ?? choices[0]
  const existing =
    resource.links
      ?.filter(
        (link) =>
          link.relationship === choice.relationship &&
          link.resource_type === choice.targetKind
      )
      .map((link) => link.unique_id) ?? []
  const mutation = useMutation({
    mutationFn: async (target: WorkspaceSearchResult) =>
      unwrapHubResult(
        await mutateWorkspaceResourceRelationship({
          data: operationFor(
            resource,
            {
              name: target.name,
              relationship: choice.relationship,
              relationship_type: relationshipType,
              resource_type: target.kind,
              unique_id: target.unique_id,
            },
            "link",
            scope
          ),
        })
      ),
  })

  function reset() {
    setChoiceIndex(0)
    setRelationshipType(null)
    setQuery("")
    setSelected(undefined)
    setValidationError(undefined)
    setMutationError(undefined)
  }

  function changeOpen(nextOpen: boolean) {
    if (mutation.isPending) return
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  async function add() {
    if (!selected) {
      setValidationError("Choose a resource to link.")
      return
    }
    setMutationError(undefined)
    try {
      onApplied(await mutation.mutateAsync(selected))
      onOpenChange(false)
      reset()
    } catch (error) {
      setMutationError(relationshipError(error, "link"))
    }
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent showCloseButton={!mutation.isPending}>
        <DialogHeader>
          <DialogTitle>Add relationship</DialogTitle>
          <DialogDescription>
            Choose how another resource relates to{" "}
            <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>,
            then search for it by name or MFID.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={typeId}>Relationship</FieldLabel>
            <NativeSelect
              disabled={mutation.isPending}
              id={typeId}
              onChange={(event) => {
                setChoiceIndex(Number(event.target.value))
                setRelationshipType(null)
                setQuery("")
                setSelected(undefined)
                setValidationError(undefined)
                setMutationError(undefined)
              }}
              value={String(choiceIndex)}
            >
              {choices.map((candidate, index) => (
                <NativeSelectOption key={candidate.label} value={String(index)}>
                  {candidate.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              {workspaceRelationshipChoiceDescription(resource.kind, choice)}
            </FieldDescription>
          </Field>
          {choice.relationship === "associated" ? null : (
            <Field>
              <FieldLabel htmlFor={relationshipTypeId}>
                Relationship type
              </FieldLabel>
              <NativeSelect
                disabled={mutation.isPending}
                id={relationshipTypeId}
                onChange={(event) => {
                  const value = event.target.value
                  setRelationshipType(
                    isWorkspaceRelationshipType(value) ? value : null
                  )
                  setMutationError(undefined)
                }}
                value={relationshipType ?? ""}
              >
                <NativeSelectOption value="">Unspecified</NativeSelectOption>
                {workspaceRelationshipTypeOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                Describes the child relative to the parent.
              </FieldDescription>
            </Field>
          )}
          <ResourceSearchCombobox
            disabled={mutation.isPending}
            excludedIds={[resource.unique_id, ...existing]}
            id={inputId}
            kind={choice.targetKind}
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery)
              setValidationError(undefined)
              setMutationError(undefined)
            }}
            onValueChange={(item) => {
              setSelected(item)
              setValidationError(undefined)
              setMutationError(undefined)
            }}
            query={query}
            scope={scope}
            value={selected}
          />
          {selected ? (
            <p className="text-body">
              <LinkConfirmation
                choice={choice}
                relationshipType={relationshipType}
                resource={resource}
                target={selected}
              />
            </p>
          ) : null}
          {mutationError ? (
            <p className="text-body text-destructive" role="alert">
              {mutationError}
            </p>
          ) : null}
          {validationError ? (
            <p className="text-body text-destructive" role="alert">
              {validationError}
            </p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={() => changeOpen(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!selected || mutation.isPending}
            onClick={() => void add()}
            type="button"
          >
            {mutation.isPending ? (
              <RelationshipPendingIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : null}
            {mutation.isPending ? "Adding" : "Add relationship"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isSupportedRelationship(
  resource: RelationshipResource,
  link: WorkspaceLinkedResource
) {
  if (link.relationship === "associated") {
    return (
      (resource.kind === "sample" && link.resource_type === "dataset") ||
      (resource.kind === "dataset" && link.resource_type === "sample")
    )
  }
  return link.resource_type === resource.kind
}

function operationFor(
  resource: RelationshipResource,
  link: WorkspaceLinkedResource,
  action: "link" | "unlink",
  scope: IdentityScope
): WorkspaceRelationshipOperation {
  return workspaceRelationshipOperation({
    action,
    relationship: link.relationship,
    relationshipType: isWorkspaceRelationshipType(link.relationship_type)
      ? link.relationship_type
      : null,
    resourceKind: resource.kind,
    scenario: fixtureScenarioFromScope(scope),
    resourceMfid: resource.unique_id,
    targetMfid: link.unique_id,
  })
}

function LinkConfirmation({
  choice,
  relationshipType,
  resource,
  target,
}: {
  choice: WorkspaceRelationshipChoice
  relationshipType: WorkspaceRelationshipType | null
  resource: RelationshipResource
  target: WorkspaceSearchResult
}) {
  if (choice.relationship === "associated") {
    return (
      <>
        <ResourceName>{target.name}</ResourceName> will be linked with{" "}
        <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>.
      </>
    )
  }
  if (relationshipType) {
    const child = choice.relationship === "parent" ? resource : target
    const parent = choice.relationship === "parent" ? target : resource
    return (
      <>
        <ResourceName>{child.name}</ResourceName>{" "}
        {relationshipType === "is_derived_from"
          ? "is derived from"
          : "is part of"}{" "}
        <ResourceName>{parent.name}</ResourceName>.
      </>
    )
  }
  return (
    <>
      <ResourceName>{target.name}</ResourceName> will be a {choice.relationship}{" "}
      of <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>.
    </>
  )
}

function unlinkDescription(
  resource: RelationshipResource,
  link: WorkspaceLinkedResource
) {
  const target = link.name || link.unique_id
  if (link.relationship === "associated") {
    return (
      <>
        <ResourceName>{target}</ResourceName> will no longer be linked with{" "}
        <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>.
      </>
    )
  }
  return (
    <>
      <ResourceName>{target}</ResourceName> will no longer be a{" "}
      {link.relationship} of{" "}
      <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>.
    </>
  )
}

function relationshipError(error: unknown, action: "link" | "unlink") {
  if (error instanceof HubApiClientError) {
    if (error.details.kind === "forbidden") {
      return "You do not have permission to change both resources."
    }
    if (error.details.kind === "not-found") {
      return "One of the resources or the relationship is no longer available."
    }
    if (error.details.kind === "conflict") {
      return "These resources may already have this relationship."
    }
    if (error.details.kind === "validation") {
      return "This relationship is not valid."
    }
    return `${error.details.message} Reference: ${error.details.correlationId}`
  }
  return action === "link"
    ? "The relationship could not be added. Your selection is still here."
    : "The relationship could not be removed. Try again."
}
