# 0026: Explore bounded resource graphs

Status: Accepted

Date: 2026-09-06

Extends [decision 0008](0008-inspect-linked-resources-in-place.md) and supersedes only its deferral of graph loading and graph rerooting.

## Context

Scientists need to understand and traverse the provenance around a sample or dataset without repeatedly abandoning the resource context. The existing relationship list is useful for direct neighbours but becomes harder to scan when several parent, child, and associated resources meet. TellingTree separates node inspection from rerooting, Lens groups immediate relationships, and established data catalogs give lineage a dedicated entity tab. Hub needs those interaction concepts in a desktop browser layout without copying another product or claiming that the current API supplies a complete pedigree.

At the time of the initial decision, the API exposed `GET /entity_graph_cte/{entity_id}`, but its OpenAPI response was untyped, its public path exposed an implementation detail, and its edges did not state relationship semantics. Unbounded recursive loading would give Hub no dependable depth, size, truncation, ordering, or performance contract.

## Decision

Add route-backed Graph tabs at `/samples/:sampleMfid/graph` and `/datasets/:datasetMfid/graph` beneath the existing persistent resource shell. Graph data does not intent-preload and owns an independent identity-scoped Query representation. The server boundary calls `GET /resources/{resource_mfid}/graph`, validates the typed response, requires the selected root, rejects invalid bounds, duplicate or dangling identities, self-edges, and invalid relationship endpoints, and returns a bounded browser-safe model.

The Hub consumes API-provided lineage direction, undirected association semantics, stable edge identity, nullable relationship type, traversal depth, per-node expansion availability, and graph truncation metadata. Interactive reads default to depth one. At greater selected depths, the root request follows lineage only and is merged with a separate depth-one association request for the current resource. This keeps automatic multi-hop exploration within the scientific lineage while showing the current resource's direct sample-dataset associations. A node with additional or unknown readable topology can start another independently cached depth-one request that includes its direct lineage and associations, and the screen derives a merged graph by node MFID and edge ID. A rooted response is authoritative for that node's expansion completeness. The graph reports server truncation and does not expose editing or unlimited export.

Cytoscape with ELK Layered renders an automatically spaced lineage layout in a route-specific bundle. Directed edges flow from parent to child from left to right at wider widths and top to bottom on compact screens, while dashed undirected edges distinguish sample-dataset associations. The selected resource is centered on initial layout. Each node places the shared sample or dataset icon beside a name that may wrap to two lines, followed by sample type or measurement when the graph response provides it. Node type also uses a distinct semantic surface, while the current resource has a separate orange boundary. Hovering a node emphasizes its immediate neighborhood. Selecting a related node opens the existing right-side overlay inspector above the unchanged graph. Compact controls attached to expandable nodes load their immediate relationships and animate the updated ELK arrangement while preserving the focused resource's viewport position. The canvas also retains a menu for keyboard and compact access. The inspector's existing Open action navigates to canonical detail, while Explore from here navigates to that resource's Graph route. A native relationship table follows the canvas and provides equivalent identity, type, relationship, expansion, inspection, and navigation behavior for keyboard and non-visual use. Relationship mutation remains on Overview under decision 0022.

ELK calculates collision-free positions from the typed topology and reruns after bounded expansion. The Hub keeps existing node positions until the new arrangement is ready, animates supported updates, reports loading and arrangement states, and disables non-essential layout motion when the browser requests reduced motion. The API remains responsible for domain topology and authorization, while Hub remains responsible for coordinates, visual grouping, viewport behavior, and accessibility.

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
