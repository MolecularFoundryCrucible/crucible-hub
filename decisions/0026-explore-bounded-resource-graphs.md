# 0026: Explore bounded resource graphs

Status: Accepted

Date: 2026-09-06

Extends [decision 0008](0008-inspect-linked-resources-in-place.md) and supersedes only its deferral of graph loading and graph rerooting.

## Context

Scientists need to understand and traverse the provenance around a sample or dataset without repeatedly abandoning the resource context. The existing relationship list is useful for direct neighbours but becomes harder to scan when several parent, child, and associated resources meet. TellingTree separates node inspection from rerooting, Lens groups immediate relationships, and established data catalogs give lineage a dedicated entity tab. Hub needs those interaction concepts in a desktop browser layout without copying another product or claiming that the current API supplies a complete pedigree.

At the time of the initial decision, the API exposed `GET /entity_graph_cte/{entity_id}`, but its OpenAPI response was untyped, its public path exposed an implementation detail, and its edges did not state relationship semantics. Unbounded recursive loading would give Hub no dependable depth, size, truncation, ordering, or performance contract.

## Decision

Add route-backed Graph tabs at `/samples/:sampleMfid/graph` and `/datasets/:datasetMfid/graph` beneath the existing persistent resource shell. Graph data does not intent-preload and owns an independent identity-scoped Query representation. The server boundary calls `GET /resources/{resource_mfid}/graph`, validates the typed response, requires the selected root, rejects invalid bounds, duplicate or dangling identities, self-edges, and invalid relationship endpoints, and returns a bounded browser-safe model.

The Hub consumes API-provided lineage direction, undirected association semantics, stable edge identity, nullable relationship type, traversal depth, per-node expansion availability, and graph truncation metadata. Interactive reads use separate depth-three upstream-lineage and downstream-lineage requests and merge a separate depth-one association request for the current resource. Separating upstream and downstream traversal prevents direction changes within one recursive request, so following ancestors does not automatically include the other descendants of those ancestors. This keeps automatic multi-hop exploration within direct ancestor and descendant paths while showing the current resource's direct sample-dataset associations. A node with confirmed additional readable topology directly exposes independently cached depth-one requests for upstream lineage, downstream lineage, or associations, and the screen derives a merged graph by node MFID and edge ID. Completion remains specific to the selected direction and relationship-kind filters. Confirmed complete nodes and successfully checked directions do not offer their corresponding expansion actions. The graph reports server truncation and does not expose relationship editing or unlimited export.

React Flow renders an automatically spaced ELK Layered lineage layout in a route-specific bundle, with ELK computation isolated in a browser worker. Directed edges flow from parent to child from left to right at wider widths and top to bottom on compact screens, while dashed undirected edges distinguish sample-dataset associations. The selected resource is centered on initial layout. Each node places the shared sample or dataset icon beside a name that may wrap to two lines, followed by sample type or measurement when the graph response provides it. Node type also uses a distinct semantic surface, while the current resource has a separate orange boundary. Hovering a node emphasizes its immediate neighborhood without rebuilding the graph. Selecting a related node opens the existing right-side overlay inspector above the unchanged graph. Nodes can be repositioned temporarily through React Flow dragging. Reset layout reruns ELK and recenters the selected resource, while fullscreen uses the browser's native fullscreen surface. Compact React controls attached to the left, right, and bottom edges of expandable nodes load ancestors, descendants, or associations and animate the updated ELK arrangement while preserving the focused resource's viewport position. Keeping these controls inside the node component prevents viewport tracking lag. The inspector's existing Open action navigates to canonical detail, while Explore from here navigates to that resource's Graph route. A native relationship table follows the graph and provides equivalent identity, type, relationship, expansion, inspection, and navigation behavior for keyboard and non-visual use. Large relationship results render incrementally and request bounded thumbnail previews only when the table nears the viewport. Relationship mutation remains on Overview under decision 0022.

ELK calculates collision-free positions from the typed topology after the initial bounded reads settle and reruns after bounded expansion. The Hub keeps existing node positions until the worker returns the new arrangement, animates supported updates, reports loading and arrangement states, and disables non-essential layout motion when the browser requests reduced motion. The API remains responsible for domain topology and authorization, while Hub remains responsible for coordinates, visual grouping, viewport behavior, and accessibility.

## Privacy and data boundaries

Graph routes expose only the root MFID in the canonical path and an optional inspected MFID in the existing preview search state. The API independently authorizes and filters every response. Graph results use the existing in-memory identity-scoped Query lifecycle and are not persisted, logged, or sent to analytics. This feature introduces no credential, cookie, personal-data, or third-party-host change.

## Consequences

- Scientists can switch between resource detail, graph traversal, and access management without replacing the Hub shell.
- The overlay inspector becomes the shared inspection mechanism for lists, relationship rows, and graph nodes.
- The graph library and its styles remain code-split from ordinary resource detail routes.
- Layout remains a Hub presentation concern and is not encoded in the API response.
- The accessible table is a first-class representation rather than a fallback generated from screen coordinates.
- Automatic multi-hop traversal follows lineage, while associations beyond the current resource require explicit bounded expansion.
- Direction and relationship filtering are represented in Query identity and the server boundary but do not yet have visible controls.
- The detailed graph contract and ELK integration boundary are recorded in [resource graph API handoff](../docs/resource-graph-api-handoff.md).

## Validation

- Verify direct entry, tab navigation, rerooting, browser history, preview close, canonical Open, refresh, and compact layouts.
- Verify graph loading does not occur before Graph route entry and mutations invalidate affected graph Queries.
- Verify malformed, oversized, duplicate, rootless, dangling, semantically invalid, and inconsistent-bound API responses fail locally without rendering partial authority.
- Verify expansion retries locally, merges nodes and edges without duplication, preserves rooted completeness, and reports truncation.
- Verify every visible neighbour remains inspectable and navigable through the relationship table without graph interaction.
- Verify node type, root identity, and relationship semantics do not rely on color alone.
