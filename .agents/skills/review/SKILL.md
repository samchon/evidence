---
name: review
description: Defines solo Evidence self-review and ordinary code review across the complete declared change. Use before submitting a PR or when reviewing code; explicit parallel reviews use the multi-agent skill.
---

# Review

## Whole-Surface Review

Review the entire declared diff and its consequences yourself. An unqualified review does not request subagents. Read every changed file and hunk, then follow affected public types, source paths, tests, generated artifacts, package contents, documentation, and consumers.

Treat suspected defects as hypotheses. Verify them against the actual behavior and authoritative contract before accepting a finding. A test passing does not establish that its denominator or expected output was correct.

Complete a review round before repairing its findings. Collect the supported findings, fix them together, and review the complete resulting diff again. A clean result needs a full pass with no remaining verified defect; rereading only the latest correction does not cover the integrated change.

## Evidence-Specific Questions

- Can loading or extraction fail while a check still reports success?
- Can aliases, merged declarations, or host positions duplicate or lose an obligation?
- Can a review be counted as evidence or invalidate its own fingerprint?
- Can cwd, Unicode, case, symlinks, or CRLF change target identity unexpectedly?
- Does the packed package contain everything its exports, bin, and asset registry promise?
- Do docs and skills describe actual commands and current implementation status?
- Do tests exercise the failure direction as well as the happy path?

For the scaffold, concentrate on explicit failure for unavailable checks, inert imports, peer resolution, root README propagation, clean builds, and independent-consumer installation. Do not invent missing graph features as defects in a foundation-only PR.

## Reporting

Lead with concrete findings and their consequences. Include a location, triggering case, and supporting evidence; label uncertain claims. Report the checks run and remaining limits. Keep a clean review concise rather than creating findings to fill a quota.

Self-review does not authorize posting a formal GitHub review or merging a PR. Follow the authorized delivery scope in the pull-request skill. Use [multi-agent](../multi-agent/SKILL.md) only for an explicitly requested parallel review.
