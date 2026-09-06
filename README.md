# Crucible Hub

Crucible Hub is the browser workspace for finding, organizing, understanding, sharing, uploading, and managing resources in the Molecular Foundry Crucible data platform.

## Status

The TanStack Start foundation, desktop design system, identity-scoped read workspace, resource inspection, controlled resource and project settings edits, deterministic fixtures, browser coverage, production runtime checks, and CI are implemented. Production authentication is blocked by the API-owned one-time login exchange and Hub session boundary. No deployment or release process exists.

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

Run `npm run validate` for the full local suite. Run `npm run test:browser` for browser and accessibility checks, and `npm run test:production` for the built Node runtime. Install Chromium once with `npx playwright install chromium`.

## Documentation

- [Product brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Authentication transition](docs/authentication-transition.md)
- [Roadmap](docs/roadmap.md)
- [Phase 0 evidence](docs/phase-0-evidence.md)
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
