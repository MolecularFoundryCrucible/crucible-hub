# Cloud Run pilot

Status: Configuration ready for review; not deployed

The limited Hub pilot uses `crucible-hub` in `mf-crucible/us-central1`, 2 vCPU, 1 GiB, one minimum and one maximum instance, request-based billing, and Cloud Run session affinity. It uses `HUB_AUTH_SESSION_MODE=single-instance` with no Redis secrets. The Hub keeps API tokens in server memory and sends the browser only an opaque `HttpOnly`, `Secure` session cookie. Cloud Run can [briefly exceed a configured maximum](https://docs.cloud.google.com/run/docs/configuring/max-instances) and [affinity is best effort](https://docs.cloud.google.com/run/docs/configuring/session-affinity), so users may need to sign in again after a replacement, deployment, or routing change. Do not promise session continuity or use traffic splitting for this pilot. [Decision 0032](../decisions/0032-use-shared-redis-sessions.md) owns the later Redis transition.

## Deployment shape

- Build the existing [Dockerfile](../Dockerfile) from a reviewed commit and deploy its immutable image digest. The build context must exclude local environment files and certificates. The service listens on port 3000 and serves `/hub/` without prefix stripping.
- Use a dedicated `crucible-hub-runtime@mf-crucible.iam.gserviceaccount.com` service identity. Grant it Secret Manager access only to `crucible-hub-main-client-secret`, pinned to version 1. The service identity and grants are proposed and must be created before deployment. Do not give it Explorer's service identity, an API key, or ORCID credentials.
- Set `HUB_DATA_SOURCE=hub-auth`, `HUB_AUTH_SESSION_MODE=single-instance`, `HUB_AUTH_PRODUCTION_ENABLED=true`, `HUB_AUTH_CALLBACK_URI=https://crucible.lbl.gov/hub/auth/callback`, `HUB_AUTH_PUBLIC_API_URL=https://crucible.lbl.gov/api/v3`, and an approved protected HTTPS `CRUCIBLE_API_BASE_URL`. Bind `HUB_AUTH_CLIENT_SECRET` from Secret Manager. Leave `HUB_SESSION_REDIS_URL` and `HUB_SESSION_KEYS` absent.
- Configure the service-level minimum and maximum to one and enable Cloud Run session affinity. Cloud Run treats both scaling limits and affinity as best effort. Keep all traffic on one revision; a new deployment signs users out as its process-local sessions disappear.
- Preserve `/hub/` in the Nginx upstream request. The Graph Explorer's `/explore/` proxy strips its prefix because Explorer handles that internally; copying that rule would break Hub routes and its callback.

After completing the activation checks and confirming that the proxy qualifies for `internal` ingress, the proposed service configuration is:

```sh
gcloud run deploy crucible-hub \
  --project mf-crucible \
  --region us-central1 \
  --image "$HUB_IMAGE_DIGEST" \
  --service-account crucible-hub-runtime@mf-crucible.iam.gserviceaccount.com \
  --cpu 2 --memory 1Gi --concurrency 20 --cpu-throttling \
  --min 1 --max 1 --session-affinity \
  --port 3000 --ingress internal --allow-unauthenticated \
  --set-env-vars "HUB_DATA_SOURCE=hub-auth,HUB_AUTH_SESSION_MODE=single-instance,HUB_AUTH_PRODUCTION_ENABLED=true,HUB_AUTH_CALLBACK_URI=https://crucible.lbl.gov/hub/auth/callback,HUB_AUTH_PUBLIC_API_URL=https://crucible.lbl.gov/api/v3,CRUCIBLE_API_BASE_URL=$HUB_API_BASE_URL" \
  --set-secrets HUB_AUTH_CLIENT_SECRET=crucible-hub-main-client-secret:1
```

`HUB_IMAGE_DIGEST` must name a reviewed immutable Artifact Registry image. `HUB_API_BASE_URL` must be the approved protected HTTPS API route. These are operator-supplied non-secret values; the client secret is resolved by Cloud Run from Secret Manager. The command is a review target, not permission to deploy.

## Ingress decision before deployment

The existing Nginx proxy must be able to reach Cloud Run without exposing a direct public bypass. Prefer Cloud Run `internal` ingress if the proxy's verified Compute Engine source is in the same authorized project and VPC. If it is not, select and review an external Application Load Balancer path with `internal-and-cloud-load-balancing` ingress. Nginx needs a working invocation path, must preserve the Hub path and affinity and session cookies, and must pass the canonical public origin; direct `run.app` access from the internet must fail. The proposed `--allow-unauthenticated` permits invocation from allowed internal sources without Google IAM tokens, while Hub authentication still protects private data. Do not copy Explorer's unrestricted public Cloud Run route without explicitly accepting that bypass. The API auth ingress and proxy-to-API transport issues in the production release handoff also need resolution before real production login.

## Activation checks

Confirm the API release, migration, ORCID redirect registration, Secret Manager grant, proxy route, and protected API base URL. Verify sign-in, callback, return-to navigation, session expiry, refresh concurrency, logout and revocation, two-user isolation, secure cookies, CSRF checks, and safe restart and deployment sign-out. Check that secret values and one-time codes are absent from browser artifacts and logs. Keep the production flag disabled until this evidence and the repository threat model are reviewed. No cloud resources or proxy routes are created by this document.
