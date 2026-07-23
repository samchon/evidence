---
name: wiki
description: Defines the .wiki/ knowledge base for @samchon/evidence-graph — what belongs in it, its Korean and no-wrap writing rules, and the obligation to correct it the moment a claim proves false. Use when researching prior art, recording an architectural decision, or discovering that a wiki claim is wrong; do not use for user-facing documentation, which the documentation skill owns.
---

# Wiki

## Why It Exists

This project is built by reading three large codebases that no one holds in memory at once. Research that lives only in a conversation is lost when that conversation ends, and the next agent re-derives it — differently, and sometimes wrongly. `.wiki/` is where a finding becomes durable.

It is an internal knowledge base, not documentation. Its audience is whoever works on this repository next, including you.

## What Belongs

- **`.wiki/references/<project>.md`** — what a prior-art project actually does. One file per project.
- **`.wiki/design/decisions.md`** — what this repository decided, why, and what it gave up.

A page holds **distilled conclusions, not transcripts**. If a paragraph would not change what a reader does next, it does not belong.

## Writing Rules

- **Korean.** The wiki is the one Korean artifact in an English repository; see the Language section of AGENTS.md.
- **Never hard-wrap.** One paragraph is one source line, with as many blank-line paragraph breaks as the ideas require.
- **Cite as `path/to/file.ts:42`** so any claim can be re-verified at its source.
- **Mark a guess as a guess.** Write `미검증` on anything not read directly. An inference that reads as a fact is the specific failure this file exists to prevent.
- **One topic per file, short enough to re-read whole.**
- **Delete rot rather than let it sit.**

## The Honesty Obligation

**A stale wiki is worse than no wiki, because it is confidently wrong.** A reader trusts it precisely when they lack the context to catch the error.

When you discover a wiki claim is false, correct the page **in the same change as the discovery**, never as follow-up work. A decision that gets reversed is not deleted: mark it reversed and record why, because the reversal is what stops the next person from re-walking the same dead end.

## Recording A Decision

Every entry in `decisions.md` states **what** was decided, **why**, and **what it cost**. The cost line is not optional. A decision recorded without its trade-off reads as free, and the next reader will not know what to re-examine when the trade-off starts hurting.

Keep an explicit open-questions list. An unknown that is written down gets resolved; one that is merely felt gets rediscovered.
