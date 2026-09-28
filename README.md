# Crucible Hub

Crucible Hub is the browser workspace for finding, organizing, understanding, sharing, uploading, and managing resources in the Molecular Foundry Crucible data platform.

## Status

The local-development workspace includes the responsive application shell and design system, generated OpenAPI client, server-only API adapter, identity-scoped Query state, global and project-scoped search, QR lookup, cursor-paginated and facet-grouped data browsing, resource previews and configurable sibling navigation, project and instrument workspaces, canonical sample and dataset detail, graph and dataset processing views, creation and controlled management workflows, and capability-gated service-account administration. Deterministic fixtures, browser coverage, production runtime checks, and CI are in place. Production authentication and mutation exposure remain blocked by the API-owned one-time login exchange and Hub session boundary. Browser upload remains blocked on a secure exact-object capability and verified CORS behavior. No deployment or release process exists.

Hub follows the API contract owned by `crucible-api`, cross-repository policy from `crucible-ecosystem`, interaction lessons from `crucible-lens`, and incremental convergence with `crucible_graph_explorer`. `nano-crucible` remains the Python and CLI interface.

## Quick start

Use Node.js 22.22 and npm 10.9:

```bash
npm ci
npm run dev:fixtures
```

The development server is available at `http://127.0.0.1:3000/hub/` and fails if port 3000 is occupied. `npm run dev` still uses fixtures by default. Use a named scenario to switch API and sign-in targets:

| Command                     | Hub authentication | API target                        |
| --------------------------- | ------------------ | --------------------------------- |
| `npm run dev:fixtures`      | Fixtures           | None                              |
| `npm run dev:api-local`     | Temporary API key  | Local HTTPS API                   |
| `npm run dev:api-staging`   | Temporary API key  | Staging API                       |
| `npm run dev:api-main`      | Temporary API key  | Main API                          |
| `npm run dev:orcid-local`   | ORCID              | Local HTTPS API through Tailscale |
| `npm run dev:orcid-staging` | ORCID              | Staging API through Tailscale     |

The nonsecret scenario settings live in [`config/env/`](config/env/). Put `CRUCIBLE_API_KEY` in a gitignored `.env.api-local.local`, `.env.api-staging.local`, or `.env.api-main.local` file for the corresponding API-key scenario. The existing `.env.api-key.local` and an exported shell key remain fallbacks. Put `HUB_AUTH_CLIENT_SECRET` in gitignored `.env.orcid-local.local` and `.env.orcid-staging.local` files for the ORCID scenarios. The existing `.env.hub-auth.local` remains a fallback while migrating. For local HTTPS API scenarios, set `NODE_EXTRA_CA_CERTS` to its trusted certificate in the corresponding local credential file or shell. The scenario launcher passes these values only to the server process and removes settings from other scenarios. Never use a `VITE_` prefix, enter a credential in the browser, commit it, or use API-key mode in production.

The ORCID staging scenario uses `https://leviathan.rooster-chimaera.ts.net/hub/auth/callback`; the staging API must register that exact Hub callback. It does not change the API's own registered ORCID callback. See [authentication transition](docs/authentication-transition.md) for the Tailscale and API requirements. Deployed Hub settings are managed separately from these local development scenarios.

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
