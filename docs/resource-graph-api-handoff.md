# Resource graph API handoff

Status: Implemented API contract and Hub integration

Date: 2026-09-18

## Purpose

This document records the typed API boundary used for dependable bounded resource graphs in Crucible Hub. The Hub starts with the selected sample or dataset and its immediate readable relationships, then can merge explicit depth-one expansions without requesting resource details. React Flow with ELK Layered calculates collision-free positions in the browser, while the implemented typed response supplies relationship semantics, direction, completeness, and truncation facts. The Hub does not require API-generated coordinates.

## Implemented boundary

API revision `a74d3922e0d093878c35666852ff0099e79b2912` provides `GET /resources/{resource_mfid}/graph` with per-node expansion availability, and the Hub pins its checked-in OpenAPI artifact. The Hub validates the generated response at its server boundary and consumes API-provided node types, stable edge identities, relationship meaning, direction, traversal depth, completeness, limits, sample type, dataset measurement, and compact project and instrument references.

The Hub defaults interactive reads to separate depth-three upstream and downstream lineage requests merged with depth-one associations rooted at the selected resource. The separate lineage requests prevent a traversal from changing direction after reaching an ancestor or descendant, so sibling branches remain excluded until explicit expansion. Each node's required `expansion_availability` object determines whether the Hub offers upstream lineage, downstream lineage, or association expansion. Expansion starts a separate depth-one request for the selected channel, then merges results by node MFID and edge ID. Each filtered request has independent Query identity and completion state, and a successful request removes that channel from the corresponding node's actions. The compatibility field `has_more_relationships` remains scoped to the request direction and filters. The Hub reports truncation and never implies unlimited export.

## Operation

The canonical resource graph read is:

```http
GET /resources/{resource_mfid}/graph
```

The operation accepts:

- `depth=0..3`, defaulting to one.
- `direction=both|upstream|downstream` for lineage traversal.
- Repeatable `relationship_kind=lineage|association` filtering.
- Repeatable `relationship_type=is_derived_from|is_part_of|unspecified` filtering for lineage edges.
- Documented server-owned node and edge limits.

The route identifier is a canonical sample or dataset MFID. Slugs and internal database IDs are not graph identities.

`depth=0` returns only the root. `depth=1` returns the root and its immediate readable neighbours. Every selected edge consumes one depth. Direction applies only to lineage, while associations remain undirected and can be traversed from either endpoint.

## Typed response

The OpenAPI response provides:

```json
{
  "root_mfid": "...",
  "nodes": [
    {
      "mfid": "...",
      "resource_type": "sample",
      "name": "Example sample",
      "sample_type": "powder",
      "project": {
        "unique_id": "...",
        "project_id": "example-project",
        "title": "Example project"
      },
      "traversal_depth": 0,
      "expansion_availability": {
        "upstream_lineage": false,
        "downstream_lineage": true,
        "associations": false
      },
      "has_more_relationships": false
    }
  ],
  "edges": [
    {
      "id": "...",
      "source_mfid": "...",
      "target_mfid": "...",
      "kind": "lineage",
      "directed": true,
      "relationship_type": null
    }
  ],
  "requested_depth": 2,
  "returned_depth": 2,
  "has_more": false,
  "truncated": false,
  "truncation_reasons": [],
  "node_limit": 500,
  "edge_limit": 1000
}
```

Required node fields are stable MFID, resource type, nullable display name, traversal depth, nullable request-scoped completeness, expansion availability, nullable compact project identity, and the resource-specific nullable context field: `sample_type` for a sample or `measurement` for a dataset. Dataset nodes also provide nullable data format and compact instrument identity. These fields let Hub render the standard graph node without issuing one detail request per node. A missing optional display value is represented as `null`, not by omitting the node.

Required edge fields are a stable edge identity or a documented stable composite identity, source MFID, target MFID, typed relationship kind, and explicit direction. Persisted relationship labels or types should be returned directly rather than reconstructed by Hub.

## Relationship semantics

- A lineage edge always uses the parent as `source_mfid` and the child as `target_mfid`.
- An association is explicitly undirected. If the transport schema still requires source and target, use a documented canonical ordering such as sample first and dataset second.
- The API returns one node for each MFID and one edge for each authorized relationship. Responses contain no duplicate nodes, duplicate edges, self-edges unless explicitly supported, or edges whose endpoints are absent.
- The root is always present and exactly matches the requested MFID.
- Response ordering is deterministic with a stable MFID tie-breaker, but does not encode screen coordinates or a particular layout engine.

## Authorization and privacy

The API authorizes the root and every returned node and edge. It omits relationships whose other endpoint is unreadable without revealing that endpoint's identity, label, type, or count.

Completeness metadata describes configured traversal boundaries, readable topology, and server limits only. It does not reveal that hidden nodes or edges exist. `has_more_relationships` is defined only over relationships the caller may read.

A missing, deleted, wrong-type, or inaccessible root returns 404, so the Hub does not distinguish hidden from nonexistent resources.

## Bounds and completeness

The response distinguishes these cases:

- The requested depth was fully evaluated.
- The response stopped at the requested depth and readable relationships may continue beyond it.
- A node limit or edge limit truncated the requested traversal.
- A node or edge limit prevented a definitive per-node completeness result.

The response returns explicit `truncated` and `truncation_reasons` values using `node_limit`, `edge_limit`, or both. `returned_depth` alone is not sufficient because a result can reach the requested depth and still be truncated within that layer.

Incremental expansion reroots a depth-one request at a visible node with both relationship kinds, then merges nodes by MFID and edges by stable ID. This lets an explicit action reveal that node's immediate lineage and associations even when the current root's selected depth follows lineage only. This first contract has no continuation token and is not an unlimited export API.

The `has_more_relationships` field remains scoped to the request's direction and relationship filters. The required `expansion_availability` object separately reports `upstream_lineage`, `downstream_lineage`, and `associations`. A channel is true when at least one authorized, non-deleted relationship matching the relationship-type filter is absent from that response. The API calculates all returned nodes through one grouped query. When Hub merges multiple graph responses, false is dominant for the same node and channel because one response proving the channel complete also proves that no additional edge remains outside the combined graph. A successful explicit expansion removes that channel for the active view.

## ELK integration boundary

ELK Layered benefits from reliable topology and grouping, not server-generated positions. Useful API fields are:

- Explicit lineage direction for layer assignment.
- Explicit undirected associations so they can be styled or excluded from lineage layering.
- Stable node and edge identifiers so a refreshed graph can preserve selection and viewport state.
- Traversal depth for optional level labels and incremental expansion.
- Compact project and instrument references for optional compound-node grouping.
- Persisted edge labels such as `relationship_type` for graph labels and filters.
- Safe per-node expandability when more readable relationships exist outside the returned boundary.
- Deterministic ordering for stable results when equally valid layouts exist.

The API does not return React Flow or ELK configuration, node coordinates, dimensions, ports, colors, CSS classes, or rank values. Those are Hub presentation concerns and depend on viewport size, typography, theme, and accessibility settings. The API may return domain grouping and ordering facts only when they are meaningful outside this client.

## Caching and errors

An ETag or graph revision would let Hub avoid replacing an unchanged graph and could help preserve the current viewport. It is useful but not required for the first typed contract.

Document stable outcomes for invalid depth or filters, missing or inaccessible roots, exceeded hard limits, and unavailable graph computation. If large requests are rejected instead of returned with truncation, use one documented structured error that lets Hub advise the user to reduce depth or scope.

The operation, parameters, enums, response models, and error models are present in the checked-in OpenAPI artifact, so the Hub regenerates its pinned client without handwritten API types.

## Acceptance criteria

- A depth-one request reproduces the selected resource's authorized immediate relationship set with no Hub inference.
- Parent and child direction remains correct when the requested root changes.
- Associations are distinguishable from lineage independently of node type.
- A bounded multi-hop request reports whether the requested traversal is complete within its public contract.
- Every edge references two returned nodes, and all identifiers are canonical MFIDs.
- The same authorized request and unchanged data produce stable node and edge identities and deterministic ordering.
- Hidden resources and relationships do not affect visible counts or completeness metadata in a way that reveals their existence.
- Hub can render useful labels and grouping without an N+1 sequence of detail requests.
- The OpenAPI artifact is sufficient to generate all request and response types.

## Hub adoption status

The Hub pins API revision `a74d3922e0d093878c35666852ff0099e79b2912`, generates the TypeScript client, calls the canonical operation, validates the typed boundary, consumes API relationship semantics and expansion availability, defaults to separate upstream and downstream lineage depth-three requests, and exposes URL-backed lineage-depth selection through three levels. It merges those directional results with the root's depth-one associations so automatic traversal neither changes lineage direction nor recursively fans through sample-dataset links. It offers only API-confirmed rerooted depth-one expansion directly from nodes, a graph menu, and the relationship card, while keeping the accessible relationship table and canonical node navigation. React Flow renders draggable browser-side nodes from ELK Layered positions, supports native fullscreen, restores automatic placement on reset, prevents node overlap in automatic layouts, and animates supported updates with reduced-motion handling.
