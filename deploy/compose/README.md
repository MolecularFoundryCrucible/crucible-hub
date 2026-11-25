# Self-hosted Crucible Hub

This Compose project runs Crucible Hub next to a self-hosted Crucible API. It has three services: `hub` (the web app on port 3000), `hub-db` (PostgreSQL 17 holding only Hub sign-in sessions), and `hub-setup` (a one-shot job that creates the session roles and schema and applies migrations before the Hub starts). The Hub never touches the API's database.

The API bundle is the Compose installation in [crucible-selfhost](https://github.com/MolecularFoundryCrucible/crucible-selfhost/tree/main/compose); its [Hub guide](https://github.com/MolecularFoundryCrucible/crucible-selfhost/blob/main/compose/docs/hub.md) covers the API side of these steps. Its front door (Caddy) serves both at one address: `/api/v4/` goes to the API and `/hub/` goes to the Hub, without stripping the prefix. The Hub only runs under `/hub/`. It can sit on the same machine as the API bundle or on a separate one; only the settings differ.

## Requirements

- Docker with Compose v2.20 or later.
- The API bundle running with its Hub sign-in settings (`compose.hub.yaml` in its `COMPOSE_FILE`): the Hub callbacks `<your address>/hub/auth/callback` and `<your address>/hub/auth/link/callback` among its allowed redirects, and the same client secret as `secrets/hub_auth_client_secret` here.
- HTTPS at the front door, unless everything runs on one machine at `http://localhost`. The Hub accepts an HTTP callback and public API address only on `localhost`, `127.0.0.1` or `[::1]`, and drops `Secure` from its cookies only then. Open the Hub at exactly the address in `HUB_PUBLIC_ORIGIN`: the Hub refuses changes sent from another origin, so `127.0.0.1` and `localhost` are not interchangeable.
- A way to sign in through the API. Passwords are on by default in the API bundle. ORCID needs the bundle's `compose.orcid.yaml`, HTTPS, and an ORCID application whose redirect is the API's own callback (`<public API address>/oauth/callback/orcid`), not the Hub's.

## Secrets

Create one file per secret in `secrets/` (ignored by git). Containers read them from `/run/secrets`, so keep the directory private and the files readable:

```sh
cd deploy/compose
chmod 700 secrets
printf '%s' '<shared Hub client secret from the API bundle>' > secrets/hub_auth_client_secret
printf 'k1:%s' "$(openssl rand 32 | basenc --base64url | tr -d '=\n')" > secrets/hub_session_keys
openssl rand -base64 32 | tr -d '\n' > secrets/hub_session_database_password
openssl rand -base64 32 | tr -d '\n' > secrets/hub_db_admin_password
chmod 444 secrets/hub_*
```

| File                            | Used by           | Purpose                                                                     |
| ------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| `hub_auth_client_secret`        | hub               | Shared with the API's Hub sign-in settings                                  |
| `hub_session_keys`              | hub               | Encrypts stored sessions; entries are `id:` plus a base64url 32-byte key    |
| `hub_session_database_password` | hub, hub-setup    | Password of the `crucible_hub_app` role the Hub signs in to the database as |
| `hub_db_admin_password`         | hub-db, hub-setup | PostgreSQL superuser password, used only for setup                          |

To rotate session keys without signing everyone out, put the new key first and keep the old one after a comma until the old sessions expire: `k2:<new>,k1:<old>`.

Every Hub secret can also come from an environment variable or a `NAME_FILE` path, but only one way each; see [settings](../../docs/authentication.md#settings).

## Same machine as the API

The Hub joins the API bundle's Docker network (named `crucible` unless you changed it) as `hub`, and calls the API over that private network.

```sh
cp example.env .env
# Edit HUB_PUBLIC_ORIGIN and HUB_AUTH_PUBLIC_API_URL, and set HUB_IMAGE to a released image.
docker compose pull hub hub-setup
docker compose up -d --wait
```

Keep `CRUCIBLE_API_BASE_URL` at its default `http://api:8000`: the Hub calls the API inside the Docker network.

For a trial on one machine with the API bundle's defaults, set `HUB_PUBLIC_ORIGIN=http://localhost:8080` and `HUB_AUTH_PUBLIC_API_URL=http://localhost:8080/api/v4`, then open `http://localhost:8080/hub/`.

`example.env` selects `compose.yaml` and `compose.api-network.yaml` and sets `HUB_API_ALLOW_HTTP=true`, because `http://api:8000` never leaves the Docker network. Even with that setting, the Hub accepts plain HTTP only for a container name or a private address. The Hub and setup containers drop every Linux capability and the database drops `NET_RAW`, so none of them can intercept traffic on the shared network; do the same for the API bundle's containers, and keep the API's database off the shared network. The API bundle's `compose.hub.yaml` sets `CRUCIBLE_HUB_UPSTREAM=hub:3000`, so its front door forwards `/hub/` to this project; setting that variable alone forwards traffic without registering the Hub's sign-in client.

## Separate machine

The Hub runs on its own host and calls the API at its public HTTPS address. The front door on the API machine forwards `/hub/` to this host over a private network (or HTTPS); session cookies travel on that hop, so never expose it publicly.

In `.env`, use the separate-machine block: `COMPOSE_FILE=compose.yaml:compose.published.yaml`, `HUB_BIND_ADDRESS` set to the private address the front door reaches, the public `CRUCIBLE_API_BASE_URL`, and `HUB_API_ALLOW_HTTP` unset. Set `CRUCIBLE_HUB_UPSTREAM=<private address>:3000` in the API bundle.

## Settings

The Compose project sets the remaining Hub settings itself; [authentication](../../docs/authentication.md#settings) describes all of them.

| Setting                    | Meaning                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HUB_PUBLIC_ORIGIN`        | The address people use, such as `https://crucible.example.org`. The callback becomes `<origin>/hub/auth/callback`.                                                 |
| `HUB_AUTH_PUBLIC_API_URL`  | The API base address browsers use for sign-in. HTTPS, or HTTP on a loopback host for a one-machine install.                                                        |
| `CRUCIBLE_API_BASE_URL`    | The API base address the Hub server calls.                                                                                                                         |
| `HUB_API_ALLOW_HTTP`       | `true` allows an `http://` `CRUCIBLE_API_BASE_URL` to a container name or private address, never a public one. Access tokens travel on that connection.            |
| `HUB_TRUSTED_PROXY_HOPS`   | Proxies in front of the Hub that append to `X-Forwarded-For` (default 1). The Hub limits sign-in attempts per client address taken from that header; 0 ignores it. |
| `CRUCIBLE_NETWORK`         | The API bundle's network name (same machine only).                                                                                                                 |
| `HUB_IMAGE`, `HUB_VERSION` | Image name to build or pull, and the version shown in the Hub.                                                                                                     |

## Published images

Each Hub release is published as `ghcr.io/molecularfoundrycrucible/crucible-hub:<version>` for amd64 and arm64. To use it instead of building, set `HUB_IMAGE` in `.env` and pull before starting:

```sh
docker compose pull hub hub-setup
docker compose up -d
```

The image's `gov.lbl.crucible.api.min-version` label names the oldest Crucible API release it works with, and `gov.lbl.crucible.api.revision` the exact API revision it was built against (`docker inspect --format '{{ index .Config.Labels "gov.lbl.crucible.api.min-version" }}' <image>`). Hub releases after 1.8.2 need Crucible API 4.1.1 or later, 1.8.0 to 1.8.2 need 4.0.0 (1.7.2 and 1.7.3 need 3.3.0, and 1.7.0 and 1.7.1 need 3.2.0). Pre-release images such as 1.8.0-alpha.1 are built against an unreleased API revision and carry no `min-version` label.

## Stable interface

Downstream installations, including the [crucible-selfhost](https://github.com/MolecularFoundryCrucible/crucible-selfhost) bundle and its CI, script against this project, so treat these names as a versioned interface and call out any change in the changelog: `compose.yaml`, `compose.published.yaml`, the `example.env` keys, the secret file names, the `hub` and `hub-setup` services, `/hub/health` with `"sessions": "ok"`, and the `org.opencontainers.image.version` label.

## Checking and upgrading

`/hub/health` returns HTTP 200 with `"sessions": "ok"` when the Hub can reach its session table, and 503 otherwise; Docker uses it as the container health check.

To upgrade, set `HUB_IMAGE` to the new release and run `docker compose pull hub hub-setup && docker compose up -d`, or, when building, check out the new Hub release tag and run `docker compose up -d --build`. `hub-setup` runs again first and applies any new session migrations; repeating it is safe.
