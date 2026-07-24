---
name: pull-request
description: Defines @samchon/lint-plugin-evidence branch, commit, pull-request, check, and merge workflow. Use when the user explicitly asks to open, submit, update, or merge a pull request, or when a standing autonomous mandate authorizes end-to-end delivery; never open, push, update, or merge one on unprompted initiative.
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

Open the body with a file-backed `--body-file` when the Markdown is multiline; `gh` mangles a multiline `--body` string. The opening body is the historical intent statement, so do not rewrite it after every follow-up push.

Record later findings — CI fixes, a design issue you noticed after opening, and every Self-Review round below — as formal GitHub pull-request reviews with the `COMMENT` event, so the thread keeps its chronology. Put a line-specific observation in an inline review comment and a change-wide result in the review body. Never `APPROVE` or `REQUEST_CHANGES` on your own pull request, and do not use ordinary issue-style comments for this ledger.

## Watch Checks After Every Push

Push, then watch the checks. A red check is yours to fix or explain before asking for review; leaving it for the reviewer to discover wastes their pass.

## Re-Check A Base That Moved

A green check proves the branch agrees with the base it was cut from, never with the base it lands on. When the target branch has moved since the last run, update the branch and let the checks run again before merging.

Textual mergeability is not semantic mergeability. Two changes conflict in git only when they edit the same lines, so a branch that adds a file importing a module another branch deleted merges clean, reports green, and breaks the target — the compiler is the first thing to notice, and only after the merge.

This matters most when several pull requests are open at once, which is exactly when the temptation to merge a still-green check is strongest.

## Self-Review Before Merge

A merge is gated on one clean Overall Self-Review, a solo pass you perform yourself over the whole change. Do not delegate it, and do not treat a green check as a substitute — CI proves the tests that exist pass, not that the change is right.

A round is complete only when it covers the entire surface:

- **Whole diff.** Read every changed file and hunk of the base-to-head diff, plus any uncommitted change. Never partition by file, concern, or pass.
- **Consequence surface.** Trace each change through its callers, tests, generated output, packaging, documentation, and consumers, and across Windows and POSIX. This is the development skill's Consequence Analysis turned on your own diff.
- **Reproduce before accepting.** Confirm a suspected defect against the real code path before acting on it. This product treats an unproven claim as a defect, and a self-review finding is a claim.
- **Fresh rounds, no limit.** Whenever a round changes anything, run the narrowest verification the development skill authorizes and start another complete round from the new state. Stop only when a full round finds nothing sound to change.

Record the outcome as a `COMMENT` review per the ledger rule above: the surviving findings and their fixes, the final clean round, and any verification that could not run.

## Merge On Explicit Request Or Standing Mandate

Merge only when the user asks or a standing mandate authorizes it, and only with required checks green and one clean Overall Self-Review round on record. Use the repository's established merge method unless another is specified. If branch protection blocks the requested merge, report the blocker rather than bypassing it.

## Contributing Upstream To ttsc

An upstream `ttsc` change follows `ttsc`'s own rules, not these. Read its `AGENTS.md`, then its `project` and `development` skills, before touching that repository. Two of its constraints catch newcomers: website docs under `website/src/content/docs/` must be updated in the same change as any behavior change, and its tests, fixtures, CI, and generated baselines are specification whose modification needs explicit justification in the final report.

Prefer a local design that needs no upstream change. This plugin reads markdown from disk inside a project-scoped rule precisely so it does not depend on an upstream release; see `.wiki/design/decisions.md`.
