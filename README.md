# Crucible Hub

Crucible Hub is the browser workspace for finding, organizing, understanding, sharing, uploading, and managing resources in the Molecular Foundry Crucible data platform.

## Status

The local-development workspace includes the responsive application shell and design system, generated OpenAPI client, server-only API adapter, identity-scoped Query state, global and project-scoped search, QR lookup, cursor-paginated and facet-grouped data browsing, resource previews and configurable sibling navigation, project and instrument workspaces, canonical sample and dataset detail, graph and dataset processing views, creation and controlled management workflows, and capability-gated service-account administration. Deterministic fixtures, browser coverage, production runtime checks, and CI are in place. Production authentication and mutation exposure remain blocked by the API-owned one-time login exchange and Hub session boundary. Browser upload remains blocked on a secure exact-object capability and verified CORS behavior. No deployment or release process exists.

Hub follows the API contract owned by `crucible-api`, cross-repository policy from `crucible-ecosystem`, interaction lessons from `crucible-lens`, and incremental convergence with `crucible_graph_explorer`. `nano-crucible` remains the Python and CLI interface.

## Quick start

Use Node.js 22.22 and npm 10.9:

```bash
npm ci
npm run dev
```

The development server is available at `http://127.0.0.1:3000/hub/` and fails if port 3000 is occupied. Fixtures are the default data source. To use the temporary local API bridge, provide a user-scoped key only to the server process:

```bash
read -rsp "Crucible API key: " CRUCIBLE_API_KEY
export CRUCIBLE_API_KEY
HUB_DATA_SOURCE=api CRUCIBLE_API_BASE_URL=https://crucible.lbl.gov/testapi-staging npm run dev
```

Never use a `VITE_` prefix, enter the key in the browser, commit it, or use API-key mode in production.

Run `npm run validate` for the full static and unit suite. Run `npm run test:browser` for the bounded CI browser and accessibility gate, and `npm run test:production` for the built Node runtime. Install Chromium once with `npx playwright install chromium`.

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
