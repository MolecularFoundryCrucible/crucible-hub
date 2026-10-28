# Cloud Run pilot

Status: Pilot active since October 13, 2026 (v1.0.0), with uploads and ingestion enabled and the shared Postgres session store in use since October 14, 2026 (v1.1.0), and open to every Crucible account holder since October 26, 2026 (v1.6.6)

The Molecular Foundry runs the public pilot at `https://crucible.lbl.gov/hub/` as a Cloud Run service behind its reverse proxy, with Postgres sessions on Cloud SQL and one manually scaled instance. Its operations (the recorded service configuration, deployment approvals, pause and resume, the session store setup, and the proxy) live in a private deployment repository, not here. This page covers what this repository provides for any deployment: release builds, published images, post-deployment checks, and response compression. Other labs self-host with [Docker Compose](../deploy/compose/README.md).

## Release automation

Pushing to `main` never builds or deploys. Choose the bump with the versioning rule at the top of [`CHANGELOG.md`](../CHANGELOG.md): UI features and fixes are patch releases, additions to shareable URLs, deep links, or deployment configuration are minor, and breaking those is major. Cut a release with `npm run release -- [patch|minor|major|X.Y.Z] [--push]`, which stamps `CHANGELOG.md` without modifying `package.json` or `package-lock.json` (preserving the Docker `deps` layer cache), commits `chore(release): X.Y.Z`, and creates the annotated `vX.Y.Z` tag.

A `vX.Y.Z` tag starts two builds:

- The [release image workflow](../.github/workflows/release-image.yml) in GitHub Actions builds amd64 and arm64 on native runners and publishes `ghcr.io/molecularfoundrycrucible/crucible-hub` tagged `X.Y.Z` and `X.Y`, with an SBOM, build provenance, the standard `org.opencontainers.image` labels, `gov.lbl.crucible.api.min-version` (the oldest Crucible API release it needs, from `contracts/crucible-api.lock.json`), and `gov.lbl.crucible.api.revision`. Re-run a failed publish from the Actions tab on the release tag; run it on a branch to build both architectures without publishing.
- A Cloud Build trigger (tag pattern `^v[0-9]+\.[0-9]+\.[0-9]+$`) runs the [release build configuration](../cloudbuild.release.yaml) as a release identity that holds only Artifact Registry writer on the Hub image repository and log writer. It reuses and updates `${_IMAGE}:deps-cache`, builds the tagged commit with `VITE_APP_VERSION=${TAG_NAME}`, pushes the image tagged with the full commit SHA and the release tag, and prints the digest. It does not deploy: the pilot's deployment repository applies a reviewed change to that digest after an explicit approval, checks `/hub/health`, and rolls back by revert.

The [manual build configuration](../cloudbuild.pilot.yaml) builds outside a release from a clean checkout of a reviewed commit, tagged with its full commit SHA, and prints the digest; like a release, it never deploys. The [Cloud Build source ignore file](../.gcloudignore) and [Docker ignore file](../.dockerignore) exclude local environment files, certificates, and build artifacts.

## After a deployment

A deployment interrupts uploads in progress, so deploy at a quiet moment. Then confirm:

- The new image digest serves all traffic on a healthy revision, and `/hub/health` returns HTTP 200 with `"sessions": "ok"`.
- Sign-in, navigation, and logout work with a disposable account.
- Documents carry `Referrer-Policy: same-origin` (OAuth redirects use `no-referrer`), the framing `Content-Security-Policy`, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`. Logout keeps exact `Origin` validation, rejecting missing, null, and foreign origins.
- Callback codes and cookies are absent from retained logs and browser artifacts.

An image-only change preserves the service's authentication, scaling, identity, network, and secret settings. Never display secret values while inspecting configuration.

## Response compression

Static JavaScript and CSS are pre-compressed at build time (`compressPublicAssets` in `vite.config.ts`) and served as brotli or gzip by `Accept-Encoding`. Dynamic responses, the server-rendered HTML documents and server-function JSON, are sent uncompressed: the Hub server does not compress them, and neither does Cloud Run. HTML documents are `private, no-store`, so every full page load transfers them in full.

| Response (fixture build)  | Uncompressed | gzip  | brotli  |
| ------------------------- | ------------ | ----- | ------- |
| Home document             | 103 KB       | 14 KB | 11.5 KB |
| Dataset Overview document | 127 KB       | 18 KB | 14 KB   |
| Server-function JSON      | 1 to 3 KB    | -60%  | -65%    |

Compress at the reverse proxy in front of the Hub: it costs the Hub no CPU, streams with server rendering, and leaves the pre-compressed assets alone as long as the proxy forwards the browser's `Accept-Encoding` header and does not recompress responses that already carry `Content-Encoding`. The self-hosted bundle's Caddy does this with `encode zstd gzip`; Nginx needs `gzip on` with `gzip_proxied any` and `gzip_types` for JSON, CSS, JavaScript, and SVG in the `/hub/` location. Compressing inside the Hub server instead spends its CPU, buffers streamed server rendering on Node, and must be checked against [Nitro issue 3789](https://github.com/nitrojs/nitro/issues/3789).

BREACH assessment: compressing HTTPS responses that combine a secret with attacker-influenced input can leak that secret through response sizes. Hub documents carry no CSRF token (mutations are protected by `Origin` validation in `src/start.ts`), the session cookie is `HttpOnly` and never in a body, API tokens stay on the server, and the `SameSite=Lax` cookie prevents the cross-site credentialed subrequests the attack needs. Recheck this when any of those change.

After enabling compression, `curl -sI -H 'Accept-Encoding: gzip' <origin>/hub/` returns `Content-Encoding: gzip` and `Vary: Accept-Encoding`, a file under `/hub/assets/` still returns `Content-Encoding: br`, and sign-in, navigation, logout, and the security headers are unchanged.
