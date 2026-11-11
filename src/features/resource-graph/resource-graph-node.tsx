import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import type { NodeProps } from "@xyflow/react"

import {
  GraphAncestorsIcon,
  GraphAncestorsVerticalIcon,
  GraphAssociationsIcon,
  GraphDescendantsIcon,
  GraphDescendantsVerticalIcon,
} from "@/components/crucible/icons"
import { BreakableText } from "@/components/crucible/breakable-text"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TruncatedText } from "@/components/ui/truncation-tooltip"
import type { WorkspaceResourceGraphNode } from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"

import { graphExpansionModeLabel } from "./resource-graph-expansion"
import type { GraphExpansionMode } from "./resource-graph-expansion"
import type {
  GraphNodeExpansion,
  ResourceFlowNode,
} from "./resource-graph-flow-model"
import type { LayoutDirection } from "./resource-graph-layout"

// React Flow positions the node's wrapper, so the node only needs its data.
const ResourceGraphNode = memo(function ResourceGraphNodeComponent({
  data,
}: NodeProps<ResourceFlowNode>) {
  return (
    <div
      className="resource-graph-flow-node"
      data-dimmed={data.dimmed ? "" : undefined}
      data-entering={data.entering ? "" : undefined}
      data-highlighted={data.highlighted ? "" : undefined}
      data-inspected={data.inspected ? "" : undefined}
      data-kind={data.node.kind}
      data-layout-direction={data.layoutDirection}
      data-root={data.isRoot ? "" : undefined}
      data-thumbnail={data.thumbnail ? "" : undefined}
    >
      <ResourceGraphNodeHandles layoutDirection={data.layoutDirection} />
      <div className="resource-graph-flow-node-content">
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                aria-hidden="true"
                className="resource-graph-flow-node-icon-badge"
              />
            }
          >
            <ResourceTypeIcon
              className="resource-graph-flow-node-icon"
              type={data.node.kind}
            />
          </TooltipTrigger>
          <TooltipContent portalContainer={data.portalContainer}>
            {data.isRoot ? `Current ${data.node.kind}` : data.node.kind}
          </TooltipContent>
        </Tooltip>
        <div className="resource-graph-flow-node-body">
          {data.isRoot ? (
            <span className="resource-graph-flow-node-eyebrow">Current</span>
          ) : null}
          <TruncatedText
            className="resource-graph-flow-node-name"
            label={data.node.name}
          >
            <BreakableText value={data.node.name} />
          </TruncatedText>
          {data.context ? (
            <TruncatedText className="resource-graph-flow-node-context">
              {data.context}
            </TruncatedText>
          ) : null}
        </div>
        {data.thumbnail ? (
          <DatasetThumbnailImage
            alt=""
            className="resource-graph-flow-node-thumbnail"
            decoding="async"
            loading="lazy"
            thumbnail={data.thumbnail}
          />
        ) : null}
      </div>
      {data.expansions.map((expansion) => (
        <GraphNodeExpansionAction
          expansion={expansion}
          key={expansion.mode}
          layoutDirection={data.layoutDirection}
          node={data.node}
          onExpand={data.onExpand}
          portalContainer={data.portalContainer}
        />
      ))}
    </div>
  )
}, sameNodeProps)

function sameNodeProps(
  previous: NodeProps<ResourceFlowNode>,
  next: NodeProps<ResourceFlowNode>
) {
  return previous.data === next.data
}

const ResourceGraphNodeHandles = memo(
  function ResourceGraphNodeHandlesComponent({
    layoutDirection,
  }: {
    layoutDirection: LayoutDirection
  }) {
    return (
      <>
        <Handle
          className="resource-graph-handle"
          id="lineage-target"
          position={layoutDirection === "DOWN" ? Position.Top : Position.Left}
          type="target"
        />
        <Handle
          className="resource-graph-handle"
          id="lineage-source"
          position={
            layoutDirection === "DOWN" ? Position.Bottom : Position.Right
          }
          type="source"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-source"
          id="association-source-top"
          position={Position.Top}
          type="source"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-source"
          id="association-source-right"
          position={Position.Right}
          type="source"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-source"
          id="association-source-bottom"
          position={Position.Bottom}
          type="source"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-source"
          id="association-source-left"
          position={Position.Left}
          type="source"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-target"
          id="association-target-top"
          position={Position.Top}
          type="target"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-target"
          id="association-target-right"
          position={Position.Right}
          type="target"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-target"
          id="association-target-bottom"
          position={Position.Bottom}
          type="target"
        />
        <Handle
          className="resource-graph-handle resource-graph-handle-association-target"
          id="association-target-left"
          position={Position.Left}
          type="target"
        />
      </>
    )
  }
)

export const nodeTypes = { resource: ResourceGraphNode }

function GraphNodeExpansionAction({
  expansion,
  layoutDirection,
  node,
  onExpand,
  portalContainer,
}: {
  expansion: GraphNodeExpansion
  layoutDirection: LayoutDirection
  node: WorkspaceResourceGraphNode
  onExpand: (nodeMfid: string, mode: GraphExpansionMode) => void
  portalContainer?: React.RefObject<HTMLDivElement | null>
}) {
  const { mode, status } = expansion
  const pending = status === "pending"
  const Icon = graphExpansionIcon(mode, layoutDirection)
  const modeLabel = graphExpansionModeLabel(mode).toLowerCase()
  const label =
    status === "error"
      ? `Retry loading ${modeLabel} from ${node.name}`
      : `Load ${modeLabel} from ${node.name}`
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            aria-label={label}
            className={cn(
              "nodrag nopan resource-graph-expansion-action",
              `resource-graph-expansion-${mode}`
            )}
            data-error={status === "error" ? "" : undefined}
            data-pending={pending ? "" : undefined}
            onClick={(event) => {
              event.stopPropagation()
              if (!pending) onExpand(node.unique_id, mode)
            }}
            size="icon-circle"
            type="button"
            variant={status === "error" ? "destructive" : "outline"}
          />
        }
      >
        {pending ? <PendingIcon /> : <Icon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent portalContainer={portalContainer}>{label}</TooltipContent>
    </Tooltip>
  )
}

function graphExpansionIcon(
  mode: GraphExpansionMode,
  layoutDirection: LayoutDirection
) {
  if (layoutDirection === "DOWN") {
    if (mode === "ancestors") return GraphAncestorsVerticalIcon
    if (mode === "descendants") return GraphDescendantsVerticalIcon
  }
  if (mode === "ancestors") return GraphAncestorsIcon
  if (mode === "descendants") return GraphDescendantsIcon
  return GraphAssociationsIcon
}
