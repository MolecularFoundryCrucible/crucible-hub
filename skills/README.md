# Crucible Hub skills

Skills give AI coding agents focused, version-matched guidance for the frameworks this repository uses. They supplement [`AGENTS.md`](../AGENTS.md) and the authoritative product and architecture documents; they never replace repository policy or authorize live actions.

The repository uses externally maintained skills only. No Hub-authored skill is active, and planning documents or directory names do not activate one.

## Which skill to load

Load the narrowest skill that matches the change before editing.

| Change                                                                 | Skill                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/components/ui` primitives, `components.json`, shadcn registry use | `shadcn`                                                        |
| Links, navigation, and `useNavigate`                                   | `@tanstack/router-core#router-core/navigation`                  |
| Route loaders, pending states, and preloading                          | `@tanstack/router-core#router-core/data-loading`                |
| Search parameter validation and URL state                              | `@tanstack/router-core#router-core/search-params`               |
| Code splitting and `lazyRouteComponent`                                | `@tanstack/router-core#router-core/code-splitting`              |
| Not-found and error boundaries                                         | `@tanstack/router-core#router-core/not-found-and-errors`        |
| Server functions and their validation                                  | `@tanstack/start-client-core#start-core/server-functions`       |
| Request and server-function middleware                                 | `@tanstack/start-client-core#start-core/middleware`             |
| What runs on the server, the client, or both                           | `@tanstack/start-client-core#start-core/execution-model`        |
| Sessions, cookies, and server-side auth primitives                     | `@tanstack/start-client-core#start-core/auth-server-primitives` |
| Server rendering and streaming                                         | `@tanstack/router-core#router-core/ssr`                         |

Run `npm run skills:list` for the full list. TanStack Query and TanStack Form do not ship skills; use their official documentation.

## Loading skills

- `shadcn` lives in [`.agents/skills/shadcn`](../.agents/skills/shadcn/SKILL.md), with a `.claude/skills/shadcn` link so Claude Code discovers it natively. Other agents read it from `.agents/skills`.
- TanStack skills ship inside the installed npm packages, so they always match the versions in `package-lock.json`. Load one with `npm run skills:load -- <package>#<skill>`, for example `npm run skills:load -- @tanstack/router-core#router-core/data-loading`. Use the local script rather than the `npx @tanstack/intent@latest` commands the list prints, so the loader matches the installed version.

## Updating skills

- `shadcn`: run `npx skills update -p -y shadcn` from the repository root. Review the changed files and the `skills-lock.json` hash before committing, and read any new scripts. Never hand-edit installed files, even to fix an upstream mistake; report it upstream instead.
- TanStack: skills update with their packages. `npm run skills:stale` reports stale sources without changing anything, and CI runs it.

Add an `Unreleased` changelog entry only when a skill change alters contributor workflow, commands, permissions, or generated output.

## Adding a repository skill

Add a Hub-authored skill only for a stable, repeated workflow with non-obvious repository-specific guidance, such as a multi-step release or contract-regeneration procedure. Do not restate framework documentation, `AGENTS.md`, or another authoritative document; link to them instead. Keep the `SKILL.md` description specific about when the skill applies, keep the body short, and put long reference material in separate files the skill links to.
