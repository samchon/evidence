---
name: documentation
description: Defines README and guide structure, audience, prose formatting, and voice for @samchon/evidence. Use before writing, modifying, renaming, or moving user-facing repository documentation; do not use for the .wiki knowledge base, which the wiki skill owns.
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

## Prose

- **Source lines are not paragraphs.** Keep each prose paragraph on one source line and never hard-wrap it, but insert as many blank-line paragraph boundaries as the ideas require.
- Show a real, runnable example over describing one. Every code block must be something a reader could paste.
- Name the trade-off where one exists. Documentation that only sells is documentation nobody trusts twice.

## Voice

Explain the rule, then its reason. The reason is what makes an evidence rule tolerable rather than bureaucratic — a reader who understands why a citation must exist writes real ones, and a reader who does not writes filler that satisfies the parser.

Do not restate what the source comments, the wiki, or upstream `ttsc` guides already say; link to them instead.

## Keeping It True

When behavior changes, update the matching documentation in the same change. A guide describing a rule that no longer behaves that way is worse than no guide, for the same reason a stale wiki is: the reader trusts it exactly when they cannot check it.
