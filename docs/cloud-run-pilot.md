# Cloud Run pilot

Status: Pilot temporarily paused on September 28, 2026

The Hub's public address is `https://crucible.lbl.gov/hub/`, but the service is currently disabled and `/hub/health` returns HTTP 503. The separate `crucible-hub` Cloud Run service in `mf-crucible/us-central1` retains its deployed image, revision, 2 vCPU, 1 GiB, one maximum instance, request-based billing, session affinity, and `internal` ingress. It is reached through the `crucible-web` proxy, whose configuration was not changed for this pause. The Explorer and API routes remain available. When active, the Hub uses API-owned ORCID sign-in, server-held API tokens, and an opaque `HttpOnly`, `Secure` browser session cookie. API-key mode is local development only.

The pilot uses `HUB_AUTH_SESSION_MODE=single-instance` with process-local sessions. Cloud Run can [briefly exceed a configured maximum](https://docs.cloud.google.com/run/docs/configuring/max-instances), and [affinity is best effort](https://docs.cloud.google.com/run/docs/configuring/session-affinity). A deployment, replacement, or routing change can sign users out. Keep all traffic on one revision and do not promise session continuity. [Decision 0033](../decisions/0033-use-existing-cloud-sql-for-shared-hub-sessions.md) selects a future Hub-owned Cloud SQL session store before scaling; it is not implemented for this pilot. The [pilot risk review](cloud-run-pilot-risk-review.md) records remaining ingress and transport limitations.

## Pause and resume the pilot

On September 28, 2026, the `allUsers` `roles/run.invoker` binding was removed from `crucible-hub`, the service minimum was changed from one to zero, and [Cloud Run manual scaling was set to zero](https://docs.cloud.google.com/run/docs/managing/services). Removing the IAM binding and setting the minimum to zero alone did not stop the same-project proxy from serving the Hub. Manual scaling to zero disabled the service; `/hub/health` then returned HTTP 503. No proxy, Explorer, API, image, or secret configuration was changed. The retained ready revision is `crucible-hub-00008-qn9`. Process-local Hub sessions do not survive the pause.

Check the disabled state without displaying environment variables or secrets:

```sh
gcloud run services describe crucible-hub --project mf-crucible --region us-central1 --format=json | jq '{scalingMode:.metadata.annotations["run.googleapis.com/scalingMode"], manualInstanceCount:.metadata.annotations["run.googleapis.com/manualInstanceCount"], latestReadyRevision:.status.latestReadyRevisionName}'
gcloud run services get-iam-policy crucible-hub --project mf-crucible --region us-central1
curl -sS -o /dev/null -w '%{http_code}\n' https://crucible.lbl.gov/hub/health
```

To resume the same single-instance pilot, restore automatic scaling with one minimum instance and the original public invoker binding on the Hub service only:

```sh
gcloud run services update crucible-hub --project mf-crucible --region us-central1 --scaling=auto --min=1 --quiet
gcloud run services add-iam-policy-binding crucible-hub --project mf-crucible --region us-central1 --member=allUsers --role=roles/run.invoker --quiet
```

Confirm that scaling is automatic with a minimum and maximum of one, the original image and revision still serve 100% of traffic, and `/hub/health` returns HTTP 200. Then smoke-test sign-in, navigation, and logout with a disposable account. Users must sign in again because sessions were held in the stopped instance. Do not change `crucible-web` or the API to resume this service.

## Build and deploy

The [Cloud Build configuration](../cloudbuild.pilot.yaml) builds and pushes the [Dockerfile](../Dockerfile) image without deploying it. The [Cloud Build source ignore file](../.gcloudignore) and [Docker ignore file](../.dockerignore) exclude local environment files, certificates, and build artifacts. Submit from a clean checkout of the reviewed commit, tag the image with its full commit SHA, and deploy the resulting immutable digest. The build tag alone does not prove which source was uploaded.

```sh
git status --short
git rev-parse HEAD
gcloud builds submit . --project mf-crucible --config cloudbuild.pilot.yaml --substitutions _IMAGE_TAG=REVIEWED_COMMIT_SHA
gcloud run deploy crucible-hub --project mf-crucible --region us-central1 --image IMAGE_DIGEST --quiet
```

An image-only deployment preserves the service's existing authentication, instance, identity, network, and secret settings while creating a new revision. Do not repeat the initial service-creation flags or copy the Explorer's configuration. The Hub runtime identity needs only its existing Hub client-secret access, not an API key or the API's ORCID secret. Before deployment, inspect the current service and confirm `internal` ingress, one minimum and maximum instance, session affinity, `HUB_AUTH_PRODUCTION_ENABLED=true`, the expected callback and API origins, and 100% traffic on one revision. Never display secret values while inspecting configuration.

After deployment, confirm the new image digest and healthy revision with 100% traffic, then check public `/hub/health`, sign-in and error-page security headers, and a disposable-account sign-in, navigation, and logout. The normal Hub document policy is `Referrer-Policy: same-origin`, which lets the native logout form send its real `Origin`; OAuth redirects use `no-referrer`. Keep exact Origin validation, including rejection of missing, null, and foreign origins. The response also needs its framing CSP, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`. Check that callback codes and cookies are absent from retained logs and browser artifacts. Two-user isolation, refresh races, and restart behavior remain separate pilot evidence.

## Release automation

No Hub GitHub tag build trigger is configured. A future release can use a native [Cloud Build GitHub trigger](https://docs.cloud.google.com/build/docs/automating-builds/github/build-repos-from-github) restricted to this repository, `v*` tags, and `cloudbuild.pilot.yaml`. First connect the repository to Cloud Build and assign a least-privilege build identity. Have the trigger build and push an image tagged with the source commit SHA, then record the digest. Keep deployment manual during the single-instance pilot so creating a tag cannot end active sessions without an explicit rollout.
