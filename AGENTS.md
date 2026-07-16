# AGENTS.md

`@samchon/evidence` is an evidence-graph lint contributor for `@ttsc/lint`. It makes provenance declarable with a JSDoc `@evidence` tag, resolvable against markdown sections and TypeScript symbols, and enforceable as a real compile error under rules the consumer configures in `lint.config.ts`.

## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Evidence precedes correction.** Treat issue reports, review proposals, and claims that something is wrong or missing as hypotheses. Verify the real code path, tests, generated artifacts, upstream ownership, and history before accepting the premise or changing behavior.
- **Trace the consequence surface.** A named file or failing case is the starting point, not the investigation boundary. Follow the same cause through downstream consumers, side effects, state transitions, platforms, and boundary cases, then address the whole verified class of failure within the requested goal.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.
- **Correct the premise before building on it.** This repository generalizes prior art whose behavior is frequently assumed rather than read. When a request rests on a factual claim about `@ttsc/lint`, `autobe-mcp`, or `typia`, verify the claim against that source before designing around it, and say plainly when it does not hold. Building faithfully on a false premise wastes more than asking.
- **Practice what the plugin preaches.** This repository asserts that unproven claims are defects. Hold your own output to that standard: cite the file and line behind a factual claim, mark a guess as a guess, and never let an inference read as a verified fact.

## Skills

Durable project conventions and workflows live under `.agents/skills/`. Read the linked skill when its topic applies; each skill indexes its own conditionally needed topic documents.

### Project Outline

What `@samchon/evidence` is, the workspace layout, package boundaries, and canonical commands, `.agents/skills/project/SKILL.md`. Read when orienting in the repository or choosing a build, test, or format command.

### Evidence Graph

The domain model this product exists to enforce: nodes, edges, the coverage-versus-integrity split, activation gates, and the tag grammar, `.agents/skills/evidence-graph/SKILL.md`. Read before changing rule semantics, the tag grammar, the configuration surface, or any diagnostic message.

### Development

Work rules, testing, validation, consequence analysis, and change integrity, `.agents/skills/development/SKILL.md`. Read before writing or modifying code.

### Lint Rule Authoring

The `@ttsc/lint` contributor contract, the Go rule API, and the traps its defaults set for you, `.agents/skills/lint-rule-authoring/SKILL.md`. Read before adding or modifying a Go rule, touching the plugin descriptor, or changing the published file set.

### Wiki

The `.wiki/` knowledge base: what belongs in it, when to update it, and how it stays honest, `.agents/skills/wiki/SKILL.md`. Read when researching prior art, recording a decision, or discovering that a wiki claim is wrong.

### Documentation

README and guide authoring rules, `.agents/skills/documentation/SKILL.md`. Read before writing or modifying repository documentation.

### Pull Request Submission

Branch, commit, pull request, check, and merge flow, `.agents/skills/pull-request/SKILL.md`. Read when the user explicitly asks to open, submit, update, or merge a pull request, or when a standing autonomous mandate authorizes end-to-end delivery.

## Maintenance

### Writing style

AGENTS.md and SKILL.md files are read by humans as well as agents.

- **Optimize for comprehension, not minimum length.** A shorter document that forces the reader to infer prerequisites, reasons, exceptions, or stop conditions is not concise. Add the context needed to execute correctly.
- **Remove repetition, not substance.** State a rule once at its owner and link to it elsewhere. Keep the rationale when it prevents a plausible mistake.
- **Give each paragraph one job.** Split purpose, rule, rationale, procedure, and consequence when combining them would make the reader unpack a dense block.
- **Use structure as compression.** Use numbered lists for ordered procedures, bullets for choices or checklists, tables for repeated mappings, and code blocks for exact commands. Do not hide a workflow inside one long sentence.
- **State the rule before its reason.** Use negative phrasing only for a named failure mode that the affirmative rule does not already exclude.
- **Skills point, not paraphrase.** Do not restate what the wiki, READMEs, or source comments already say; link to them.
- **Source lines are not paragraphs.** Keep each prose paragraph on one source line and never hard-wrap it, but insert as many blank-line paragraph boundaries as the ideas require.

### Language

Repository artifacts are English: source, tests, AGENTS.md, skills, READMEs, guides, commit messages, and pull requests. The `.wiki/` knowledge base is Korean. Conversation follows the user's language.

### AGENTS.md

This is the single shared entry point for both Claude Code (via `CLAUDE.md -> @AGENTS.md`) and Codex CLI. Keep it to the brief product identity, global attitude, and skill index. The H2s are `## Attitude`, `## Skills`, and `## Maintenance`; `## Attitude` is the one place global agent-behavior rules live.

Update AGENTS.md only for repository-contract changes: a new skill area, a renamed or merged skill, a workflow that no longer fits an existing skill, a release-process change, or a coding-agent rule that applies globally before any skill loads.

### Skills

- **Location.** `.agents/skills/<kebab-name>/SKILL.md`. No numeric prefix. Each file opens with YAML frontmatter whose `name` matches the directory and whose third-person `description` states what the skill covers and when to use it.
- **Core in SKILL.md, conditional topics as sibling documents.** Keep always-applicable procedure in SKILL.md. Move a topic needed only under a specific condition to a one-level-deep sibling document and link it with that read condition.
- **Two trigger surfaces, one scope.** The frontmatter description is the full trigger contract, including exclusions. The AGENTS.md pointer mirrors that scope more briefly. Correct the frontmatter first when the scope changes.
- **Create or merge.** Add a skill when a substantial repository concern would otherwise inflate AGENTS.md beyond an index. Merge sibling concerns when they share most of their structure.
- **Headings are plain.** No chapter numbers in skill or AGENTS.md headings. Use descriptive titles.
- **Current set.** The repository skills are `project`, `evidence-graph`, `development`, `lint-rule-authoring`, `wiki`, `documentation`, and `pull-request`.
