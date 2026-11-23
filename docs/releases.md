# Releases and deployment checks

This repository publishes the Hub as a container image; each deployment pulls a released image and runs it with its own settings. This page covers cutting a release, the published image, and checks that apply to any deployment. [Docker Compose](../deploy/compose/README.md) is the documented way to self-host.

## Cutting a release

Changes reach `main` through pull requests, and pushing to `main` never builds or deploys. Choose the bump with the versioning rule at the top of [`CHANGELOG.md`](../CHANGELOG.md), then run `npm run release -- [patch|minor|major|X.Y.Z] [--push]`. It stamps `CHANGELOG.md` without touching `package.json` or `package-lock.json` (preserving the Docker `deps` layer cache), commits `chore(release): X.Y.Z`, and creates the annotated `vX.Y.Z` tag.

A `vX.Y.Z` tag starts the [release image workflow](../.github/workflows/release-image.yml), which builds amd64 and arm64 on native runners and publishes `ghcr.io/molecularfoundrycrucible/crucible-hub` tagged `X.Y.Z` and `X.Y`, with an SBOM, build provenance, the standard `org.opencontainers.image` labels, `gov.lbl.crucible.api.min-version` (the oldest Crucible API release it needs), and `gov.lbl.crucible.api.revision`, both read from `contracts/crucible-api.lock.json`. Re-run a failed publish from the Actions tab on the release tag; run it on a branch to build both architectures without publishing.

[`.dockerignore`](../.dockerignore) keeps local environment files, certificates, and build artifacts out of the image build context.

## After a deployment

A deployment interrupts uploads in progress, so deploy at a quiet moment. Then confirm:

- The new image digest serves all traffic, and `/hub/health` returns HTTP 200 with `"sessions": "ok"`.
- Sign-in, navigation, and sign-out work with a disposable account.
- Documents carry the security headers listed in [request protection](authentication.md#request-protection), and sign-out still rejects missing, null, and foreign `Origin` values.
- Callback codes and cookies are absent from retained logs and browser artifacts.

Run one Hub instance. Sessions live in Postgres and refresh claims are coordinated across instances, but running several instances has not been validated. Never display secret values while inspecting configuration.

## Response compression

Static JavaScript and CSS are pre-compressed at build time (`compressPublicAssets` in `vite.config.ts`) and served as brotli or gzip by `Accept-Encoding`. The Hub does not compress dynamic responses (server-rendered HTML and server-function JSON), so compress them in front of it, at the reverse proxy or CDN. That costs the Hub no CPU and keeps server rendering streamed. The proxy must forward `Accept-Encoding` and leave responses that already carry `Content-Encoding` alone. Caddy does this with `encode zstd gzip`; Nginx needs `gzip on`, `gzip_proxied any`, and `gzip_types` for JSON, CSS, JavaScript, and SVG.

BREACH does not apply today: Hub documents carry no CSRF token (mutations are protected by `Origin` validation in `src/start.ts`), the session cookie is `HttpOnly` and never in a body, API tokens stay on the server, and the `SameSite=Lax` cookie blocks the cross-site credentialed subrequests the attack needs. Recheck this if any of those change.

To verify, `curl -sI -H 'Accept-Encoding: gzip' <origin>/hub/` returns `Content-Encoding: gzip` and `Vary: Accept-Encoding`, and a file under `/hub/assets/` still returns `Content-Encoding: br`.
