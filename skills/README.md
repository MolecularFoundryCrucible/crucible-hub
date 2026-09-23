# Crucible Hub skills

The repository uses externally maintained skills only:

- [shadcn](../.agents/skills/shadcn/SKILL.md) applies to shadcn components, registries, styling, and `components.json`. Update it with `npx skills add shadcn/ui`, not by editing installed files.
- TanStack skills come from the installed package versions. List them with `npm run skills:list` and load a matching skill with `npm run skills:load -- <package>#<skill>`.

No Hub-authored workflow skill is active. Planning documents and directory names do not activate a skill.

Use the narrowest matching skill. Skills supplement [`AGENTS.md`](../AGENTS.md) and the authoritative product or architecture document; they do not replace repository policy or authorize live actions.

Before adding a repository skill, confirm that it captures a stable, repeated workflow with non-obvious repository-specific guidance. Do not restate framework documentation, `AGENTS.md`, or another authoritative document.

Do not hand-edit an installed external skill. Review installer and lockfile changes before accepting an update. Add an `Unreleased` changelog entry only when a skill change alters contributor workflow, commands, permissions, or generated output.
