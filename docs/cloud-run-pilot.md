# Cloud Run pilot

Status: Internal service deployed with production sign-in disabled; public proxy route pending

The production API reported revision `8e4d0ef1f18878f0ab7eff428a053f83b970f3fe` deployed with schema `e92a6b1c730f` and healthy readiness. The Hub's pinned OpenAPI artifact and generated client now use that API revision. API production Hub login remains disabled until the proxy and Hub service are ready for the controlled pilot.

The limited Hub pilot uses `crucible-hub` in `mf-crucible/us-central1`, 2 vCPU, 1 GiB, one minimum and one maximum instance, request-based billing, and Cloud Run session affinity. It uses `HUB_AUTH_SESSION_MODE=single-instance` with no shared-store secrets. The Hub keeps API tokens in server memory and sends the browser only an opaque `HttpOnly`, `Secure` session cookie. Cloud Run can [briefly exceed a configured maximum](https://docs.cloud.google.com/run/docs/configuring/max-instances) and [affinity is best effort](https://docs.cloud.google.com/run/docs/configuring/session-affinity), so users may need to sign in again after a replacement, deployment, or routing change. Do not promise session continuity or use traffic splitting for this pilot. [Decision 0033](../decisions/0033-use-existing-cloud-sql-for-shared-hub-sessions.md) selects a future Hub-owned Cloud SQL store before scaling; it is not implemented or part of this pilot.

## Existing infrastructure and build

Read-only inventory on 2026-09-28 found `crucible-web`, the Nginx proxy VM, in `mf-crucible/us-central1-a` on the project's default VPC. Private Google Access is enabled on its `us-central1` default subnet. The dedicated `crucible-hub` Artifact Registry repository and `crucible-hub-runtime@mf-crucible.iam.gserviceaccount.com` identity were then created. Cloud Build has repository-scoped writer access, and the runtime identity has accessor access only to the existing Hub client-secret resource. Secret version 1 is enabled; its value was not accessed. The sibling `crucible-nginx/nginx.conf` has `/explore/` but no `/hub/` route.

The current internal Cloud Run revision is `crucible-hub-00004-wzk`, built from Hub commit `569303285ae335f0f05b1a2a8681c89ec741d093` and image `us-central1-docker.pkg.dev/mf-crucible/crucible-hub/app@sha256:9b87a2b5607b4b4cdc7a438be0be2088a8362c9fe1a44cbbaf2fdd73b28d3fbb`. Its callback success and error redirects use the configured public Hub origin. The service's reported URL is `https://crucible-hub-cem4trw4lq-uc.a.run.app`; the deploy output also gives `https://crucible-hub-776258882599.us-central1.run.app`. Use the reported URL for the proxy upstream. The current revision receives 100% of service traffic. The service has `internal` ingress, `roles/run.invoker` for `allUsers`, one minimum and maximum instance, session affinity, and `HUB_AUTH_PRODUCTION_ENABLED=false`. The internal ingress restriction remains effective despite the IAM policy: from outside the project `/hub/health` returned 404, while `crucible-web` received 200 for `/hub/` and `/hub/health`. The current revision's health endpoint also returned 200 from the VM. This verifies VM invocation but not the final Nginx route, cookies, or sign-in.

The [pilot Cloud Build configuration](../cloudbuild.pilot.yaml) builds and pushes the existing Dockerfile image without deploying it. Unlike Explorer's combined build-and-deploy pipeline, this keeps the image build separate from authentication activation. The [Cloud Build source ignore file](../.gcloudignore) excludes local environment files and other private build artifacts before source upload; the Docker build context has its own [ignore file](../.dockerignore). Submit only the reviewed Hub commit from a clean checkout, supply its full SHA as `_IMAGE_TAG`, record the pushed image's `sha256` digest, and use that digest for Cloud Run deployment. A tag alone does not prove the uploaded source matched the commit.

```sh
git status --short
git rev-parse HEAD
gcloud builds submit . --project mf-crucible --config cloudbuild.pilot.yaml --substitutions _IMAGE_TAG=REVIEWED_COMMIT_SHA
```

The repository, runtime identity, and secret grant above already exist. Do not recreate them. Keep the runtime identity limited to the pinned Hub client secret; do not share Explorer's identity or give the Hub the API's ORCID secret.

```sh
gcloud artifacts repositories describe crucible-hub --project mf-crucible --location us-central1
gcloud iam service-accounts describe crucible-hub-runtime@mf-crucible.iam.gserviceaccount.com --project mf-crucible
```

## Deployment shape

- Build the existing [Dockerfile](../Dockerfile) from a reviewed commit and deploy its immutable image digest. The build context must exclude local environment files and certificates. The service listens on port 3000 and serves `/hub/` without prefix stripping.
- Use the dedicated `crucible-hub-runtime@mf-crucible.iam.gserviceaccount.com` service identity with the existing grant to `crucible-hub-main-client-secret`, pinned to version 1. Do not give it Explorer's service identity, an API key, or ORCID credentials.
- Set `HUB_DATA_SOURCE=hub-auth`, `HUB_AUTH_SESSION_MODE=single-instance`, `HUB_AUTH_CALLBACK_URI=https://crucible.lbl.gov/hub/auth/callback`, `HUB_AUTH_PUBLIC_API_URL=https://crucible.lbl.gov/api/v3`, and an approved HTTPS `CRUCIBLE_API_BASE_URL`. Bind `HUB_AUTH_CLIENT_SECRET` from Secret Manager. Leave shared-store configuration absent. Keep `HUB_AUTH_PRODUCTION_ENABLED=false` on the first deployment; enable it only for the controlled pilot after the API revision, proxy route, and [pilot risk review](cloud-run-pilot-risk-review.md) are confirmed.
- Configure the service-level minimum and maximum to one and enable Cloud Run session affinity. Cloud Run treats both scaling limits and affinity as best effort. Keep all traffic on one revision; a new deployment signs users out as its process-local sessions disappear.
- Preserve `/hub/` in the Nginx upstream request. The Graph Explorer's `/explore/` proxy strips its prefix because Explorer handles that internally; copying that rule would break Hub routes and its callback.

The inactive service was deployed with the following configuration. Do not rerun the command as a new revision merely to inspect it:

```sh
gcloud run deploy crucible-hub \
  --project mf-crucible \
  --region us-central1 \
  --image us-central1-docker.pkg.dev/mf-crucible/crucible-hub/app@sha256:9b87a2b5607b4b4cdc7a438be0be2088a8362c9fe1a44cbbaf2fdd73b28d3fbb \
  --service-account crucible-hub-runtime@mf-crucible.iam.gserviceaccount.com \
  --cpu 2 --memory 1Gi --concurrency 20 --cpu-throttling \
  --min 1 --max 1 --session-affinity \
  --port 3000 --ingress internal --allow-unauthenticated \
  --set-env-vars "HUB_DATA_SOURCE=hub-auth,HUB_AUTH_SESSION_MODE=single-instance,HUB_AUTH_PRODUCTION_ENABLED=false,HUB_AUTH_CALLBACK_URI=https://crucible.lbl.gov/hub/auth/callback,HUB_AUTH_PUBLIC_API_URL=https://crucible.lbl.gov/api/v3,CRUCIBLE_API_BASE_URL=https://crucible.lbl.gov/api/v3" \
  --set-secrets HUB_AUTH_CLIENT_SECRET=crucible-hub-main-client-secret:1
```

The image is deployed by immutable digest. The Hub currently calls the existing public HTTPS API route, matching the restricted pilot's accepted API ingress limitation. The client secret is resolved by Cloud Run from Secret Manager.

## Ingress decision before deployment

The existing Nginx proxy must be able to reach Cloud Run without exposing a direct public bypass. Prefer Cloud Run `internal` ingress from the verified same-project VPC. If invocation from `crucible-web` does not work, inspect its actual route and choose a reviewed Private Service Connect or load-balancer path rather than opening `run.app` to the internet. Nginx must preserve the `/hub/` path and both the Hub's session cookies and Cloud Run's affinity cookie. The proposed `--allow-unauthenticated` permits invocation from allowed internal sources without Google IAM tokens, while Hub authentication still protects private data. The API auth ingress and proxy-to-API transport limitations are accepted for the restricted test-user pilot and remain recorded in the [risk review](cloud-run-pilot-risk-review.md); they must be revisited before broader release. See [Cloud Run private networking](https://docs.cloud.google.com/run/docs/securing/private-networking) and [ingress controls](https://docs.cloud.google.com/run/docs/securing/ingress).

Prepare this addition to the `crucible.lbl.gov` Nginx server. The log format belongs in the `http` block. The upstream host below is the verified Cloud Run service URL. Nginx [preserves the incoming URI](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass) when `proxy_pass` has no trailing URI, so `/hub/auth/callback` and built assets reach TanStack Start unchanged. Explorer's `/explore/` route strips its prefix and must not be copied. Confirm the Nginx container's CA bundle path before reloading.

```nginx
log_format hub_access escape=json '{"method":"$request_method","path":"$uri","status":$status,"duration":$request_time}';

location = /hub {
    return 308 /hub/;
}

location ^~ /hub/ {
    access_log /var/log/nginx/access.log hub_access;
    error_log /dev/null;
    client_max_body_size 16m;
    proxy_pass https://crucible-hub-cem4trw4lq-uc.a.run.app;
    proxy_set_header Host crucible-hub-cem4trw4lq-uc.a.run.app;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_ssl_server_name on;
    proxy_ssl_name crucible-hub-cem4trw4lq-uc.a.run.app;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_connect_timeout 5s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    proxy_buffering off;
}
```

The proxy's default access format includes the full request line, so the Hub route uses only `$uri` and never logs callback query parameters or credentials. Its local error log is suppressed for the same reason; review CDN and pre-location logs separately. Cloud Run automatically generates request logs whose `httpRequest.requestUrl` can include query parameters. The `_Default` sink now has a `crucible-hub-auth-callback` exclusion limited to the Hub service's callback request logs. Verify it remains enabled, check for inherited sinks, and inspect a synthetic callback without a real code before sign-in. Application error logs retain categorized callback failures. The route must pass `Set-Cookie` and `Cookie` unchanged. Validate the actual `Host` and forwarded-origin behavior, OAuth redirects, secure cookie attributes, static assets, and `GET /hub/health` through Nginx before making the route public. Test that direct internet access to the `run.app` URL is denied. Do not reload Nginx or change its shared routing until the reviewed API and Hub release gates pass.

## Activation checks

Confirm the API release, migration, ORCID redirect registration, Secret Manager grant, HTTPS API base URL, proxy configuration, and [pilot risk review](cloud-run-pilot-risk-review.md) before enabling sign-in. In a controlled pilot window, set `HUB_AUTH_PRODUCTION_ENABLED=true`, enable the reviewed proxy route, and verify sign-in, callback, return-to navigation, session expiry, refresh concurrency, logout and revocation, two-user isolation, secure cookies, CSRF checks, and safe restart and deployment sign-out. Check that secret values and one-time codes are absent from browser artifacts and retained logs. If browser or ingress validation fails, disable the Hub route and production flag and investigate without falling back to API-key mode. The activation update creates a new Cloud Run revision; keep all traffic on it and expect sign-out on subsequent revisions.
