# 0026: Explore bounded resource graphs

Status: Accepted

Date: 2026-09-06

Extends [decision 0008](0008-inspect-linked-resources-in-place.md) and supersedes only its deferral of graph loading and graph rerooting.

## Context

Scientists need to understand and traverse the provenance around a sample or dataset without repeatedly abandoning the resource context. The existing relationship list is useful for direct neighbours but becomes harder to scan when several parent, child, and associated resources meet. TellingTree separates node inspection from rerooting, Lens groups immediate relationships, and established data catalogs give lineage a dedicated entity tab. Hub needs those interaction concepts in a desktop browser layout without copying another product or claiming that the current API supplies a complete pedigree.

The current API exposes `GET /entity_graph_cte/{entity_id}` but its OpenAPI response is untyped, its public path exposes an implementation detail, and its edges do not state relationship semantics. Unbounded recursive loading would give Hub no dependable depth, size, truncation, ordering, or performance contract.

## Decision

Add route-backed Graph tabs at `/samples/:sampleMfid/graph` and `/datasets/:datasetMfid/graph` beneath the existing persistent resource shell. The first slice requests only `recursive=false`, does not intent-preload graph data, and owns an independent identity-scoped Query representation. The server boundary validates the opaque response, requires the selected root, rejects duplicate or dangling nodes and edges, applies explicit node and edge limits, and returns a minimal browser-safe model.

The prototype temporarily interprets same-type edges as directed parent-child lineage and sample-to-dataset edges as undirected association. This inference is isolated in the server adapter and must be replaced by API-provided relationship semantics. The graph does not claim completeness and does not expose recursion, depth controls, or editing.

Cytoscape renders a deterministic semantic layout in a route-specific bundle. The selected resource remains centered, parents appear to its left, children to its right, associated samples above, and associated datasets below. Node type uses a consistent shape with distinct semantic color, while the current resource has a separate orange boundary and text label. Hovering a node emphasizes its immediate neighborhood. Selecting a related node opens the existing right-side overlay inspector above the unchanged graph. The inspector's existing Open action navigates to canonical detail, while Explore from here navigates to that resource's Graph route. A native relationship table follows the canvas and provides equivalent identity, type, relationship, inspection, and navigation behavior for keyboard and non-visual use. Relationship mutation remains on Overview under decision 0022.

The deterministic preset layout is appropriate for the current one-hop contract. A future bounded multi-hop graph may use `cytoscape-elk` with ELK Layered after the API supplies typed edge semantics, depth, limits, truncation, and stable identities. The API remains responsible for domain topology and authorization, while Hub remains responsible for coordinates, visual grouping, viewport behavior, and accessibility.

## Privacy and data boundaries

Graph routes expose only the root MFID in the canonical path and an optional inspected MFID in the existing preview search state. The API independently authorizes and filters every response. Graph results use the existing in-memory identity-scoped Query lifecycle and are not persisted, logged, or sent to analytics. This feature introduces no credential, cookie, personal-data, or third-party-host change.

## Consequences

- Scientists can switch between resource detail, graph traversal, and access management without replacing the Hub shell.
- The overlay inspector becomes the shared inspection mechanism for lists, relationship rows, and graph nodes.
- The graph library and its styles remain code-split from ordinary resource detail routes.
- Layout remains a Hub presentation concern and is not encoded in the API response.
- The accessible table is a first-class representation rather than a fallback generated from screen coordinates.
- Multi-hop traversal currently requires explicit rerooting and another bounded request.
- A typed, bounded, permission-aware API graph contract remains required before richer depth, filtering, completeness indicators, or graph editing.
- The detailed graph contract and ELK support requirements are recorded in [resource graph API handoff](../docs/resource-graph-api-handoff.md).

## Validation

- Verify direct entry, tab navigation, rerooting, browser history, preview close, canonical Open, refresh, and compact layouts.
- Verify graph loading does not occur before Graph route entry and mutations invalidate affected graph Queries.
- Verify malformed, oversized, duplicate, rootless, and dangling API responses fail locally without rendering partial authority.
- Verify every visible neighbour remains inspectable and navigable through the relationship table without graph interaction.
- Verify node type, root identity, and relationship semantics do not rely on color alone.
