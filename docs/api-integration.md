# Crucible Hub API Integration

Status: Phase 0 contract

Date: 2026-09-06

## Authority and generated contract

This document owns Hub-side generated-client, server-function, Query, pagination, invalidation, and safe-error conventions. `crucible-api` owns paths, schemas, authorization, resource semantics, pagination shapes, and security schemes. Do not reproduce endpoint inventories or infer a missing contract. [`architecture.md`](architecture.md) owns runtime boundaries and [`authentication-transition.md`](authentication-transition.md) owns authentication cutover.

`contracts/crucible-api.json` is the reviewed deterministic input, `contracts/crucible-api.lock.json` records its source revision and digest, and `src/generated/crucible-api.ts` is deterministic generated output that is never hand-edited. `src/server/crucible/` is the server-only transport and adapter boundary; `src/data/crucible/` contains browser-safe models and Query options.

Contract refreshes must obtain an identified API revision, verify and lock the digest, regenerate with the pinned toolchain, review removals, required fields, unions, nullability, pagination, security, and deprecations, update adapters and tests, then run `npm run validate`. CI and production startup never fetch a moving staging OpenAPI document or regenerate output. An API mismatch is surfaced and coordinated with the owner, never silently repaired by Hub.

## Server-function boundary and errors

Browser-reachable code calls typed server functions and never imports API transport, session storage, credentials, or browser-configurable API origins. Every private function validates browser-safe input before invocation and at the server boundary, resolves trusted server and authenticated user authority, propagates abort signals, applies a bounded endpoint timeout, makes one generated operation or a small justified aggregation, and returns only a minimal browser-safe representation. Capabilities guide UI only, never authorization.

Feature code receives this stable envelope:

```ts
type HubApiError = {
  kind:
    | "unauthenticated"
    | "forbidden"
    | "not-found"
    | "conflict"
    | "validation"
    | "rate-limited"
    | "cancelled"
    | "timeout"
    | "upstream"
    | "unexpected"
  message: string
  correlationId: string
  retryable: boolean
  fieldErrors?: Record<string, string[]>
  retryAfterSeconds?: number
}
```

Hub creates a correlation ID for every document, server-function, and server-route request, places it in request context and `X-Correlation-ID`, and never trusts a browser value. Server functions return serializable `HubResult<T>` unions. The adapter maps validated failures to the envelope: 401, 403, 404, 409, 422, and 429 map to their named kinds; other HTTP failures are `upstream`; transport causes distinguish cancellation, timeout, and unexpected failure. It never exposes headers, cookies, authorization data, signed URLs, raw bodies, stack traces, or internal network details. Hub-to-API correlation propagation remains pending until the API publishes a supported header.

## Query ownership, representations, and hydration

TanStack Query is the sole browser owner of Crucible server data. Loaders use `ensureQueryData` or prefetch the exact options consumed by components, never a second representation. Every authenticated key begins with immutable identity scope:

```ts
type IdentityScope = readonly [
  "crucible",
  serverId: string,
  accountMfid: string,
]
```

Append stable MFIDs, representation names, and normalized primitive parameters. Slugs are lookup input only. Keys never contain credentials, signed URLs, user objects, client instances, unstable labels, or unnormalized filters. A server, account, login, or credential change replaces the active Query client before another identity renders. Persistence is disabled until a privacy and retention decision covers encryption, expiry, logout, and account isolation.

Collection, search, detail, relationship, file, and capability responses are distinct representations. Lightweight rows never seed or overwrite exact detail; tested projections may update compatible rows without erasing fields. Preserve public-safe and unavailable variants: null or omitted members or links are unavailable, while an explicit empty list is available and empty. Null capabilities mean guidance is unavailable, not denial. Expanded dataset project and instrument references are preferred; flat IDs are fallbacks.

SSR dehydrates only successful, defined, approved identity-scoped browser-safe Query families. It excludes errors, session data, credentials, transient capabilities, unscoped data, unknown families, and raw-search Queries. Public-safe person hydration may include only displayed name and canonical identity, never email or privileged account fields. A round-trip test must prove a fresh client hydrates only approved data.

Query functions pass cancellation through server functions and the adapter combines it with the timeout. Cancellation-sensitive content uses `useQuery` with local pending state, not Suspense hooks. A changed search or filter must abort superseded work and never render it as current.

## Reads, navigation, and pagination

Exact resource reads request only the explicit includes needed for the canonical detail representation. Exact project reads request members and scientific metadata because Overview consumes both; withheld values remain unavailable rather than triggering fallback requests. The resource inspector observes the same resource detail Query. It neither uses a parallel cache nor seeds detail from relationship rows or history state. Its shared projection requests links, metadata, and owner while opting out of legacy embedded datasets; previews do not read neighbours recursively, files, downloads, counts, project members, or collections. Lightweight relationship references currently provide only name, MFID, resource type, and relationship, so Hub does not issue per-row detail requests to obtain sample type or dataset measurement. Permission-filtered or unavailable links remain valid authorized data. [Decisions 0008](../decisions/0008-inspect-linked-resources-in-place.md), [0010](../decisions/0010-inspect-project-data-in-place.md), and [0012](../decisions/0012-inspect-global-data-in-place.md) define navigation behavior.

Resource Graph is an independent identity-scoped Query representation loaded only after entering a sample or dataset Graph route. The current adapter calls `GET /entity_graph_cte/{entity_id}` with `recursive=false`, validates the otherwise untyped response at the server boundary, rejects missing roots, dangling edges, duplicates, more than 1,000 nodes, or more than 5,000 edges, and returns only MFID, resource type, name, inferred relationship, and direction. It neither seeds exact resource detail nor requests neighbour details. Because the API does not type edge relationships, the prototype temporarily interprets same-type edges as parent-child and cross-type edges as sample-dataset association. [Decision 0026](../decisions/0026-explore-bounded-resource-graphs.md) defines its navigation and replacement boundary.

Signed file download capability is a user-activated transient POST server-function result, not a Query or Mutation result. The server calls the API only after activation, validates the currently untyped response strictly as one secure URL and positive lifetime, returns it with `Cache-Control: no-store`, and the browser immediately navigates in the same tab with no-referrer isolation. Hub never proxies or modifies the URL. It never enters HTML, DOM before activation, route state, caches, persistence, telemetry, logs, screenshots, or test artifacts.

Samples and datasets use cursor chains: omit `cursor` initially, follow returned `next_cursor`, never mix offset into the chain, and do not imply an exact total when later pages omit it. Projects use offset and limit, with next offset derived from received items. Route search owns shareable filters and page position; Query owns results and refresh. Changing a committed filter resets pagination. Global and project-scoped search are explicit-submit only. Project search passes the canonical `project_mfid` with `project_scope=all` to sample and dataset search operations. Global scientific metadata search calls `GET /resources/metadata/search`, accepts only project, instrument, sample, and dataset results, groups them by type, and keeps raw search text out of dehydrated state and telemetry. Any future live suggestions debounce and cancel. Essential identity uses `ensureQueryData`; recoverable collections prefetch and await only without readable cache data. A page change starts a new Query without blocking the page, may retain same-identity compatible placeholder data, and keeps errors local.

Dataset processing activity is an independent identity-scoped Query loaded from `GET /ingestion_requests` with the canonical dataset MFID, a bounded limit, and an explicit offset. It returns only ingestion identity, class, status, and creation or completion timestamps needed for the read-only Overview card. It does not infer status, poll, expose administration, or preload activity for collections and samples.

Do not fetch hidden types, sibling scopes, speculative tab counts, whole collections, or per-row detail. Home combines bounded first pages only and never infers totals, relevance, attention, or scientific chronology from them. Sorting and grouping remain disabled until the API supplies deterministic sort parameters, null ordering, stable ties, order-compatible opaque cursors, and bounded authorized group summaries. Hub must never sort, group, facet, or filter only loaded pages and present it as whole-collection behavior.

Global Data sends supported normalized project, scope, visibility, UTC creation-date, and dataset instrument filters before cursor pagination. Apply commits URL state, resets relevant cursors and preview history, and Clear removes secondary filters without broadening malformed input. Drafts and chooser searches do not fetch collections. Dataset-only filters are removed for samples. Invalid or contradictory URL state receives local corrective feedback and never causes an unfiltered request. Applied filters are shareable history and in-memory Query-key data; drafts remain transient.

Project Data uses canonical project MFID with explicit `all`, `assigned`, or `shared` scope. The API's omitted scope is not Hub's All default. All is the caller-readable project-access set; Shared is not inferred from assignment and can include unassigned or elsewhere-assigned resources. Contextual `project_relation` is not a resource property and never seeds detail. Scope and filters compose with API-owned AND semantics before pagination. Creation bounds are inclusive UTC values: `YYYY-MM-DDT00:00:00+00:00` and `YYYY-MM-DDT23:59:59.999999+00:00`, because the current API compares date strings lexically. Never use scientific timestamp for creation date or invent request fields. All and Shared authorization failures stay local, without automatic scope changes or credential escalation. Instrument selection uses bounded confirmed instrument search, including inactive instruments, and label lookup cannot remove a filter.

## Mutations and invalidation

Use authoritative mutation responses for the same exact shape, merge only confirmed fields into rich detail, and invalidate the smallest dependent collections, relationships, summaries, and search views. Invalidate project or account views when membership, ownership, access, or assignment changes. No optimistic update for authority, provenance, deletion, upload completion, ingestion, relationships, or scientific metadata unless rollback is deterministic and cannot misrepresent state. Preserve drafts and partial success. Mutations require independent authentication, validation, same-origin, and CSRF enforcement.

Authenticated profile management reads and partially updates `/account/profile` through identity-scoped server functions. Hub validates changed first name, last name, email, and username fields, sends only changes, and replaces the account profile Query with the authoritative response. The authenticated email may appear only in the account-owned profile representation and must not enter public person results, persistence, URLs, logs, telemetry, or shared cache entries.

Project creation uses `POST /projects`, requires a validated unique project ID, organization, title, and one resolved lead identifier, starts active, and navigates by the returned project MFID. Sample creation sends the selected project as `project_mfid`. Dataset creation sends the selected project as `project_mfid` and an optional selected instrument as `instrument_mfid`. Hub does not also send the legacy mutable identifiers because the API resolves canonical MFIDs and requires paired identifiers to match. These creation requests require Crucible API revision `41eeed89c97b9a9108117499b628323f96189809` or a compatible deployment. Creation omits owner and `unique_id` and caches only confirmed detail. A confirmed API rejection retains an editable draft. An uncertain create outcome retains the draft, disables repeat submission while mounted, and directs the user to check Data because the API has no idempotency contract. Dataset-to-sample association is a separate duplicate-resistant stage; a confirmed dataset is never recreated to retry a failed link. See [decision 0025](../decisions/0025-let-api-assign-creation-mfids.md).

Resource Summary writes only documented changed descriptive fields. A capability-gated typed canonical route controls presentation, the API authorizes the patch, and recognized date-times round-trip between local controls and UTC. Nonstandard timestamp strings remain visible and untouched by unrelated writes. Project and instrument Overview editing likewise sends only dedicated descriptive fields, not lifecycle, ownership, access, members, operators, metadata, relationships, or deletion. Failed drafts are local, are never dehydrated, persisted, logged, telemetered, or placed in URLs, and use shared discard protection.

Dataset thumbnails use a separate identity-scoped Query key and are never folded into dataset detail or collection representations. `GET /datasets/{dsid}/thumbnails` supplies the ordered Overview gallery. `POST /datasets/first_thumbnails` supplies at most 100 deduplicated dataset MFIDs for Graph relationship previews; omitted results mean inaccessible or absent thumbnails and do not become errors. Reads begin after browser hydration and responses use `Cache-Control: no-store`. Add, rename, and delete require exact `can_edit` presentation guidance and use the API's POST, PATCH, and DELETE operations, followed by an authoritative thumbnail-list reread in API mode. Hub sends raw file base64 without a data-URL prefix, accepts source files up to the API's default 50 MiB limit, bounds names at 255 characters, replaces the complete thumbnail Query after confirmation, and confirms deletion. The API normalizes supported JPEG, PNG, WebP, TIFF, BMP, and GIF input to oriented RGB JPEG at no more than 512 by 512 pixels and quality 85. Thumbnail payloads remain memory-only and are not logged, persisted, placed in URLs, or loader-dehydrated.

Instrument directory queries always send one of active, maintenance, or decommissioned before offset pagination, with active as the URL-default view. Instrument Lifecycle uses `POST /instruments/{instrument_mfid}/status` and accepts only those three states at the Hub boundary. Exact `can_change_status` controls presentation, while the API authorizes the write. Decommissioning requires confirmation. The authoritative response must identify the target and contain a recognized status; Hub merges only confirmed status and modification time, applies no optimistic state, and invalidates instrument lists and search results. An unrecognized current status remains visible without becoming a selectable Hub-authored state.

Instrument registration uses `POST /instruments` with the API's exact 3 to 25 character instrument ID rule and required name, ID, and location. Hub omits owner, caches the returned instrument detail under its canonical MFID, and invalidates instrument collections and search. Service-account accounts do not receive the registration affordance, while the API remains authoritative.

Instrument Operators uses the instrument-specific list, add, and remove operations only when exact `can_manage_access` guidance is true. Candidate service accounts resolve through `GET /users` with an exact username or MFID, `is_service_account=true`, `permissive=false`, and a one-item limit. Add and remove replace the complete returned list under an identity-scoped operator Query key. Removal requires confirmation. Internal group standing is not presented as an instrument permission.

Ownership transfer uses `POST /resources/{mfid}/transfer_ownership` first without confirmation and then with `confirm=true`. Project assignment uses the equivalent preview-confirm sequence at `POST /resources/{mfid}/project`; the server adapter resolves the selected project MFID to its current project ID before both requests. Exact `can_transfer` and `can_manage_access` respectively guide presentation, but the API authorizes every source and target. Confirmed fields may update exact detail, followed by resource, project, collection, and search invalidation. Neither operation is optimistic. Dataset instrument reassignment remains absent because the API has no dedicated atomic operation.

Metadata writes accept a bounded root JSON object with JSON-compatible values only. Hub safety limits reject malformed values, non-finite numbers, blank or oversized keys, excessive depth or fields, and payloads over 1 MiB. Changed top-level additions and replacements use the shallow merge operation. Any top-level removal, including clearing the object, needs explicit full-replacement confirmation because the API has no conditional or atomic delete operation. Confirmed results update metadata only; no metadata write is optimistic.

Deletion uses the reviewed deletion-request operation, never direct permanent deletion. The optional reason is local and bounded. The response must identify the target; conflicts refresh detail so an existing request can appear. Do not infer deletion eligibility from edit or access capabilities.

Direct project membership is implemented in fixture and local API development through validated server functions for immediate add of an existing user, role change, removal, and non-owner self-leave. A full authoritative member-list response replaces, rather than client-merges, the cached membership representation. Capability guidance controls presentation, including grantable role and transfer constraints, but the API authorizes every request. Membership is separate from descriptive Settings, resource ACLs, ownership transfer, and join requests. There is no invitation workflow. Production exposure remains blocked until the accepted authentication exchange and Hub session boundary are deployed.

Relationship management is scoped to canonical sample and dataset pages. The source resource's exact `can_edit` capability guides presentation; the API authorizes both source and target. Add operations use an accessible bounded type search and explicit direction. Unlink operations require confirmation and never delete either resource. The current adapter ignores legacy mutation bodies and rereads exact source and target detail with links before replacing both exact caches, with no optimistic update or unrelated collection refresh. Successful link and unlink operations also invalidate the exact graph Queries for both participants. Reject self-links and invalid pairs locally where deterministically known, while preserving API errors for duplicate, target, authorization, and cycle validation. The API gap remains explicit: relationship-specific capabilities, complete error and validation semantics, direction rules, and typed authoritative add or unlink responses are required before production exposure. Development through the local API-key bridge does not waive the production authentication and session gate.

Resource management is route-backed at `/samples/:sampleMfid/manage` and `/datasets/:datasetMfid/manage` under the shared canonical resource parent. The parent shell and persistent header remain mounted across Overview, Graph, and Manage. ACL queries load only on Manage entry and set preload disabled. The exact `can_manage_access` capability controls access controls, including project assignment; exact `can_transfer` controls ownership transfer; reviewed deletion does not infer eligibility from either capability. Overview shows project context without that mutation control. Public controls remain distinct, and user or project grant roles are capped by the API-provided `max_grant_role`. Owner, service-account, instrument, system, and unknown grants are read-only. Publish, unpublish, revoke, assignment, ownership transfer, and deletion requests retain their established confirmation behavior. Every write uses server-confirmed state, preserves readable data on failure, and makes no optimistic update. Legacy `/access` routes redirect to Manage.

Multi-stage workflows retain non-secret completed-stage checkpoints and retry only incomplete stages. Creation fields remain in memory and are not persisted in this package. A later failure never duplicates a created resource; secrets and signed URLs are reacquired.

## Validation

`npm run validate` verifies deterministic generation, drift, types, lint, token policy, secrets, and production build. Contract and adapter tests must cover input validation, safe error mapping, cancellation and timeout, cursor and offset behavior, detail-preserving cache behavior, approved hydration, and two-account client replacement. Browser tests use deterministic fixtures. Live authenticated services are not routine validation dependencies. The temporary local API-key bridge is development-only, rejected in production, and governed by [`authentication-transition.md`](authentication-transition.md).
