---
name: pull-request
description: Defines @samchon/evidence branch, commit, pull-request, check, and merge workflow. Use when the user explicitly asks to open, submit, update, or merge a pull request, or when a standing autonomous mandate authorizes end-to-end delivery; never open, push, update, or merge one on unprompted initiative.
---

# Pull Request Submission

## Authority

Open, push, or merge a pull request only on an explicit request or a standing autonomous mandate from the user. Never on unprompted initiative. A mandate covers the work it names and does not widen to whatever the change turns out to touch.

## Branch From The Target

Branch from the branch you intend to merge into, not from whatever is checked out. Name the branch for the change, not the author or the day.

## Commit Logical Units

One commit is one reviewable idea. Research, decision records, and the implementation they justify may share a commit when they are one idea; unrelated cleanup never joins them.

Run `pnpm format` before every ordinary commit and stage the result.

Write the message so it explains why the change exists, not what the diff already shows.

## Write The Pull Request

The body states what changed, why, and what was verified — naming the commands run and any that could not be. A pull request that claims a behavior without naming how it was observed is asking the reviewer to take it on faith, which is the exact failure this product exists to prevent.

Call out anything in the Change Integrity list explicitly: tests, fixtures, CI, package wiring, dependencies, core algorithms. See the development skill.

## Watch Checks After Every Push

Push, then watch the checks. A red check is yours to fix or explain before asking for review; leaving it for the reviewer to discover wastes their pass.

## Merge On Explicit Request Or Standing Mandate

Merge only when the user asks or a standing mandate authorizes it, and only with checks green.

## Contributing Upstream To ttsc

An upstream `ttsc` change follows `ttsc`'s own rules, not these. Read its `AGENTS.md`, then its `project` and `development` skills, before touching that repository. Two of its constraints catch newcomers: website docs under `website/src/content/docs/` must be updated in the same change as any behavior change, and its tests, fixtures, CI, and generated baselines are specification whose modification needs explicit justification in the final report.

Prefer a local design that needs no upstream change. This plugin reads markdown from disk inside a project-scoped rule precisely so it does not depend on an upstream release; see `.wiki/design/decisions.md`.
