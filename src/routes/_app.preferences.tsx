import { useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import { createFileRoute, notFound } from "@tanstack/react-router"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  globalDatasetBrowseOptions,
  globalSampleBrowseOptions,
} from "@/data/crucible/collection-browse"
import type { CollectionBrowseOption } from "@/data/crucible/collection-browse"
import { defaultCollectionOrdering } from "@/data/crucible/collection-query"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import type { DirectorySortField } from "@/data/crucible/preferences"
import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import { recentScopeOptions } from "@/features/home/home-data"
import { useThemePreference } from "@/features/preferences/theme-preference"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"
import { useClearRecentHistory } from "@/features/recently-viewed/recently-viewed"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

const themeOptions = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const

const recordKindOptions = [
  { label: "Samples", value: "samples" },
  { label: "Datasets", value: "datasets" },
] as const

const dataSortOptions = [
  { defaultDirection: "desc", label: "Created", value: "created" },
  { defaultDirection: "desc", label: "Updated", value: "updated" },
  { defaultDirection: "asc", label: "Name", value: "name" },
] as const satisfies readonly {
  defaultDirection: SortDirection
  label: string
  value: ResourceSort
}[]

const directorySortOptions = [
  { defaultDirection: "asc", label: "Name", value: "name" },
  { defaultDirection: "desc", label: "Created", value: "created" },
  { defaultDirection: "desc", label: "Updated", value: "updated" },
  { defaultDirection: "desc", label: "Last activity", value: "activity" },
] as const satisfies readonly {
  defaultDirection: SortDirection
  label: string
  value: DirectorySortField
}[]

const defaultDirectoryOrdering = {
  direction: "asc",
  sort: "name",
} as const satisfies {
  direction: SortDirection
  sort: DirectorySortField
}

export const Route = createFileRoute("/_app/preferences")({
  head: () => ({ meta: [{ title: "Preferences | Crucible Hub" }] }),
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (source?.status !== "ready" || !source.accountPreferencesEnabled) {
      throw notFound()
    }
    await context.queryClient.ensureQueryData(
      accountPreferencesQueryOptions(source.scope)
    )
  },
  component: PreferencesPage,
})

function PreferenceField({
  children,
  description,
  id,
  title,
}: {
  children: React.ReactNode
  description?: string
  id?: string
  title: string
}) {
  return (
    <Field orientation="responsive">
      <FieldContent>
        {id ? (
          <FieldLabel htmlFor={id}>{title}</FieldLabel>
        ) : (
          <FieldTitle>{title}</FieldTitle>
        )}
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </FieldContent>
      <div>{children}</div>
    </Field>
  )
}

function GroupingSelect<TField extends string>({
  id,
  onChange,
  options,
  value,
}: {
  id: string
  onChange: (value: TField | null) => void
  options: readonly CollectionBrowseOption<TField>[]
  value: TField | undefined
}) {
  return (
    <NativeSelect
      id={id}
      onChange={(event) =>
        onChange(
          options.find((option) => option.value === event.target.value)
            ?.value ?? null
        )
      }
      value={value ?? ""}
    >
      <NativeSelectOption value="">None (flat list)</NativeSelectOption>
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

function DefaultSortSelect<TSort extends string>({
  defaultOrdering,
  idPrefix,
  label,
  onChange,
  options,
  value,
}: {
  defaultOrdering: { direction: SortDirection; sort: TSort }
  idPrefix: string
  label: string
  onChange: (value: { direction: SortDirection; sort: TSort } | null) => void
  options: readonly {
    defaultDirection: SortDirection
    label: string
    value: TSort
  }[]
  value: { direction: SortDirection; sort: TSort } | undefined
}) {
  const activeSort = value?.sort ?? defaultOrdering.sort
  const activeDirection = value?.direction ?? defaultOrdering.direction
  const applyValue = (next: { direction: SortDirection; sort: TSort }) => {
    if (
      next.sort === defaultOrdering.sort &&
      next.direction === defaultOrdering.direction
    ) {
      onChange(null)
      return
    }
    onChange(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        id={`${idPrefix}-sort`}
        onChange={(event) => {
          const matched = options.find(
            (option) => option.value === event.target.value
          )
          if (!matched) return
          applyValue({
            direction: value?.direction ?? matched.defaultDirection,
            sort: matched.value,
          })
        }}
        value={activeSort}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label={`${label} direction`}
        id={`${idPrefix}-direction`}
        onChange={(event) => {
          const direction = event.target.value === "asc" ? "asc" : "desc"
          applyValue({ direction, sort: activeSort })
        }}
        value={activeDirection}
      >
        <NativeSelectOption value="asc">Ascending</NativeSelectOption>
        <NativeSelectOption value="desc">Descending</NativeSelectOption>
      </NativeSelect>
    </div>
  )
}

function PreferencesPage() {
  const scope = useWorkspaceScope()
  useSuspenseQuery(accountPreferencesQueryOptions(scope))
  const { preferences, saving, update } = useAccountPreferences()
  const { setTheme, theme } = useThemePreference()
  const [clearOpen, setClearOpen] = useState(false)
  const clearHistory = useClearRecentHistory(() => setClearOpen(false))

  return (
    <PageLayout>
      <PageHeader
        description="Saved to your Crucible account and applied wherever you sign in."
        title="Preferences"
      />
      <ContentBoundary width="reading">
        <Card>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Appearance</FieldLegend>
                <PreferenceField
                  description="System follows your device setting."
                  title="Theme"
                >
                  <SegmentedControl
                    ariaLabel="Theme"
                    onValueChange={setTheme}
                    options={themeOptions}
                    value={preferences.theme ?? theme}
                  />
                </PreferenceField>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldLegend>Data</FieldLegend>
                <PreferenceField
                  description="The Data page opens on this record type."
                  title="Default data view"
                >
                  <SegmentedControl
                    ariaLabel="Default data view"
                    onValueChange={(value) =>
                      update({ default_record_kind: value })
                    }
                    options={recordKindOptions}
                    value={preferences.default_record_kind ?? "samples"}
                  />
                </PreferenceField>
                <PreferenceField
                  description="Sample and dataset lists and search start with public data included."
                  id="include-public-data"
                  title="Include public data"
                >
                  <Switch
                    checked={preferences.hub?.include_public_data === true}
                    id="include-public-data"
                    onCheckedChange={(checked) =>
                      update({ hub: { include_public_data: checked } })
                    }
                  />
                </PreferenceField>
                <PreferenceField
                  description="Sample and dataset lists on the Data page, in projects, and on instruments open in this order."
                  id="preferred-data-sort-sort"
                  title="Default data sort"
                >
                  <DefaultSortSelect
                    defaultOrdering={defaultCollectionOrdering}
                    idPrefix="preferred-data-sort"
                    label="Default data sort"
                    onChange={(value) =>
                      update({ hub: { default_sort: { data: value } } })
                    }
                    options={dataSortOptions}
                    value={preferences.hub?.default_sort?.data}
                  />
                </PreferenceField>
                <PreferenceField
                  description="Sample lists on the Data page and in projects open grouped by this field instead of as a flat list."
                  id="preferred-sample-grouping"
                  title="Group samples by"
                >
                  <GroupingSelect
                    id="preferred-sample-grouping"
                    onChange={(value) =>
                      update({ hub: { data_group_by: { samples: value } } })
                    }
                    options={globalSampleBrowseOptions}
                    value={preferences.hub?.data_group_by?.samples}
                  />
                </PreferenceField>
                <PreferenceField
                  description="Dataset lists on the Data page, in projects, and on instruments open grouped by this field. Lists that do not offer the field stay flat."
                  id="preferred-dataset-grouping"
                  title="Group datasets by"
                >
                  <GroupingSelect
                    id="preferred-dataset-grouping"
                    onChange={(value) =>
                      update({ hub: { data_group_by: { datasets: value } } })
                    }
                    options={globalDatasetBrowseOptions}
                    value={preferences.hub?.data_group_by?.datasets}
                  />
                </PreferenceField>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldLegend>Directories</FieldLegend>
                <PreferenceField
                  id="preferred-project-sort-sort"
                  title="Default project sort"
                >
                  <DefaultSortSelect
                    defaultOrdering={defaultDirectoryOrdering}
                    idPrefix="preferred-project-sort"
                    label="Default project sort"
                    onChange={(value) =>
                      update({ hub: { default_sort: { projects: value } } })
                    }
                    options={directorySortOptions}
                    value={preferences.hub?.default_sort?.projects}
                  />
                </PreferenceField>
                <PreferenceField
                  id="preferred-instrument-sort-sort"
                  title="Default instrument sort"
                >
                  <DefaultSortSelect
                    defaultOrdering={defaultDirectoryOrdering}
                    idPrefix="preferred-instrument-sort"
                    label="Default instrument sort"
                    onChange={(value) =>
                      update({ hub: { default_sort: { instruments: value } } })
                    }
                    options={directorySortOptions}
                    value={preferences.hub?.default_sort?.instruments}
                  />
                </PreferenceField>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldLegend>History</FieldLegend>
                <PreferenceField
                  description="Keep a list of the samples, datasets, projects, and instruments you open, shown in the sidebar and on Home on every device."
                  id="record-recent-resources"
                  title="Remember recently viewed resources"
                >
                  <Switch
                    checked={preferences.record_recent_resources !== false}
                    id="record-recent-resources"
                    onCheckedChange={(checked) =>
                      update({ record_recent_resources: checked })
                    }
                  />
                </PreferenceField>
                <PreferenceField title="Clear history">
                  <Button
                    onClick={() => setClearOpen(true)}
                    type="button"
                    variant="outline"
                  >
                    Clear history
                  </Button>
                </PreferenceField>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldLegend>Home</FieldLegend>
                <PreferenceField
                  description="Show recently added data from everyone you can see, or only your own."
                  title="Recently added data"
                >
                  <SegmentedControl
                    ariaLabel="Recently added data"
                    onValueChange={(value) =>
                      update({ hub: { home_recent_scope: value } })
                    }
                    options={recentScopeOptions}
                    value={preferences.hub?.home_recent_scope ?? "all"}
                  />
                </PreferenceField>
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>
        <p
          aria-live="polite"
          className="mt-3 flex min-h-5 items-center gap-1.5 text-supporting text-muted-foreground"
          role="status"
        >
          {saving ? (
            <>
              <PendingIcon />
              Saving…
            </>
          ) : null}
        </p>
      </ContentBoundary>
      <ConfirmationDialog
        confirmLabel="Clear history"
        description="Your recently viewed list will be empty on every device. Resources themselves are not affected."
        kind="alert"
        onConfirm={() => clearHistory.mutate()}
        onOpenChange={setClearOpen}
        open={clearOpen}
        pending={clearHistory.isPending}
        pendingLabel="Clearing history"
        title="Clear recently viewed history?"
        variant="destructive"
      />
    </PageLayout>
  )
}
