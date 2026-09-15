# AGENTS.md

`evid` is a standalone Evidence Graph checker being built in TypeScript with upstream Tree-sitter WASM. The pnpm workspace contains the published package in `packages/evid` and its logic unit-test workspace in `test`.

## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Work with initiative inside the requested goal. Do not replace a specific task with a repository-wide campaign.
- **Match the user's language.** Communicate in Korean or English as the user does. Repository documentation, issues, and pull requests use English unless requested otherwise.
- **Choose the principled course.** Decide from evidence, correctness, product boundaries, and consequences. Difficulty is a reason to investigate, not to weaken the contract.
- **Evidence precedes correction.** Verify reports against the actual code, tests, artifacts, upstream behavior, and history before changing behavior.
- **Trace the consequence surface.** Follow a verified cause through consumers, state transitions, platforms, and failure/recovery paths.
- **Default over ask.** Resolve routine choices from the existing context. Preserve authorization already given in the conversation.

## Skills

Durable conventions live under `.agents/skills/`. Read the linked skill when its topic applies. Conditional procedures belong in the skill's linked sibling documents.

- [Project](.agents/skills/project/SKILL.md): workspace layout, current product boundaries, dependencies, and canonical commands.
- [Development](.agents/skills/development/SKILL.md): implementation, test, validation, and change-integrity rules. Read before changing code, package wiring, or CI.
- [Documentation](.agents/skills/documentation/SKILL.md): prose, source JSDoc, implementation comments, test scenarios, and agent instructions. Read before editing documentation, source comments, or skills.
- [Evidence Graph](.agents/skills/project/evidence/SKILL.md): units, targets, coverage, exclusions, reviews, and parser completeness. Read before changing graph semantics, configuration contracts, adapters, or diagnostics.
- [Review](.agents/skills/review/SKILL.md): solo review of the whole declared change and its consequences. Use for ordinary review and self-review.
- [Pull Request](.agents/skills/pull-request/SKILL.md): branches, commits, submission, checks, and merge boundaries. Use when the corresponding delivery action is authorized.
- [Issue Campaign](.agents/skills/issue-campaign/SKILL.md): broad discovery and issue-to-implementation campaigns. Do not use for one already-defined issue or an ordinary PR.
- [Multi-Agent](.agents/skills/multi-agent/SKILL.md): explicitly requested parallel review or implementation. Do not load merely because several tasks exist.
- [Discussion](.agents/skills/discussion/SKILL.md): explicitly requested structured discussion with persistent conclusions. Ordinary questions and code review do not require it.
- [Benchmark](.agents/skills/benchmark/SKILL.md): measurement integrity, workload definitions, and result reporting. Use when measuring or publishing performance or coverage results.

## Maintenance

This file is the shared entry point for Codex and Claude Code; `CLAUDE.md` points here. Keep it to product identity, global attitude, and the skill index.

Keep repository skills under `.agents/skills/<topic>/SKILL.md`, with unique kebab-case frontmatter names and third-person descriptions stating their scope and trigger. The nested `project/evidence` skill uses the name `evidence-graph`. Keep operational rules in their owning skill and link to them elsewhere. Use sibling documents for substantial conditional procedures; do not add UI metadata or empty resource directories.

The skill structure and shared conventions are adapted from [samchon/ttsc](https://github.com/samchon/ttsc/tree/14a22f077caf23f1bfb8a97b3d9db765912074ef/.agents/skills). Keep changes appropriate to this standalone TypeScript/WASM project; compiler plugins, Go shims, and ttsc-specific benchmark operations are not this repository's implementation model.

Apply the [documentation principles](.agents/skills/documentation/SKILL.md) to every skill and supporting instruction file. Keep each rule in one owning file and link to it from other workflows.
