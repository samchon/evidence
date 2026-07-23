---
name: documentation
description: Defines README, guide, and agent-instruction structure, audience, concise prose, and voice for @samchon/evidence. Use before writing, modifying, renaming, or moving user-facing repository documentation, AGENTS.md, or any SKILL.md; do not use for the .wiki knowledge base, which the wiki skill owns.
---

# Documentation

## Audience

A reader arrives asking one of two questions, and the documentation must not mix them.

- **"Should I use this?"** — the README's job. What the plugin enforces, what a violation looks like, and what it costs to adopt.
- **"How do I configure this?"** — the guide's job. The tag grammar, the rule set, and the `lint.config.ts` surface.

Assume the reader knows TypeScript and has met a linter. Do not assume they have heard of `autobe-mcp`, evidence graphs, or `ttsc` plugin internals.

## READMEs

Open with what the product does in one paragraph, then show a violation and its diagnostic before any configuration. A reader decides from the error message, because that is the part they will live with.

State the adoption cost honestly and early: this is a `@ttsc/lint` contributor, so it requires `ttsc`, not stock `tsc` with ESLint. A reader who discovers that on line 200 has wasted their time and will resent it.

## Agent Instructions

AGENTS.md and SKILL.md files are operational documents for humans and agents. Keep the product-wide contract in AGENTS.md, the always-applicable procedure in a SKILL.md, and conditional detail in a linked sibling document. AGENTS.md structure — its H2s, the skill index, and the maintenance contract — is governed by AGENTS.md itself; this section governs how the prose inside both file kinds reads.

- **Optimize for comprehension, not minimum length.** A shorter document that forces the reader to infer prerequisites, reasons, exceptions, or stop conditions is not concise. Add the context needed to execute correctly.
- **Remove repetition, not substance.** State a rule once at its owner and link to it elsewhere. Keep the rationale when it prevents a plausible mistake.
- **Give each paragraph one job.** Split purpose, rule, rationale, procedure, and consequence when combining them would make the reader unpack a dense block.
- **Use structure as compression.** Use numbered lists for ordered procedures, bullets for choices or checklists, tables for repeated mappings, and code blocks for exact commands. Do not hide a workflow inside one long sentence.
- **State the rule before its reason.** Use negative phrasing only for a named failure mode that the affirmative rule does not already exclude.

The Voice section's "do not restate; link instead" rule applies here too: an agent-instruction file points at the wiki, a README, or a source comment rather than paraphrasing it.

## Prose

- **Source lines are not paragraphs.** Keep each prose paragraph on one source line and never hard-wrap it, but insert as many blank-line paragraph boundaries as the ideas require.
- Show a real, runnable example over describing one. Every code block must be something a reader could paste.
- Name the trade-off where one exists. Documentation that only sells is documentation nobody trusts twice.

## Voice

Explain the rule, then its reason. The reason is what makes an evidence rule tolerable rather than bureaucratic — a reader who understands why a citation must exist writes real ones, and a reader who does not writes filler that satisfies the parser.

Do not restate what the source comments, the wiki, or upstream `ttsc` guides already say; link to them instead.

Write in the plain, direct voice of the human-authored docs in this repo. Do not write like an AI assistant.

- No emoji.
- No AI-cliche phrasing: "not only X but also Y", "whether you're X or Y", "it's worth noting", "let's dive in", filler adjectives like "seamless", "powerful", "robust", "effortless", and reflexive hedging.
- No wrap-up sentence that only restates the paragraph. State the fact and stop.
- Em-dashes are house style here, setting off a clause or an aside; keep them. `ttsc`'s documentation skill bans them, and that one rule does not carry over — the rest of its voice discipline does.

## Keeping It True

When behavior changes, update the matching documentation in the same change. A guide describing a rule that no longer behaves that way is worse than no guide, for the same reason a stale wiki is: the reader trusts it exactly when they cannot check it.
