# Crucible Hub

Crucible Hub is the browser workspace for finding, organizing, understanding, sharing, uploading, and managing resources in the Molecular Foundry Crucible data platform.

## Status

The Hub runs locally with fixtures, a developer API key, or ORCID sign-in. A limited production pilot serves `https://crucible.lbl.gov/hub/` through a single-instance Cloud Run service with ORCID authentication. Deployments can end active sessions. Shared session persistence, broader rollout checks, and browser upload remain future work. See the [pilot deployment guide](docs/cloud-run-pilot.md).

Hub follows the API contract owned by `crucible-api`, cross-repository policy from `crucible-ecosystem`, interaction lessons from `crucible-lens`, and incremental convergence with `crucible_graph_explorer`. `nano-crucible` remains the Python and CLI interface.

## Quick start

Use Node.js 22.22 and npm 10.9. To explore the interface without an API account:

```bash
npm ci
npm run dev:fixtures
```

Open `http://127.0.0.1:3000/hub/`. The server fails if port 3000 is occupied. `npm run dev` also uses fixtures by default.

To test against the staging API as your own account, put your user-scoped key in the gitignored `.env.api-staging.local` file as `CRUCIBLE_API_KEY`, then run:

```bash
npm run dev:api-staging
```

This mode sends API requests from the Hub server using that key. It does not exercise ORCID sign-in, session cookies, or logout. It can perform real mutations, so use test resources and the staging API for workflow testing. Run `npm run dev:api-main` only when you explicitly intend to work against production data. The browser never receives the key.

The other named scenarios are:

| Command                     | Hub authentication | API target                        |
| --------------------------- | ------------------ | --------------------------------- |
| `npm run dev:fixtures`      | Fixtures           | None                              |
| `npm run dev:api-local`     | Your API key       | Local HTTPS API                   |
| `npm run dev:api-staging`   | Your API key       | Staging API                       |
| `npm run dev:api-main`      | Your API key       | Production API                    |
| `npm run dev:orcid-local`   | ORCID              | Local HTTPS API through Tailscale |
| `npm run dev:orcid-staging` | ORCID              | Staging API through Tailscale     |

The nonsecret API URLs and callback settings live in [`config/env/`](config/env/). Each API-key scenario reads `CRUCIBLE_API_KEY` from its matching gitignored `.env.api-*.local` file; `.env.api-key.local` or an exported shell variable is a fallback. ORCID scenarios instead read `HUB_AUTH_CLIENT_SECRET` from the matching gitignored `.env.orcid-*.local` file; `.env.hub-auth.local` is a fallback. For a local HTTPS API, also set `NODE_EXTRA_CA_CERTS` to its trusted certificate before Node starts. The launcher clears settings from other scenarios and gives credentials only to the server process. Do not use a `VITE_` prefix, enter credentials in the browser, or commit local credential files. Production Hub never accepts API-key mode.

Use an ORCID scenario to exercise sign-in, sessions, and logout. These scenarios use a Tailscale-reachable Hub callback, so the chosen API must register the exact callback and have its own ORCID callback registered. The staging scenario uses `https://leviathan.rooster-chimaera.ts.net/hub/auth/callback`. See [authentication transition](docs/authentication-transition.md) for the full setup. Deployed Hub settings are separate from local development.

Run `npm run validate` for the complete local validation and production build. Run `npm run validate:static` for the static and unit subset, `npm run test:browser` for the bounded screenshot-free CI browser and accessibility gate, and `npm run test:production` for the built Node runtime. Install Chromium once with `npx playwright install chromium`.

## Documentation

- [Product brief](docs/product-brief.md)
- [Information architecture](docs/information-architecture.md)
- [Architecture](docs/architecture.md)
- [Authentication transition](docs/authentication-transition.md)
- [Roadmap](docs/roadmap.md)
- [Foundation evidence](docs/phase-0-evidence.md)
- [Administration workspace proposal](docs/administration-workspace.md)
- [Design system](docs/design-system.md)
- [API integration](docs/api-integration.md)
- [Crucible API handoff](docs/crucible-api-handoff.md)
- [Architecture decisions](decisions/README.md)
- [Skills](skills/README.md)
- [Contributor guide](CONTRIBUTING.md)
- [Agent guide](AGENTS.md)
- [Changelog](CHANGELOG.md)

## License

A license has not been selected. Do not copy a sibling repository's license without an explicit decision.
