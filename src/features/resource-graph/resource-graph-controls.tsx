import type { ReactNode, RefObject } from "react"

import {
  EnterGraphFullscreenIcon,
  ExitGraphFullscreenIcon,
  ExploreGraphFocusIcon,
  FilterIcon,
  FitGraphIcon,
  GraphAncestorsIcon,
  GraphAncestorsVerticalIcon,
  GraphAssociationsIcon,
  GraphDescendantsIcon,
  GraphDescendantsVerticalIcon,
  GraphDisplayOptionsIcon,
  RemoveFilterIcon,
  ResetGraphLayoutIcon,
  ZoomInGraphIcon,
  ZoomOutGraphIcon,
} from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  activeGraphFilterCount,
  graphLineageTypes,
} from "./resource-graph-display"
import type {
  GraphHiddenValue,
  GraphLineageType,
  GraphResourceKind,
  ResourceGraphDisplay,
} from "./resource-graph-display"

type PortalContainer = RefObject<HTMLDivElement | null> | undefined

const resourceKindOptions: {
  label: string
  legend: string
  value: GraphResourceKind
}[] = [
  { label: "Samples", legend: "Sample", value: "sample" },
  { label: "Datasets", legend: "Dataset", value: "dataset" },
]

const lineageTypeOptions: { label: string; value: GraphLineageType }[] = [
  { label: "Derived from", value: "is_derived_from" },
  { label: "Part of", value: "is_part_of" },
  { label: "Unspecified lineage", value: "unspecified" },
]

function GraphControl({
  children,
  label,
  onClick,
  portalContainer,
  pressed,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  portalContainer: PortalContainer
  pressed?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="outline"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent portalContainer={portalContainer}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** What the graph shows: resource kinds and relationship kinds. */
export function GraphFilterMenu({
  display,
  onDisplayChange,
  portalContainer,
}: {
  display: ResourceGraphDisplay
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  portalContainer: PortalContainer
}) {
  const active = activeGraphFilterCount(display)
  const shown = (value: GraphHiddenValue) => !display.hidden.includes(value)
  const toggle = (value: GraphHiddenValue, visible: boolean) =>
    onDisplayChange({
      hidden: visible
        ? display.hidden.filter((candidate) => candidate !== value)
        : [...display.hidden, value],
    })

  return (
    <div className="resource-graph-controls absolute top-3 left-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={active ? `Filters, ${active} active` : "Filters"}
              size="sm"
              type="button"
              variant="outline"
            />
          }
        >
          <FilterIcon aria-hidden="true" data-icon="inline-start" />
          Filters
          {active ? <Badge variant="secondary">{active}</Badge> : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-52"
          portalContainer={portalContainer}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Resources</DropdownMenuLabel>
            {resourceKindOptions.map((option) => (
              <DropdownMenuCheckboxItem
                checked={shown(option.value)}
                key={option.value}
                onCheckedChange={(checked) => toggle(option.value, checked)}
              >
                <ResourceTypeIcon type={option.value} />
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Relationships</DropdownMenuLabel>
            {lineageTypeOptions.map((option) => (
              <DropdownMenuCheckboxItem
                checked={shown(option.value)}
                key={option.value}
                onCheckedChange={(checked) => toggle(option.value, checked)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuCheckboxItem
              checked={display.associations}
              onCheckedChange={(checked) =>
                onDisplayChange({ associations: checked })
              }
            >
              Associations
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          {active ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() =>
                    onDisplayChange({ associations: true, hidden: [] })
                  }
                >
                  <RemoveFilterIcon aria-hidden="true" />
                  Show everything
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** How the graph is viewed: navigation, display options and fullscreen. */
export function GraphViewToolbar({
  display,
  fullscreen,
  onCenter,
  onDisplayChange,
  onFit,
  onResetLayout,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  portalContainer,
}: {
  display: ResourceGraphDisplay
  fullscreen: boolean
  onCenter: () => void
  onDisplayChange: (changes: Partial<ResourceGraphDisplay>) => void
  onFit: () => void
  onResetLayout: () => void
  onToggleFullscreen: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  portalContainer: PortalContainer
}) {
  return (
    <div className="resource-graph-controls absolute top-3 right-3 flex gap-2">
      <ButtonGroup aria-label="Graph navigation">
        <GraphControl
          label="Zoom out"
          onClick={onZoomOut}
          portalContainer={portalContainer}
        >
          <ZoomOutGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Zoom in"
          onClick={onZoomIn}
          portalContainer={portalContainer}
        >
          <ZoomInGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Fit all resources"
          onClick={onFit}
          portalContainer={portalContainer}
        >
          <FitGraphIcon aria-hidden="true" />
        </GraphControl>
        <GraphControl
          label="Center current resource"
          onClick={onCenter}
          portalContainer={portalContainer}
        >
          <ExploreGraphFocusIcon aria-hidden="true" />
        </GraphControl>
      </ButtonGroup>
      <ButtonGroup aria-label="Graph view">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label="Display options"
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    />
                  }
                />
              }
            >
              <GraphDisplayOptionsIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent portalContainer={portalContainer}>
              Display options
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            className="min-w-48"
            portalContainer={portalContainer}
          >
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                if (value === "horizontal" || value === "vertical") {
                  onDisplayChange({ orientation: value })
                }
              }}
              value={display.orientation}
            >
              <DropdownMenuLabel>Direction</DropdownMenuLabel>
              <DropdownMenuRadioItem value="vertical">
                Top to bottom
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="horizontal">
                Left to right
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem
                checked={display.thumbnails}
                onCheckedChange={(checked) =>
                  onDisplayChange({ thumbnails: checked })
                }
              >
                Dataset thumbnails
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onResetLayout}>
                <ResetGraphLayoutIcon aria-hidden="true" />
                Reset graph
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <GraphControl
          label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={onToggleFullscreen}
          portalContainer={portalContainer}
          pressed={fullscreen}
        >
          {fullscreen ? (
            <ExitGraphFullscreenIcon aria-hidden="true" />
          ) : (
            <EnterGraphFullscreenIcon aria-hidden="true" />
          )}
        </GraphControl>
      </ButtonGroup>
    </div>
  )
}

export function ResourceGraphLegend({
  display,
  expandable,
  hiddenCount,
}: {
  display: ResourceGraphDisplay
  expandable: boolean
  hiddenCount: number
}) {
  const vertical = display.orientation === "vertical"
  const AncestorsIcon = vertical
    ? GraphAncestorsVerticalIcon
    : GraphAncestorsIcon
  const DescendantsIcon = vertical
    ? GraphDescendantsVerticalIcon
    : GraphDescendantsIcon
  const lineageShown = !graphLineageTypes.every((value) =>
    display.hidden.includes(value)
  )
  return (
    <div
      aria-label="Graph legend"
      className="resource-graph-legend absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-supporting text-muted-foreground"
    >
      {resourceKindOptions
        .filter((option) => !display.hidden.includes(option.value))
        .map((option) => (
          <span className="flex items-center gap-1.5" key={option.value}>
            <ResourceTypeIcon type={option.value} />
            {option.legend}
          </span>
        ))}
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="resource-graph-legend-current" />
        Current
      </span>
      {lineageShown ? (
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="resource-graph-legend-edge resource-graph-legend-edge-lineage"
          />
          Lineage
        </span>
      ) : null}
      {display.associations ? (
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="resource-graph-legend-edge resource-graph-legend-edge-associated"
          />
          Associated
        </span>
      ) : null}
      {expandable ? (
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="flex items-center">
            <AncestorsIcon className="size-3.5" />
            <DescendantsIcon className="size-3.5" />
            <GraphAssociationsIcon className="size-3.5" />
          </span>
          Load more
        </span>
      ) : null}
      {hiddenCount > 0 ? (
        <span className="flex items-center gap-1.5 text-foreground">
          <FilterIcon aria-hidden="true" className="size-3.5" />
          {hiddenCount} hidden by filters
        </span>
      ) : null}
    </div>
  )
}
