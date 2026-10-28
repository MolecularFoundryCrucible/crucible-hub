# Crucible Hub

Crucible Hub is the web workspace for the Molecular Foundry's [Crucible](https://crucible.lbl.gov) data platform. Researchers use it to find, inspect, organize, share, upload, and manage their samples, datasets, projects, and instruments.

## What you can do

- Browse and search samples and datasets across projects and instruments, with filters, grouping, and a quick preview panel.
- Open a resource to see its summary, identity, files, thumbnails, scientific metadata, and relationships, and explore its neighbours as a graph.
- Edit descriptions and metadata, link related resources, upload files, and request deletions, where your permissions allow.
- Manage projects, members, access, ownership, and instrument lifecycles, with platform administration for authorized staff.

The Crucible API decides what each person may see and do; the Hub presents those decisions and never grants access itself.

## Status

Most planned workflows are implemented and run locally against demo fixtures, a staging API, or ORCID sign-in. The production pilot at `https://crucible.lbl.gov/hub/` is open to everyone with a Crucible account, who signs in with ORCID; [the release guide](docs/cloud-run-pilot.md) explains how releases are built and published, and the [roadmap](docs/roadmap.md) tracks what remains.

## Try it locally

You need Node.js 22.22 and npm 10.9.

```bash
npm ci
npm run dev:fixtures
```

Then open <http://127.0.0.1:3000/hub/>. Fixture mode uses built-in demo data, so no account or API access is needed.

## Work against a real API

Each development scenario picks how you sign in and which API the Hub talks to:

| Command                     | Sign-in      | API                               |
| --------------------------- | ------------ | --------------------------------- |
| `npm run dev:fixtures`      | None (demo)  | None                              |
| `npm run dev:api-local`     | Your API key | Local HTTPS API                   |
| `npm run dev:api-staging`   | Your API key | Staging API                       |
| `npm run dev:api-main`      | Your API key | Production API                    |
| `npm run dev:orcid-local`   | ORCID        | Local HTTPS API through Tailscale |
| `npm run dev:orcid-staging` | ORCID        | Staging API through Tailscale     |

API-key scenarios act as you and can change real data, so prefer staging and test resources. Credentials stay on the Hub server and never reach the browser. The [contributor guide](CONTRIBUTING.md#development-scenarios) explains where to put your key or ORCID client secret and how each scenario is configured.

## Everyday commands

| Command                   | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `npm run validate`        | Full check: formatting, lint, types, unit tests, contracts, and build |
| `npm run validate:static` | The same checks without the production build                          |
| `npm run test:browser`    | Browser, accessibility, and workflow tests in Chromium                |
| `npm run test:production` | Builds the app and checks the production Node server                  |

Install Chromium once with `npx playwright install chromium`. The [contributor guide](CONTRIBUTING.md) lists every command.

## How it is built

The Hub is a TypeScript app on [TanStack Start](https://tanstack.com/start) with React, TanStack Router and Query, Tailwind CSS, and shadcn components on Base UI. It is a backend for the frontend: browser code calls Hub server functions, which hold the session and call the Crucible API through a client generated from its OpenAPI contract. It deploys as a single container: on Google Cloud Run for the pilot, or [self-hosted with Docker Compose](deploy/compose/README.md) next to a self-hosted Crucible API.

## Documentation

Product and design:

- [Product brief](docs/product-brief.md): who the Hub is for and what it must do
- [Information architecture](docs/information-architecture.md): routes, navigation, and page structure
- [Design system](docs/design-system.md): visual, interaction, motion, and accessibility rules
- [Administration workspace](docs/administration-workspace.md): platform administration design

Engineering:

- [Architecture](docs/architecture.md): runtime, security boundaries, and data flow
- [API integration](docs/api-integration.md): API contract, caching, pagination, and invalidation
- [Authentication transition](docs/authentication-transition.md): ORCID sign-in and sessions
- [Design fixtures](docs/design-fixtures.md): the demo data scenarios
- [Architecture decisions](decisions/README.md): durable choices and their reasons

Delivery and operations:

- [Roadmap](docs/roadmap.md): status and ordered work
- [Foundation evidence](docs/phase-0-evidence.md): verification evidence for production readiness
- [Releases and the Cloud Run pilot](docs/cloud-run-pilot.md)
- [Self-hosting with Docker Compose](deploy/compose/README.md)
- [Crucible API handoff](docs/crucible-api-handoff.md) and [resource graph API handoff](docs/resource-graph-api-handoff.md): requests owned by the API team
- [Changelog](CHANGELOG.md)

Working on the code:

- [Contributor guide](CONTRIBUTING.md): setup, scenarios, commands, and review
- [Agent guide](AGENTS.md): rules for AI coding agents, also a concise summary of repository policy
- [Skills](skills/README.md): AI agent skills used in this repository

## Related repositories

The Hub follows the API contract owned by `crucible-api` and the cross-repository policy in `crucible-ecosystem`. It borrows interaction lessons from `crucible-lens` and is converging with `crucible_graph_explorer`. `nano-crucible` remains the Python and command-line interface.

## License

Crucible Hub is released under the [BSD 3-Clause License](LICENSE), copyright the Crucible Development Team. The license covers the source code only: the Crucible and Molecular Foundry names and logos (`src/assets/`, `src/logo.svg`, and the brand icons in `src/components/crucible/brand-icons.tsx`) identify the project and may not be used to endorse or promote derived products, and the ORCID iD icon is used under ORCID's brand guidelines.

The UI primitives in `src/components/ui/` are generated from [shadcn/ui](https://github.com/shadcn-ui/ui) and the agent skill in `.agents/skills/shadcn/` is vendored from it; shadcn/ui is MIT licensed, Copyright (c) 2023 shadcn. Other dependencies keep their own licenses, listed in `package-lock.json`.

To report a security issue, follow [SECURITY.md](SECURITY.md).
