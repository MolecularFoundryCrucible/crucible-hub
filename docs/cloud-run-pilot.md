# Cloud Run pilot

Status: Pilot active since October 13, 2026 (v1.0.0), with uploads and ingestion enabled on October 14, 2026

The Hub's public address is `https://crucible.lbl.gov/hub/`. The separate `crucible-hub` Cloud Run service in `mf-crucible/us-central1` runs with 2 vCPU, 1 GiB, manual scaling fixed at one instance, request-based billing, session affinity, and `internal` ingress, with `HUB_UPLOADS_ENABLED` and `HUB_UPLOAD_INGESTION_ENABLED` set. It is reached through the `crucible-web` proxy. The Hub uses API-owned ORCID sign-in, server-held API tokens, and an opaque `HttpOnly`, `Secure` browser session cookie. API-key mode is local development only.

The pilot uses `HUB_AUTH_SESSION_MODE=single-instance` with process-local sessions. Cloud Run can [briefly exceed a configured maximum](https://docs.cloud.google.com/run/docs/configuring/max-instances), and [affinity is best effort](https://docs.cloud.google.com/run/docs/configuring/session-affinity). A deployment, replacement, or routing change can sign users out. Keep all traffic on one revision and do not promise session continuity until the service runs on the [shared session store](#shared-session-store). The [pilot risk review](cloud-run-pilot-risk-review.md) records remaining ingress and transport limitations.

## Pause and resume the pilot

On September 28, 2026, the `allUsers` `roles/run.invoker` binding was removed from `crucible-hub`, the service minimum was changed from one to zero, and [Cloud Run manual scaling was set to zero](https://docs.cloud.google.com/run/docs/managing/services). Removing the IAM binding and setting the minimum to zero alone did not stop the same-project proxy from serving the Hub. Manual scaling to zero disabled the service; `/hub/health` then returned HTTP 503. No proxy, Explorer, API, image, or secret configuration was changed. The retained ready revision is `crucible-hub-00008-qn9`. Process-local Hub sessions do not survive the pause.

Check the disabled state without displaying environment variables or secrets:

```sh
gcloud run services describe crucible-hub --project mf-crucible --region us-central1 --format=json | jq '{scalingMode:.metadata.annotations["run.googleapis.com/scalingMode"], manualInstanceCount:.metadata.annotations["run.googleapis.com/manualInstanceCount"], latestReadyRevision:.status.latestReadyRevisionName}'
gcloud run services get-iam-policy crucible-hub --project mf-crucible --region us-central1
curl -sS -o /dev/null -w '%{http_code}\n' https://crucible.lbl.gov/hub/health
```

To resume the single-instance pilot, set manual scaling to exactly one instance and restore the original public invoker binding on the Hub service only. Manual scaling is used instead of automatic scaling with a minimum and maximum of one because automatic scaling can briefly start a second instance, which would split the process-local sessions. More instances wait for the API ingress reinforcement and the shared session store in [decision 0033](../decisions/0033-use-existing-cloud-sql-for-shared-hub-sessions.md).

```sh
gcloud run services update crucible-hub --project mf-crucible --region us-central1 --scaling=1 --quiet
gcloud run services add-iam-policy-binding crucible-hub --project mf-crucible --region us-central1 --member=allUsers --role=roles/run.invoker --quiet
```

Confirm that the service annotations show `scalingMode` `manual` with `manualInstanceCount` `1`, the intended image digest serves 100% of traffic, and `/hub/health` returns HTTP 200. Then smoke-test sign-in, navigation, and logout with a disposable account. Users must sign in again because sessions were held in the stopped instance. Do not change `crucible-web` or the API to resume this service.

## Shared session store

The Hub can keep sessions in the Hub-owned `crucible_hub` database on `mf-crucible:us-central1:crucible-db`, so restarts and deployments no longer sign users out and more than one instance becomes possible. The database, schema `hub`, roles `crucible_hub_owner` and `crucible_hub_app`, and secrets `crucible-hub-main-db-owner-password` and `crucible-hub-main-db-app-password` are provisioned by the API operators; the runtime identity can read only the app password and holds `roles/cloudsql.client`. The [authentication transition](authentication-transition.md) describes the store.

Switch in this order, at a quiet moment, because the configuration change signs everyone out once:

1. Deploy a release that contains the Postgres store while the service stays in `single-instance` mode.
2. Apply the migrations as the owner from a clean checkout of that release, with Application Default Credentials that hold `roles/cloudsql.client`. The script reports the applied versions and is safe to repeat.

   ```sh
   HUB_SESSION_DATABASE_INSTANCE=mf-crucible:us-central1:crucible-db \
   HUB_SESSION_DATABASE_USER=crucible_hub_owner \
   HUB_SESSION_DATABASE_PASSWORD="$(gcloud secrets versions access latest \
     --secret crucible-hub-main-db-owner-password --project mf-crucible)" \
   node scripts/migrate-session-store.mjs
   ```

3. Create the session key ring secret once and let only the runtime identity read it. Each entry is `id:` followed by a base64url 32-byte key.

   ```sh
   printf 'k1:%s' "$(openssl rand 32 | basenc --base64url | tr -d '=\n')" |
     gcloud secrets create crucible-hub-session-keys --project mf-crucible \
       --replication-policy automatic --data-file -
   gcloud secrets add-iam-policy-binding crucible-hub-session-keys \
     --project mf-crucible \
     --member serviceAccount:crucible-hub-runtime@mf-crucible.iam.gserviceaccount.com \
     --role roles/secretmanager.secretAccessor
   ```

4. Switch the service to the shared store.

   ```sh
   gcloud run services update crucible-hub --project mf-crucible \
     --region us-central1 \
     --update-env-vars HUB_AUTH_SESSION_MODE=postgres,HUB_SESSION_DATABASE_INSTANCE=mf-crucible:us-central1:crucible-db \
     --update-secrets HUB_SESSION_KEYS=crucible-hub-session-keys:latest,HUB_SESSION_DATABASE_PASSWORD=crucible-hub-main-db-app-password:latest
   ```

5. Check `/hub/health`, sign in, deploy the same image again or restart the revision, and confirm the session survives.

Roll back by setting `HUB_AUTH_SESSION_MODE=single-instance` and removing `HUB_SESSION_KEYS`, `HUB_SESSION_DATABASE_INSTANCE`, and `HUB_SESSION_DATABASE_PASSWORD` in one update; production sign-in stays unavailable while single-instance mode sees any shared-store setting. Rotate the key ring by adding a new first entry and keeping the old one for at least twelve hours. Scaling beyond one instance stays a separate decision that waits for the API ingress reinforcement.

## Build and deploy

Releases build and deploy automatically from their tag; see [Release automation](#release-automation). The manual steps below remain for rollbacks and builds outside a release. The [Cloud Build configuration](../cloudbuild.pilot.yaml) builds and pushes the [Dockerfile](../Dockerfile) image without deploying it. The [Cloud Build source ignore file](../.gcloudignore) and [Docker ignore file](../.dockerignore) exclude local environment files, certificates, and build artifacts. Submit from a clean checkout of the reviewed commit, tag the image with its full commit SHA, and deploy the resulting immutable digest. The build tag alone does not prove which source was uploaded.

```sh
git status --short
git rev-parse HEAD
gcloud builds submit . --project mf-crucible --config cloudbuild.pilot.yaml --substitutions _IMAGE_TAG=REVIEWED_COMMIT_SHA
gcloud run deploy crucible-hub --project mf-crucible --region us-central1 --image IMAGE_DIGEST --quiet
```

An image-only deployment preserves the service's existing authentication, instance, identity, network, and secret settings while creating a new revision. Do not repeat the initial service-creation flags or copy the Explorer's configuration. The Hub runtime identity needs only its existing Hub client-secret access, not an API key or the API's ORCID secret. Before deployment, inspect the current service and confirm `internal` ingress, manual scaling with one instance, session affinity, `HUB_AUTH_PRODUCTION_ENABLED=true`, the expected callback and API origins, and 100% traffic on one revision. Never display secret values while inspecting configuration.

After deployment, confirm the new image digest and healthy revision with 100% traffic, then check public `/hub/health`, sign-in and error-page security headers, and a disposable-account sign-in, navigation, and logout. The normal Hub document policy is `Referrer-Policy: same-origin`, which lets the native logout form send its real `Origin`; OAuth redirects use `no-referrer`. Keep exact Origin validation, including rejection of missing, null, and foreign origins. The response also needs its framing CSP, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`. Check that callback codes and cookies are absent from retained logs and browser artifacts. Two-user isolation, refresh races, and restart behavior remain separate pilot evidence.

## Response compression (deferred)

Status: Deferred on October 13, 2026. No proxy or application change is planned for the pilot.

Static JavaScript and CSS are pre-compressed at build time (`compressPublicAssets` in `vite.config.ts`) and served as brotli or gzip by `Accept-Encoding`. Dynamic responses, the server-rendered HTML documents and server-function JSON, are sent uncompressed because Cloud Run does not compress responses and the `crucible-web` Nginx proxy is not configured to. HTML documents are `private, no-store`, so every full page load transfers them in full.

| Response (fixture build)  | Uncompressed | gzip  | brotli  |
| ------------------------- | ------------ | ----- | ------- |
| Home document             | 103 KB       | 14 KB | 11.5 KB |
| Dataset Overview document | 127 KB       | 18 KB | 14 KB   |
| Server-function JSON      | 1 to 3 KB    | -60%  | -65%    |

The documents are mostly utility class names and inline SVG icons. The saving is about 90 ms per full page load at 10 Mbps and about 450 ms at 2 Mbps; real API collections, file lists, and thumbnail payloads will be larger than the fixtures.

Preferred option: enable gzip in the existing `/hub/` location of the `crucible-web` Nginx proxy. It needs no application or Cloud Run CPU, streams with server rendering, and leaves the pre-compressed static assets untouched because Nginx does not recompress responses that already carry `Content-Encoding`. The proxy must keep forwarding the browser's `Accept-Encoding` header (no `proxy_set_header Accept-Encoding ""`); otherwise Cloud Run returns uncompressed assets and Nginx re-gzips them without brotli.

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

BREACH assessment: compressing HTTPS responses that combine a secret with attacker-influenced input can leak that secret through response sizes. Hub documents carry no CSRF token (mutations are protected by `Origin` validation in `src/start.ts`), the session cookie is `HttpOnly` and never in a body, API tokens stay on the server, and the `SameSite=Lax` cookie prevents cross-site credentialed subrequests that the attack needs. Record this assessment in the [pilot risk review](cloud-run-pilot-risk-review.md) when compression is enabled.

Verification after enabling:

1. `curl -sI -H 'Accept-Encoding: gzip' https://crucible.lbl.gov/hub/` returns `Content-Encoding: gzip` and `Vary: Accept-Encoding`; repeat for one server-function request.
2. A file under `/hub/assets/` still returns `Content-Encoding: br`, confirming pre-compressed assets pass through.
3. Sign-in, navigation, logout, and the security headers listed above are unchanged.

## Release automation

Pushing to `main` never deploys. Pushing a `vX.Y.Z` release tag runs the Cloud Build GitHub trigger `crucible-hub-release` (region `us-central1`, tag pattern `^v[0-9]+\.[0-9]+\.[0-9]+$`) with the [release build configuration](../cloudbuild.release.yaml) as the `crucible-hub-release` service account. It builds the tagged commit, pushes the image tagged with the full commit SHA and the release tag, and deploys the pushed digest to `crucible-hub` with an image-only `gcloud run deploy`, so the service keeps its existing settings. The identity holds only Artifact Registry writer on the `crucible-hub` repository, Cloud Run developer on the `crucible-hub` service, service account user on `crucible-hub-runtime`, and log writer. A release deploy ends every in-memory session and interrupts uploads in progress, so tag at a quiet moment, run the post-deployment checks above once the build finishes, and roll back by deploying the previous release digest. The manual [pilot build configuration](../cloudbuild.pilot.yaml) remains for builds outside a release.
