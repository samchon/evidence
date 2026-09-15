---
name: issue-campaign
description: Defines broad Evid issue discovery, detailed English handoffs, and authorized issue-to-implementation campaigns. Use for broad audits or repeated campaigns, not one already-defined issue or an ordinary PR.
---

# Issue Campaign

## Scope And Discovery

Read the project and review skills. Establish the requested scope and phase boundary: investigation, issue publication, implementation, PR submission, or merge. Do not treat authorization for one phase as authorization for later external actions.

For a sustained campaign, keep a concise ledger under `.wiki/<campaign>` with the inspected commit, candidate evidence, reproductions, decisions, issue dependencies, and validation state. Preserve existing notes. Published issues must stand alone without this local ledger.

Audit the complete declared scope before deciding which findings survive. Verify current behavior, root cause, upstream ownership, related open/closed decisions, and the consequence surface. Record accepted, combined, rejected, deferred, or blocked candidates with reasons. For an explicitly exhaustive campaign, repeat full discovery rounds until a fresh round contributes no further verified candidate.

## English Issue Handoffs

Give each issue enough context for a contributor to act without reading the conversation. Include:

- the problem, intended behavior, and affected users;
- actual reproduction or product requirement with source references;
- implementation boundaries and compatibility decisions;
- positive, negative, and boundary acceptance criteria;
- concrete verification commands or fixture scenarios; and
- dependencies and related work.

Inspect existing issues before publishing duplicates. Use a structured API body or a UTF-8 file with `gh --body-file`, then read back the published body. Keep issue numbers and identities stable. Correct implementation ordering in the roadmap rather than shifting unrelated contents between existing issue numbers.

## Implementation

When implementation is authorized, read [development.md](development.md). A request to implement one named issue remains that issue plus the user's explicit additions; it does not start the rest of the backlog.
