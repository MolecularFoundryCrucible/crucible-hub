# Cloud Run pilot

Status: Pilot active since October 13, 2026 (v1.0.0), with uploads and ingestion enabled and the shared Postgres session store in use since October 14, 2026 (v1.1.0), and open to every Crucible account holder since October 26, 2026 (v1.6.6)

The Hub's public address is `https://crucible.lbl.gov/hub/`. A dedicated `crucible-hub` Cloud Run service runs with 2 vCPU, 1 GiB, manual scaling fixed at one instance, request-based billing, session affinity, and `internal` ingress, with `HUB_UPLOADS_ENABLED` and `HUB_UPLOAD_INGESTION_ENABLED` set. It is reached through the existing Crucible Nginx reverse proxy. The Hub uses API-owned ORCID sign-in, server-held API tokens, and an opaque `HttpOnly`, `Secure` browser session cookie. API-key mode is local development only.

The service runs `HUB_AUTH_SESSION_MODE=postgres`, keeping sessions in a Hub-owned Cloud SQL database, so deployments and restarts keep people signed in. It runs one instance; scaling beyond one is a separate decision. Requests reach it through the LBL reverse proxy and Google's front end, which both append to `X-Forwarded-For`, so the service sets `HUB_TRUSTED_PROXY_HOPS=2` for the sign-in rate limit to see the real client address.

The commands below use placeholders such as `<project-id>`, `<region>`, `<runtime-service-account>`, and `<db-password-secret>`. The concrete values are not recorded in this repository; read them from the deployed service with an account that has access to the project:

```sh
gcloud run services list --filter=metadata.name=crucible-hub --format='value(metadata.namespace,region)' --project <project-id>
gcloud run services describe crucible-hub --project <project-id> --region <region> --format='value(spec.template.spec.serviceAccountName)'
gcloud run services describe crucible-hub --project <project-id> --region <region> --format=json | jq '.spec.template.spec.containers[0].env[] | select(.valueFrom.secretKeyRef) | {name, secret: .valueFrom.secretKeyRef.name}'
gcloud run services describe crucible-hub --project <project-id> --region <region> --format=json | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="HUB_SESSION_DATABASE_INSTANCE") | .value'
```

The first command confirms the region of the service in the project the operator already works in; the others list the runtime service account, the Secret Manager secret behind each environment variable without revealing secret values, and the Cloud SQL instance used for sessions.

## Pause and resume the pilot

Pause the service with [Cloud Run manual scaling set to zero](https://docs.cloud.google.com/run/docs/managing/services); `/hub/health` then returns HTTP 503. Pausing needs no proxy, Explorer, API, image, or secret change.

```sh
gcloud run services update crucible-hub --project <project-id> --region <region> --scaling=0 --quiet
```

Check the state without displaying environment variables or secrets:

```sh
gcloud run services describe crucible-hub --project <project-id> --region <region> --format=json | jq '{scalingMode:.metadata.annotations["run.googleapis.com/scalingMode"], manualInstanceCount:.metadata.annotations["run.googleapis.com/manualInstanceCount"], latestReadyRevision:.status.latestReadyRevisionName}'
gcloud run services get-iam-policy crucible-hub --project <project-id> --region <region>
curl -sS -o /dev/null -w '%{http_code}\n' https://crucible.lbl.gov/hub/health
```

To resume, set manual scaling to exactly one instance and confirm the service's invoker policy matches its recorded configuration. Manual scaling is used instead of automatic scaling with a minimum and maximum of one because automatic scaling can briefly start a second instance.

```sh
gcloud run services update crucible-hub --project <project-id> --region <region> --scaling=1 --quiet
```

Confirm that the service annotations show `scalingMode` `manual` with `manualInstanceCount` `1`, the intended image digest serves 100% of traffic, and `/hub/health` returns HTTP 200. Then smoke-test sign-in, navigation, and logout with a disposable account. Do not change the reverse proxy or the API to resume this service.

## Shared session store

The Hub keeps sessions in a Hub-owned Postgres database on the existing Cloud SQL instance `<project-id>:<region>:<instance>`, so restarts and deployments do not sign users out and more than one instance becomes possible. The database, schema `hub`, an owner role and an application role, and the application-role password secret are provisioned by the API operators; the runtime identity can read only the application password and holds `roles/cloudsql.client`. The [authentication transition](authentication-transition.md) describes the store, including the default database and role names.

Switch in this order, at a quiet moment, because the configuration change signs everyone out once:

1. Deploy a release that contains the Postgres store while the service stays in `single-instance` mode.
2. Apply the migrations as the owner role from a clean checkout of that release, with Application Default Credentials that hold `roles/cloudsql.client`. The script reports the applied versions and is safe to repeat.

   ```sh
   HUB_SESSION_DATABASE_INSTANCE=<project-id>:<region>:<instance> \
   HUB_SESSION_DATABASE_USER=<owner-role> \
   HUB_SESSION_DATABASE_PASSWORD="<owner-role-password>" \
   node scripts/migrate-session-store.mjs
   ```

3. Create the session key ring secret once and let only the runtime identity read it. Each entry is `id:` followed by a base64url 32-byte key.

   ```sh
   printf 'k1:%s' "$(openssl rand 32 | basenc --base64url | tr -d '=\n')" |
     gcloud secrets create <session-keys-secret> --project <project-id> \
       --replication-policy automatic --data-file -
   gcloud secrets add-iam-policy-binding <session-keys-secret> \
     --project <project-id> \
     --member serviceAccount:<runtime-service-account> \
     --role roles/secretmanager.secretAccessor
   ```

4. Switch the service to the shared store.

   ```sh
   gcloud run services update crucible-hub --project <project-id> \
     --region <region> \
     --update-env-vars HUB_AUTH_SESSION_MODE=postgres,HUB_SESSION_DATABASE_INSTANCE=<project-id>:<region>:<instance> \
     --update-secrets HUB_SESSION_KEYS=<session-keys-secret>:latest,HUB_SESSION_DATABASE_PASSWORD=<db-password-secret>:latest
   ```

5. Check `/hub/health`, sign in, deploy the same image again or restart the revision, and confirm the session survives.

Roll back by setting `HUB_AUTH_SESSION_MODE=single-instance` and removing `HUB_SESSION_KEYS`, `HUB_SESSION_DATABASE_INSTANCE`, and `HUB_SESSION_DATABASE_PASSWORD` in one update; production sign-in stays unavailable while single-instance mode sees any shared-store setting. Rotate the key ring by adding a new first entry and keeping the old one for at least thirty days. Scaling beyond one instance stays a separate decision.

## Build and deploy

Releases build and deploy automatically from their tag; see [Release automation](#release-automation). The manual steps below remain for rollbacks and builds outside a release. The [Cloud Build configuration](../cloudbuild.pilot.yaml) reuses the cached `deps-cache` stage from Artifact Registry, builds and pushes the [Dockerfile](../Dockerfile) image, and leaves deployment off by default (`_DEPLOY=false`). Pass `_DEPLOY=true` to also deploy the pushed digest in the same Cloud Build job. The [Cloud Build source ignore file](../.gcloudignore) and [Docker ignore file](../.dockerignore) exclude local environment files, certificates, and build artifacts. Submit from a clean checkout of the reviewed commit and tag the image with its full commit SHA. The build tag alone does not prove which source was uploaded.

```sh
git status --short
git rev-parse HEAD
gcloud builds submit . --project <project-id> --config cloudbuild.pilot.yaml --substitutions _IMAGE_TAG=REVIEWED_COMMIT_SHA
gcloud run deploy crucible-hub --project <project-id> --region <region> --image IMAGE_DIGEST --quiet
```

An image-only deployment preserves the service's existing authentication, instance, identity, network, and secret settings while creating a new revision. Do not repeat the initial service-creation flags or copy the Explorer's configuration. The Hub runtime identity needs only its existing Hub client-secret access, not an API key or the API's ORCID secret. Before deployment, inspect the current service and confirm `internal` ingress, manual scaling with one instance, session affinity, `HUB_AUTH_PRODUCTION_ENABLED=true`, the expected callback and API origins, and 100% traffic on one revision. Never display secret values while inspecting configuration.

After deployment, confirm the new image digest and healthy revision with 100% traffic, then check public `/hub/health`, sign-in and error-page security headers, and a disposable-account sign-in, navigation, and logout. The normal Hub document policy is `Referrer-Policy: same-origin`, which lets the native logout form send its real `Origin`; OAuth redirects use `no-referrer`. Keep exact Origin validation, including rejection of missing, null, and foreign origins. The response also needs its framing CSP, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`. Check that callback codes and cookies are absent from retained logs and browser artifacts. Two-user isolation, refresh races, and restart behavior remain separate pilot evidence.

## Response compression (deferred)

Status: Deferred on October 13, 2026. No proxy or application change is planned for the pilot.

Static JavaScript and CSS are pre-compressed at build time (`compressPublicAssets` in `vite.config.ts`) and served as brotli or gzip by `Accept-Encoding`. Dynamic responses, the server-rendered HTML documents and server-function JSON, are sent uncompressed because Cloud Run does not compress responses and the Nginx reverse proxy is not configured to. HTML documents are `private, no-store`, so every full page load transfers them in full.

| Response (fixture build)  | Uncompressed | gzip  | brotli  |
| ------------------------- | ------------ | ----- | ------- |
| Home document             | 103 KB       | 14 KB | 11.5 KB |
| Dataset Overview document | 127 KB       | 18 KB | 14 KB   |
| Server-function JSON      | 1 to 3 KB    | -60%  | -65%    |

The documents are mostly utility class names and inline SVG icons. The saving is about 90 ms per full page load at 10 Mbps and about 450 ms at 2 Mbps; real API collections, file lists, and thumbnail payloads will be larger than the fixtures.

Preferred option: enable gzip in the existing `/hub/` location of the Nginx reverse proxy. It needs no application or Cloud Run CPU, streams with server rendering, and leaves the pre-compressed static assets untouched because Nginx does not recompress responses that already carry `Content-Encoding`. The proxy must keep forwarding the browser's `Accept-Encoding` header (no `proxy_set_header Accept-Encoding ""`); otherwise Cloud Run returns uncompressed assets and Nginx re-gzips them without brotli.

```nginx
location /hub/ {
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_proxied any;
    gzip_types application/json text/plain text/css application/javascript image/svg+xml;
    # existing proxy_pass and headers unchanged
}
```

`text/html` is compressed whenever `gzip on` is set. Brotli would need a non-standard Nginx module and saves only about 15 to 20% more on HTML.

Alternatives: compressing inside the Hub server entry works without the proxy but spends Cloud Run CPU on the single instance, buffers streamed server rendering on Node, and must be checked against [Nitro issue 3789](https://github.com/nitrojs/nitro/issues/3789). [Cloud CDN dynamic compression](https://docs.cloud.google.com/cdn/docs/dynamic-compression) requires an external Application Load Balancer in front of Cloud Run, which would replace the current proxy ingress and its logging controls; reconsider it only if ingress moves to a load balancer for other reasons.

BREACH assessment: compressing HTTPS responses that combine a secret with attacker-influenced input can leak that secret through response sizes. Hub documents carry no CSRF token (mutations are protected by `Origin` validation in `src/start.ts`), the session cookie is `HttpOnly` and never in a body, API tokens stay on the server, and the `SameSite=Lax` cookie prevents cross-site credentialed subrequests that the attack needs. Recheck this assessment when compression is enabled.

Verification after enabling:

1. `curl -sI -H 'Accept-Encoding: gzip' https://crucible.lbl.gov/hub/` returns `Content-Encoding: gzip` and `Vary: Accept-Encoding`; repeat for one server-function request.
2. A file under `/hub/assets/` still returns `Content-Encoding: br`, confirming pre-compressed assets pass through.
3. Sign-in, navigation, logout, and the security headers listed above are unchanged.

## Release automation

Pushing to `main` never deploys. Choose the bump with the versioning rule at the top of [`CHANGELOG.md`](../CHANGELOG.md): UI features and fixes are patch releases, additions to shareable URLs, deep links, or deployment configuration are minor, and breaking those is major. Cut a release with `npm run release -- [patch|minor|major|X.Y.Z] [--push]`, which stamps `CHANGELOG.md` without modifying `package.json` or `package-lock.json` (preserving the Docker `deps` layer cache), commits `chore(release): X.Y.Z`, and creates the annotated `vX.Y.Z` tag. Pushing a `vX.Y.Z` release tag runs a Cloud Build GitHub trigger (tag pattern `^v[0-9]+\.[0-9]+\.[0-9]+$`) with the [release build configuration](../cloudbuild.release.yaml) as a dedicated release service account. It reuses and updates `${_IMAGE}:deps-cache`, builds the tagged commit with `VITE_APP_VERSION=${TAG_NAME}`, pushes the image tagged with the full commit SHA and the release tag, and deploys the pushed digest to `crucible-hub` with an image-only `gcloud run deploy`, so the service keeps its existing settings. The identity holds only Artifact Registry writer on the Hub image repository, Cloud Run developer on the `crucible-hub` service, service account user on the runtime service account, and log writer. A release deploy interrupts uploads in progress, so tag at a quiet moment, run the post-deployment checks above once the build finishes, and roll back by deploying the previous release digest. The manual [pilot build configuration](../cloudbuild.pilot.yaml) remains for builds outside a release.
