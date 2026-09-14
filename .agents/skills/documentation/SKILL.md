---
name: documentation
description: Defines Evidence prose, source JSDoc, implementation comments, test scenario documentation, and agent instructions. Use before writing or modifying documentation, source comments, AGENTS.md, or repository skills.
---

# Documentation

## Readers And Ownership

Write README as the completed product's user guide: purpose, installation, configuration, and usage. Do not include issue or roadmap links, implementation progress, or milestone commentary. Keep delivery status and validation results in the PR.

Document configuration in README only through `evidence.config.ts`. Do not advertise JSON configuration or alternative config file formats there.

The root `README.md` is the only editable package README. `scripts/copy-readme-and-license.js` copies it and LICENSE to the package during `prepack`. Keep repository links usable from npm as well as GitHub. Review the copy script when changing documentation preparation; do not introduce package-installation tests.

Organize guides by their reader and task. Do not invent a website tree or claim that ttsc's website is this package's documentation host. Link to upstream for the compatibility baseline and explain standalone differences where they affect an author.

## Operational Instructions

Keep global attitude and routing in AGENTS.md, the core procedure in SKILL.md, and conditional details in a linked sibling document. The frontmatter description is the trigger contract; the AGENTS.md index mirrors it briefly.

State requirements with enough context to act. Keep one owner for each rule, and remove repetition rather than necessary reasons, boundaries, or failure handling. A skill does not grant permission to publish, push, merge, or contact others beyond the user's existing request.

Skills contain actionable rules only. Do not add failure stories, work chronology, personal reflections, or incidental commentary.

## Writing

Write repository documents, issues, and PRs in English. Use plain language, concrete names, and active voice. Avoid emoji, em dashes, filler adjectives, and closing sentences that only repeat the paragraph.

Apply these principles to source comments and JSDoc as well. Describe purpose, defaults, and necessary constraints concisely. Preserve classification rules, exclusions, and target semantics when shortening comments; use nested lists where they make those rules easier to scan. Omit essays, repetition, and implementation history.

Read [source and test documentation](source-comments.md) before writing or reviewing JSDoc, implementation comments, or test scenarios. Apply its requirements to introduced or modified code and to the complete declared scope of a documentation task.

Write each Markdown paragraph on one source line; separate distinct ideas with blank lines. Preserve structural line breaks in lists, tables, and code. The formatter uses `proseWrap: never` and leaves fenced examples unchanged.

Use lists for sequential steps or parallel checks and tables for repeated mappings. Keep README commands aligned with the product contract and report their implementation status in the PR. Read the final diff/rendered output and run executable examples when their behavior is part of the implementation change.
