import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import {
  CollectionFilterPanel,
  collectionActiveFilter,
  collectionActiveFilters,
} from "@/components/crucible/collection-filter-panel"
import { ResourceChooser } from "@/components/crucible/resource-chooser"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  publicDataFilterState,
  publicDataSearchValue,
} from "@/data/crucible/public-data"
import type {
  PublicDataAccess,
  PublicDataChoice,
} from "@/data/crucible/public-data"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"

import { searchFilterAvailability } from "./search-filter-state"
import type { SearchTab } from "./search-filter-state"

type SearchFilterDraft = {
  affiliation?: "owner"
  projectMfid?: string
  publicData?: PublicDataChoice
}

export function SearchFilters({
  access,
  projectName,
  tab,
  values,
}: {
  access: PublicDataAccess
  projectName?: string
  tab: SearchTab
  values: SearchFilterDraft
}) {
  const navigate = useNavigate({ from: "/search" })
  const availability = searchFilterAvailability(tab)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SearchFilterDraft>(values)
  const [draftProjectName, setDraftProjectName] = useState<string>()
  const valuesKey = JSON.stringify(values)

  useEffect(() => {
    setDraft(JSON.parse(valuesKey) as SearchFilterDraft)
    setDraftProjectName(undefined)
  }, [valuesKey])

  if (!availability.ownership) return null

  const publicState = publicDataFilterState({
    ...access,
    ownership: values.affiliation,
    publicData: values.publicData,
  })
  const draftPublicState = publicDataFilterState({
    ...access,
    ownership: draft.affiliation,
    publicData: draft.publicData,
  })
  const active = collectionActiveFilters(
    collectionActiveFilter(
      "public",
      availability.publicData && publicState.included ? "Public" : undefined
    ),
    collectionActiveFilter(
      "affiliation",
      values.affiliation ? "Ownership: Owned by me" : undefined
    ),
    collectionActiveFilter(
      "project",
      availability.project && values.projectMfid
        ? `Project: ${projectName ?? values.projectMfid}`
        : undefined
    )
  )
  const selectedProject: WorkspaceSearchResult | undefined = draft.projectMfid
    ? {
        context: null,
        kind: "project",
        name:
          draftProjectName ??
          (draft.projectMfid === values.projectMfid
            ? projectName
            : undefined) ??
          draft.projectMfid,
        unique_id: draft.projectMfid,
      }
    : undefined

  function update(changes: SearchFilterDraft) {
    void navigate({
      search: (previous) => {
        const projectMfid =
          "projectMfid" in changes ? changes.projectMfid : previous.projectMfid
        return {
          ...previous,
          ...changes,
          ...(projectMfid
            ? {
                kind:
                  previous.kind === "sample" || previous.kind === "dataset"
                    ? previous.kind
                    : undefined,
                mode: undefined,
              }
            : {}),
        }
      },
      to: "/search",
    })
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    update({
      affiliation: draft.affiliation,
      ...(availability.project ? { projectMfid: draft.projectMfid } : {}),
      publicData: draft.publicData,
    })
  }

  function clear() {
    setOpen(false)
    update({
      affiliation: undefined,
      projectMfid: undefined,
      publicData: undefined,
    })
  }

  function removeFilter(id: string) {
    if (id === "public") {
      update({
        publicData: publicDataSearchValue(false, access.includePublicByDefault),
      })
    } else if (id === "affiliation") {
      update({ affiliation: undefined })
    } else if (id === "project") {
      update({ projectMfid: undefined })
    }
  }

  return (
    <CollectionFilterPanel
      activeFilters={active}
      footer={
        <>
          <Button onClick={clear} type="button" variant="outline">
            Clear filters
          </Button>
          <Button form="search-filters" type="submit">
            Apply filters
          </Button>
        </>
      }
      onClearFilters={clear}
      onOpenChange={setOpen}
      onRemoveFilter={removeFilter}
      open={open}
      title="Search filters"
    >
      <form
        className="flex flex-col gap-4"
        id="search-filters"
        onSubmit={apply}
      >
        <FieldSet>
          <FieldLegend className="sr-only">Search filters</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {availability.publicData && draftPublicState.available ? (
              <Field className="sm:col-span-2" orientation="horizontal">
                <Checkbox
                  checked={draftPublicState.included}
                  disabled={!draftPublicState.enabled}
                  id="search-public"
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      publicData: publicDataSearchValue(
                        checked,
                        access.includePublicByDefault
                      ),
                    }))
                  }
                />
                <FieldLabel htmlFor="search-public">
                  Include public data
                </FieldLabel>
              </Field>
            ) : null}
            {availability.project ? (
              <Field>
                <FieldLabel htmlFor="search-project-trigger">
                  Project
                </FieldLabel>
                <ResourceChooser
                  kind="project"
                  onChange={(project) => {
                    setDraft((current) => ({
                      ...current,
                      projectMfid: project?.unique_id,
                    }))
                    setDraftProjectName(project?.name)
                  }}
                  triggerId="search-project-trigger"
                  value={selectedProject}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="search-affiliation">Ownership</FieldLabel>
              <NativeSelect
                className="w-full"
                id="search-affiliation"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    affiliation:
                      event.target.value === "owner" ? "owner" : undefined,
                  }))
                }
                value={draft.affiliation ?? ""}
              >
                <NativeSelectOption value="">All accessible</NativeSelectOption>
                <NativeSelectOption value="owner">
                  Owned by me
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>
    </CollectionFilterPanel>
  )
}
