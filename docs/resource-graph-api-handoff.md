# Resource graph API handoff

Status: Proposed API-owned contract

Date: 2026-09-17

## Purpose

This document defines the API support needed for dependable multi-hop resource graphs in Crucible Hub. The current Hub graph is intentionally limited to the selected sample or dataset and its immediate readable relationships. It uses a deterministic Cytoscape preset layout and does not require API-generated coordinates.

The next layout candidate is `cytoscape-elk` using ELK Layered. ELK can calculate positions in the browser, but it cannot repair missing relationship semantics, ambiguous direction, incomplete traversal, or undisclosed truncation. A typed and bounded graph response is therefore the prerequisite for adopting that extension.

## Current limitation

Hub currently reads `GET /entity_graph_cte/{entity_id}` with `recursive=false`, validates the opaque response at its server boundary, and infers relationship meaning from node types and edge orientation. The public operation name exposes a persistence implementation detail. OpenAPI does not provide a typed graph response with stable relationship semantics, depth, completeness, or limit information.

The current one-hop view remains valid while this contract is unavailable. Hub must not expose recursive traversal or imply graph completeness from the existing response.

## Required operation

Provide one canonical resource graph read, using an API-selected route such as:

```http
GET /resources/{resource_mfid}/graph
```

The operation should accept:

- `depth`, with a documented default and maximum.
- `direction=both|upstream|downstream` for lineage traversal.
- Repeatable or array-based relationship-kind filtering when more than lineage and association exist.
- Optional resource-type filtering when it can be applied before traversal limits without changing the stated semantics.
- Explicit node and edge limits, or documented server-owned limits when callers cannot select them.

The route identifier must be a canonical sample or dataset MFID. Slugs and internal database IDs should not be graph identities.

`depth=0` should return only the root. `depth=1` should return the root and its immediate readable neighbours. The contract must state whether associations consume traversal depth and whether traversal continues through association edges.

## Typed response

The exact schema names belong to the API, but the OpenAPI response should provide equivalent information:

```json
{
  "root_mfid": "...",
  "nodes": [
    {
      "mfid": "...",
      "resource_type": "sample",
      "name": "Example sample",
      "sample_type": "powder",
      "measurement": null,
      "project_mfid": "...",
      "traversal_depth": 0,
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
  "truncated": false,
  "truncation_reason": null,
  "node_limit": 500,
  "edge_limit": 1000
}
```

Required node fields are stable MFID, resource type, and display name. Compact sample type, dataset measurement, and project identity are useful because they let Hub label and group nodes without issuing one detail request per node. A missing optional display value should be represented as `null`, not by omitting the node.

Required edge fields are a stable edge identity or a documented stable composite identity, source MFID, target MFID, typed relationship kind, and explicit direction. Persisted relationship labels or types should be returned directly rather than reconstructed by Hub.

## Relationship semantics

- A lineage edge always uses the parent as `source_mfid` and the child as `target_mfid`.
- An association is explicitly undirected. If the transport schema still requires source and target, use a documented canonical ordering such as sample first and dataset second.
- The API returns one node for each MFID and one edge for each authorized relationship. Responses contain no duplicate nodes, duplicate edges, self-edges unless explicitly supported, or edges whose endpoints are absent.
- The root is always present and exactly matches the requested MFID.
- Response ordering is deterministic with a stable MFID tie-breaker, but does not encode screen coordinates or a particular layout engine.

## Authorization and privacy

The API must authorize the root and every returned node and edge. It must omit relationships whose other endpoint is unreadable without revealing that endpoint's identity, label, type, or count.

Completeness metadata must describe configured traversal boundaries and server limits only. It must not reveal that hidden nodes or edges exist. If `has_more_relationships` cannot be exposed without leaking unreadable topology, omit it or define it only over relationships the caller may read.

A missing, deleted, wrong-type, or inaccessible root should follow the API's established resource-read behavior. Hub should not need to distinguish hidden from nonexistent resources.

## Bounds and completeness

The response must distinguish these cases:

- The requested depth was fully evaluated.
- The response stopped at the requested depth and readable relationships may continue beyond it.
- A node limit or edge limit truncated the requested traversal.
- A server policy refused an excessive request.

Return explicit `truncated` and `truncation_reason` values such as `node_limit`, `edge_limit`, or `server_limit`. `returned_depth` alone is not sufficient because a result can reach the requested depth and still be truncated within that layer.

If the API supports incremental expansion, return opaque continuation or frontier tokens that preserve the original authorization scope, filters, direction, and traversal semantics. Hub must be able to merge an expansion without duplicating nodes or edges. If safe continuation cannot be guaranteed, rerooting with another bounded graph request is preferable.

## Useful support for `cytoscape-elk`

ELK Layered benefits from reliable topology and grouping, not server-generated positions. Useful API fields are:

- Explicit lineage direction for layer assignment.
- Explicit undirected associations so they can be styled or excluded from lineage layering.
- Stable node and edge identifiers so a refreshed graph can preserve selection and viewport state.
- Traversal depth for optional level labels and incremental expansion.
- Compact project and instrument references for optional compound-node grouping.
- Persisted edge labels such as `relationship_type` for graph labels and filters.
- Safe per-node expandability when more readable relationships exist outside the returned boundary.
- Deterministic ordering for stable results when equally valid layouts exist.

The API should not return Cytoscape or ELK configuration, node coordinates, dimensions, ports, colors, CSS classes, or rank values. Those are Hub presentation concerns and depend on viewport size, typography, theme, and accessibility settings. The API may return domain grouping and ordering facts only when they are meaningful outside this client.

## Caching and errors

An ETag or graph revision would let Hub avoid replacing an unchanged graph and could help preserve the current viewport. It is useful but not required for the first typed contract.

Document stable outcomes for invalid depth or filters, missing or inaccessible roots, exceeded hard limits, and unavailable graph computation. If large requests are rejected instead of returned with truncation, use one documented structured error that lets Hub advise the user to reduce depth or scope.

The operation, parameters, enums, response models, and error models must be present in the checked-in OpenAPI artifact so Hub can regenerate its pinned client without handwritten API types.

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

## Hub adoption sequence

1. Pin the OpenAPI artifact and regenerate the TypeScript client.
2. Replace the CTE-specific server adapter with the canonical typed operation while retaining runtime validation and bounds.
3. Remove relationship inference and consume API-provided kinds and direction.
4. Expose bounded depth or expansion only after completeness and authorization behavior are verified.
5. Evaluate `cytoscape-elk` with ELK Layered against dense, mixed-type, compact, and reduced-motion fixtures.
6. Keep the accessible relationship table and canonical node navigation regardless of the layout engine.
