# Crucible Hub

Crucible Hub is the web workspace for [Crucible](https://crucible.lbl.gov), the Molecular Foundry's scientific data platform. Researchers use it to find, inspect, organize, share, upload, and manage their samples, datasets, projects, and instruments.

- Browse and search samples and datasets with filters, grouping, and a quick preview.
- See a resource's summary, files, thumbnails, metadata, and relationships, and explore its neighbours as a graph.
- Edit metadata, link resources, upload files, and manage projects, members, and access where your permissions allow.

The Hub is a front end for the Crucible API: the API decides what each person may see and do, and people sign in with ORCID through it. The Molecular Foundry's instance runs at <https://crucible.lbl.gov/hub/> for everyone with a Crucible account.

## Run your own Hub

Each release is published as a container image for amd64 and arm64:

```text
ghcr.io/molecularfoundrycrucible/crucible-hub:<version>
```

The Crucible API is not yet publicly released, so for now self-hosting is open to groups that have access to it. You need:

- A Crucible API, release 3.2.0 or later (each image's `gov.lbl.crucible.api.min-version` label names the oldest it supports), with Hub sign-in configured: your Hub's callback `https://<your address>/hub/auth/callback` allowed, a client secret shared with the Hub, and ORCID sign-in registered for the API.
- HTTPS in front of both, at one address: the API under `/api/v3/` and the Hub under `/hub/`.
- Docker with Compose v2.20 or later.

The [self-hosting guide](deploy/compose/README.md) runs the Hub with its own session database, either on the same machine as the API's Compose bundle or on a separate one, and lists every setting and secret.

## Try it without an API

You need Node.js 22.22 and npm 10.9.

```bash
npm ci
npm run dev:fixtures
```

Open <http://127.0.0.1:3000/hub/>. Fixture mode uses built-in demo data, so no account or API is needed.

## Develop

Other scenarios connect the dev server to a real API with your API key (`dev:api-local`, `dev:api-staging`, `dev:api-main`) or with ORCID sign-in (`dev:orcid-local`, `dev:orcid-staging`). API-key scenarios act as you and can change real data, so prefer staging. Before opening a pull request, run `npm run validate`.

The [contributor guide](CONTRIBUTING.md) covers credentials, scenarios, tests, and review; [AGENTS.md](AGENTS.md) holds the rules for AI coding agents.

The Hub is a TypeScript app on [TanStack Start](https://tanstack.com/start) (React, TanStack Router and Query, Tailwind CSS, shadcn on Base UI). Browser code calls Hub server functions, which hold the session and call the API through a client generated from its OpenAPI contract.

## Documentation

- Product: [brief](docs/product-brief.md), [information architecture](docs/information-architecture.md), [design system](docs/design-system.md), [administration](docs/administration-workspace.md)
- Engineering: [architecture](docs/architecture.md), [API integration](docs/api-integration.md), [authentication](docs/authentication-transition.md), [demo fixtures](docs/design-fixtures.md), [decisions](decisions/README.md)
- Delivery: [roadmap](docs/roadmap.md), [releases](docs/cloud-run-pilot.md), [changelog](CHANGELOG.md), [requests to the API team](docs/crucible-api-handoff.md)

## License

Released under the [BSD 3-Clause License](LICENSE), copyright the Crucible Development Team. The license covers the source code only: the Crucible and Molecular Foundry names and logos (`src/assets/`, `src/logo.svg`, and the brand icons in `src/components/crucible/brand-icons.tsx`) may not be used to endorse or promote derived products, and the ORCID iD icon is used under ORCID's brand guidelines. The UI primitives in `src/components/ui/` and the agent skill in `.agents/skills/shadcn/` come from [shadcn/ui](https://github.com/shadcn-ui/ui) (MIT, Copyright (c) 2023 shadcn). Other dependencies keep their own licenses, listed in `package-lock.json`.

Report security issues as described in [SECURITY.md](SECURITY.md).
