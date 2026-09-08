import { useId, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import {
  AddRelationshipIcon,
  FinishManagingRelationshipsIcon,
  ManageRelationshipsIcon,
  RelationshipPendingIcon,
  ResourceGraphIcon,
  UnlinkRelationshipIcon,
} from "@/components/crucible/icons"
import { ResourceRelationships } from "@/components/crucible/resource-relationships"
import { ResourceName } from "@/components/crucible/resource-name"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
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
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  isWorkspaceRelationshipType,
  workspaceRelationshipTypeOptions,
} from "@/data/crucible/resource-relationships"
import { mutateWorkspaceResourceRelationship } from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import { searchQueryOptions } from "@/data/crucible/search.queries"
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
type Relationship = WorkspaceRelationshipOperation["relationship"]

type RelationshipChoice = {
  label: string
  relationship: Relationship
  targetKind: "dataset" | "sample"
}

const relationshipChoices = {
  dataset: [
    { label: "Parent dataset", relationship: "parent", targetKind: "dataset" },
    { label: "Child dataset", relationship: "child", targetKind: "dataset" },
    {
      label: "Linked sample",
      relationship: "associated",
      targetKind: "sample",
    },
  ],
  sample: [
    { label: "Parent sample", relationship: "parent", targetKind: "sample" },
    { label: "Child sample", relationship: "child", targetKind: "sample" },
    {
      label: "Linked dataset",
      relationship: "associated",
      targetKind: "dataset",
    },
  ],
} satisfies Record<RelationshipResource["kind"], readonly RelationshipChoice[]>

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
        queryKey: crucibleKeys.resourceGraph(scope, detail.unique_id),
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
            {canManage ? (
              <>
                <Button
                  aria-label={`Add relationship to ${resource.name}`}
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
                          ? `Finish managing relationships for ${resource.name}`
                          : !hasRelationships
                            ? `No relationships to manage for ${resource.name}`
                            : `Manage relationships for ${resource.name}`
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
                    <ResourceName>{resource.name}</ResourceName>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex justify-center">
          <ResourceGraphLink resource={resource} />
        </div>
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
      <AlertDialog
        onOpenChange={(open) => {
          if (unlinkMutation.isPending) return
          if (!open) {
            setPendingUnlink(undefined)
            setUnlinkError(undefined)
          }
        }}
        open={pendingUnlink !== undefined}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink relationship?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUnlink
                ? unlinkDescription(resource, pendingUnlink)
                : "This relationship will be removed."}{" "}
              Neither resource will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {unlinkError ? (
            <p className="text-body text-destructive" role="alert">
              {unlinkError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinkMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unlinkMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                void unlink()
              }}
            >
              {unlinkMutation.isPending ? (
                <RelationshipPendingIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <UnlinkRelationshipIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
              )}
              {unlinkMutation.isPending ? "Unlinking" : "Unlink"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function ResourceGraphLink({ resource }: { resource: RelationshipResource }) {
  const link =
    resource.kind === "sample" ? (
      <Link
        aria-label={`Explore graph for ${resource.name}`}
        className={buttonVariants({ variant: "outline" })}
        params={{ sampleMfid: resource.unique_id }}
        preload={false}
        search={{ preview: undefined }}
        to="/samples/$sampleMfid/graph"
      />
    ) : (
      <Link
        aria-label={`Explore graph for ${resource.name}`}
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
        <ResourceGraphIcon aria-hidden="true" />
        View graph
      </TooltipTrigger>
      <TooltipContent>
        Explore graph for <ResourceName>{resource.name}</ResourceName>
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
  const choices = relationshipChoices[resource.kind]
  const [choiceIndex, setChoiceIndex] = useState(0)
  const [relationshipType, setRelationshipType] =
    useState<WorkspaceRelationshipType | null>(null)
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [selected, setSelected] = useState<WorkspaceSearchResult>()
  const [validationError, setValidationError] = useState<string>()
  const [mutationError, setMutationError] = useState<string>()
  const choice = choices[choiceIndex] ?? choices[0]
  const search = useQuery({
    ...searchQueryOptions(scope, submitted, [choice.targetKind]),
    enabled: open && submitted.length >= 3,
  })
  const group = search.data?.groups.find(
    (candidate) => candidate.kind === choice.targetKind
  )
  const existing = new Set(
    resource.links
      ?.filter(
        (link) =>
          link.relationship === choice.relationship &&
          link.resource_type === choice.targetKind
      )
      .map((link) => link.unique_id)
  )
  const results =
    group?.items.filter(
      (item) =>
        item.kind === choice.targetKind &&
        item.unique_id !== resource.unique_id &&
        !existing.has(item.unique_id)
    ) ?? []
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
    setSubmitted("")
    setSelected(undefined)
    setValidationError(undefined)
    setMutationError(undefined)
  }

  function changeOpen(nextOpen: boolean) {
    if (mutation.isPending) return
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = query.trim()
    if (nextQuery.length < 3) {
      setSubmitted("")
      setValidationError("Enter at least 3 characters.")
      return
    }
    setValidationError(undefined)
    setSelected(undefined)
    setMutationError(undefined)
    if (nextQuery === submitted) {
      void search.refetch()
    } else {
      setSubmitted(nextQuery)
    }
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
            <ResourceName>{resource.name}</ResourceName>, then search for it by
            name or MFID.
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
                setSubmitted("")
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
              {choiceDescription(resource, choice)}
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
          <form onSubmit={runSearch}>
            <FieldGroup className="sm:flex-row sm:items-end">
              <Field
                className="min-w-0 flex-1"
                data-invalid={Boolean(validationError)}
              >
                <FieldLabel htmlFor={inputId}>
                  Search {choice.targetKind}s
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(validationError) || undefined}
                  autoComplete="off"
                  disabled={mutation.isPending}
                  id={inputId}
                  minLength={3}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSubmitted("")
                    setSelected(undefined)
                    setValidationError(undefined)
                    setMutationError(undefined)
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
              <Button
                disabled={mutation.isPending}
                type="submit"
                variant="outline"
              >
                Search
              </Button>
            </FieldGroup>
          </form>
          {!submitted ? null : search.isPending || search.isPlaceholderData ? (
            <p className="text-body text-muted-foreground" role="status">
              Searching {choice.targetKind}s...
            </p>
          ) : search.isError || group?.error ? (
            <p className="text-body text-destructive" role="alert">
              {choice.targetKind === "sample" ? "Samples" : "Datasets"} could
              not be searched.
            </p>
          ) : results.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No available {choice.targetKind}s matched this search.
            </p>
          ) : (
            <ul aria-label={`${choice.targetKind} search results`}>
              {results.map((item) => (
                <li className="border-b last:border-0" key={item.unique_id}>
                  <Button
                    aria-pressed={selected?.unique_id === item.unique_id}
                    disabled={mutation.isPending}
                    onClick={() => {
                      setSelected(item)
                      setValidationError(undefined)
                      setMutationError(undefined)
                    }}
                    size="selection"
                    type="button"
                    variant={
                      selected?.unique_id === item.unique_id
                        ? "secondary"
                        : "ghost"
                    }
                  >
                    <ResourceTypeIcon
                      data-icon="inline-start"
                      type={item.kind}
                    />
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
            ) : (
              <AddRelationshipIcon
                aria-hidden="true"
                data-icon="inline-start"
              />
            )}
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
  const base = {
    action,
    relationship: link.relationship,
    scenario: fixtureScenarioFromScope(scope),
    sourceMfid: resource.unique_id,
    targetMfid: link.unique_id,
  }
  if (link.relationship === "associated") {
    return resource.kind === "sample"
      ? {
          ...base,
          relationship: "associated",
          sourceKind: "sample",
          targetKind: "dataset",
        }
      : {
          ...base,
          relationship: "associated",
          sourceKind: "dataset",
          targetKind: "sample",
        }
  }
  return resource.kind === "sample"
    ? {
        ...base,
        relationship: link.relationship,
        relationshipType: isWorkspaceRelationshipType(link.relationship_type)
          ? link.relationship_type
          : null,
        sourceKind: "sample",
        targetKind: "sample",
      }
    : {
        ...base,
        relationship: link.relationship,
        relationshipType: isWorkspaceRelationshipType(link.relationship_type)
          ? link.relationship_type
          : null,
        sourceKind: "dataset",
        targetKind: "dataset",
      }
}

function choiceDescription(
  resource: RelationshipResource,
  choice: RelationshipChoice
) {
  if (choice.relationship === "associated") {
    return `The ${choice.targetKind} and ${resource.kind} will be linked without a parent-child direction.`
  }
  return choice.relationship === "parent"
    ? `The selected ${choice.targetKind} will be a parent of this ${resource.kind}.`
    : `The selected ${choice.targetKind} will be a child of this ${resource.kind}.`
}

function LinkConfirmation({
  choice,
  relationshipType,
  resource,
  target,
}: {
  choice: RelationshipChoice
  relationshipType: WorkspaceRelationshipType | null
  resource: RelationshipResource
  target: WorkspaceSearchResult
}) {
  if (choice.relationship === "associated") {
    return (
      <>
        <ResourceName>{target.name}</ResourceName> will be linked with{" "}
        <ResourceName>{resource.name}</ResourceName>.
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
      of <ResourceName>{resource.name}</ResourceName>.
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
        <ResourceName>{resource.name}</ResourceName>.
      </>
    )
  }
  return (
    <>
      <ResourceName>{target}</ResourceName> will no longer be a{" "}
      {link.relationship} of <ResourceName>{resource.name}</ResourceName>.
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
