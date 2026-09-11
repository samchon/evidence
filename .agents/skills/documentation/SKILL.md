---
name: documentation
description: Defines Evidence README, guide, issue, and agent-instruction writing. Use before writing or modifying documentation, AGENTS.md, or repository skills.
---

# Documentation

## Readers And Ownership

Start with what the package does, its current availability, installation, and the smallest working path. Distinguish the released/implemented surface from the roadmap. Do not show an unavailable CLI command as working setup.

The root `README.md` is the only editable package README. `scripts/prepare-package.ts` copies it and LICENSE to the package during `prepack`. Keep repository links usable from npm as well as GitHub. Review the copy script when changing documentation preparation; do not introduce package-installation tests.

Keep detailed future guides organized by their reader and task. Do not invent a website tree or claim that ttsc's website is this package's documentation host. Link to upstream for the compatibility baseline and explain standalone differences where they affect an author.

## Operational Instructions

Keep global attitude and routing in AGENTS.md, the core procedure in SKILL.md, and conditional details in a linked sibling document. The frontmatter description is the trigger contract; the AGENTS.md index mirrors it briefly.

State requirements with enough context to act. Keep one owner for each rule, and remove repetition rather than necessary reasons, boundaries, or failure handling. A skill does not grant permission to publish, push, merge, or contact others beyond the user's existing request.

## Writing

Write repository documents, issues, and PRs in English. Use plain language, concrete names, and active voice. Avoid emoji, em dashes, filler adjectives, and closing sentences that only repeat the paragraph.

Write each Markdown paragraph on one source line; separate distinct ideas with blank lines. Preserve structural line breaks in lists, tables, and code. The formatter uses `proseWrap: never` and leaves fenced examples unchanged.

Use lists for sequential steps or parallel checks and tables for repeated mappings. Include exact commands only when supported by the repository. Read the final diff/rendered output and run executable examples when their behavior is part of the change.
