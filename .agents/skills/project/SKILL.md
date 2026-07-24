---
name: project
description: Defines the @samchon/lint-plugin-evidence product contract, workspace layout, package boundaries, and canonical commands. Use when orienting in the repository, working inside any package, or choosing a build, test, or format command.
---

# Project Outline

## Product Contract

`@samchon/lint-plugin-evidence` is an evidence-graph lint contributor for `@ttsc/lint`. It exists so that a claim made in code carries its proof, and so that a missing or dangling proof fails the build rather than waiting to be noticed in review.

- **Declare.** A JSDoc `@evidence <target> <reason>` tag cites a Markdown section, Swagger/OpenAPI operation, or TypeScript symbol as the grounds for a declaration.
- **Resolve.** Targets resolve against Markdown and Swagger/OpenAPI sources loaded from configured locations and against the TypeScript program's symbols.
- **Enforce.** Violations surface as real compile errors, because `@ttsc/lint` runs in the check stage and the exit code sums lint and type diagnostics.
- **Configure.** Which folders must cite what, which edges count toward coverage, and when a rule activates are the consumer's to declare in `lint.config.ts`.

The contract is general-purpose. `autobe-mcp` proves the idea with a hardcoded, domain-specific graph; it is prior art and a validation target, not the product definition. The evidence-graph skill owns the domain model, and `.wiki/references/` holds what the prior art actually does.

## Layout

- `packages/evidence`: `@samchon/lint-plugin-evidence`. TypeScript descriptor, plugin metadata, and config-augmentation types in `src/`; every lint rule as Go source in `native/`, with its Go unit tests co-located there as `*_test.go`. The published tarball must ship `native` alongside the compiled descriptor, or it builds nowhere but here — see the lint-rule-authoring skill.
- `tests/test-evidence`: end-to-end feature tests. Materialize a project, run the real binary, assert the diagnostics.
- `config`: shared tsconfig base that packages extend.
- `.wiki`: Korean knowledge base of prior-art research and decisions. Not documentation; see the wiki skill.
- `.agents/skills`: these skills.

## Language Boundary

TypeScript owns the descriptor, the configuration types, and the e2e tests. Go owns every rule. This is not a preference: `@ttsc/lint` has no JavaScript rule runtime, and `autobe-mcp/packages/lint` ships the same hybrid shape. Do not attempt rule logic in TypeScript.

## Commands

```bash
pnpm install
pnpm format
pnpm build
pnpm test:go
pnpm test
```
