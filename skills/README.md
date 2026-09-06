# Crucible Hub skills

This file defines the lifecycle and routing rules for repository-local and installed skills. Repository architecture, security, design, API, contributor, and validation rules remain in [`AGENTS.md`](../AGENTS.md) and the authoritative documents it names.

## Current routing

- The project-installed `shadcn` skill is at [`.agents/skills/shadcn/SKILL.md`](../.agents/skills/shadcn/SKILL.md) and applies to shadcn/ui, `components.json`, registry, and component work.
- TanStack skills are loaded from installed package versions with the managed commands in [`AGENTS.md`](../AGENTS.md). Do not vendor a separate TanStack skill tree.
- No Hub-authored workflow skill is active unless a corresponding `SKILL.md` exists and [`AGENTS.md`](../AGENTS.md) routes matching work to it. A name in a planning document is not an active skill.

When several skills apply, use the narrowest relevant skill and load additional skills only when the work spans their boundaries. A skill routes work through authoritative documentation; it does not replace that documentation or authorize live mutations.

## External skill updates

Do not update external skills during ordinary work without review. Check currency when a skill is about to be used and its last review is more than 30 days old, when a relevant framework or major version changes, when guidance conflicts with current official documentation, when Phase 0 or security-sensitive work begins, when a release is prepared, or when an advisory requests earlier review.

For a project-installed skill, use the supported installer, then review the complete skill and lockfile diff, including commands, permissions, network access, generated files, and assumptions. For a developer-scoped skill, use the Codex installer and do not rewrite another contributor's user-level installation without authorization. A currency check reports updates but does not apply them.

After an accepted update:

1. Run the skill registry listing and confirm only intended skills are installed.
2. Validate the lockfile and inspect every changed skill file.
3. Update the recorded review date in the relevant project record.
4. Recheck routing and authority boundaries.
5. Add an `Unreleased` changelog entry when contributor behavior, commands, permissions, or generated output changes.

## Local skill lifecycle

An unimplemented workflow is not a skill. Add a local skill only after its workflow, entry points, ownership boundary, safety restrictions, documentation authority, and focused and full validation commands are stable.

Each local skill progresses through:

1. `Planned`: the workflow is identified but no `SKILL.md` exists.
2. `Active`: the `SKILL.md` exists, commands are verified, and [`AGENTS.md`](../AGENTS.md) routes matching work to it.
3. `Deprecated`: a replacement or removal path is documented and discovery no longer routes new work to it.
4. `Removed`: the directory and compatibility references are deleted.

Review an active skill when the framework major version, repository architecture, source layout, validation commands, security boundary, design contract, API contract, or deployment procedure changes. Ordinary feature additions do not require skill edits when the established workflow remains valid. Promoting, materially changing, deprecating, or removing an active skill changes contributor workflow and requires an `Unreleased` changelog entry.
