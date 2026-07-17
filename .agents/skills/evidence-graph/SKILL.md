---
name: evidence-graph
description: Defines the evidence graph domain model for @samchon/evidence — the tag grammar, node kinds, reference resolution, the three questions the rules ask (integrity, obligation, coverage), activation gates, and exemptions. Use before changing rule semantics, the tag grammar, the configuration surface, or a diagnostic message; do not use for the mechanics of the Go rule API, which the lint-rule-authoring skill owns.
---

# Evidence Graph

## What The Product Claims

An artifact that cites nothing has no proof it was needed. An artifact that cites a section nobody declared has proof of nothing. This plugin turns both into compile errors, under a graph the consumer defines in `lint.config.ts`.

The prior art is `autobe-mcp`, which enforces the same idea with a hardcoded, domain-specific graph. Two things differ here, and both drive design:

- **The graph is configurable.** Node kinds, edge policies, and which folders must cite which are the consumer's to declare, not ours to hardcode.
- **The carrier is a JSDoc tag, not a typed JSON field.** `autobe-mcp` puts evidence in schema fields validated by typia because its artifacts are LLM-authored JSON. Our subject is arbitrary TypeScript source, where a comment is the only attachment point available on every declaration. Lint is what makes a comment enforceable.

Read `.wiki/references/autobe-mcp.md` before generalizing any rule from that prior art, and `.wiki/design/decisions.md` for the decisions already settled and their costs.

## Tag Grammar

```
@evidence <target> <reason>
```

The first whitespace-delimited token is the target; everything after it is prose. This is the ordinary JSDoc tag shape (`@param name description`), not an invention.

```ts
/** @evidence docs/spec.md#pricing Sale price derives from the rule defined there. */
/** @evidence IShoppingSale.IUpdate Mirrors the update payload shape exactly. */
```

A tag with a target and no reason is an error. A reason exists so a reader learns why the citation holds; a bare pointer teaches nothing and cannot be reviewed.

**A declaration may carry any number of `@evidence` tags, and every one is validated independently.** More than one ground is the normal case, not an edge case. A walk that stopped at the first tag would leave the rest unchecked while still looking enforced, which is worse than not checking at all.

**Target order is deliberate and costs something.** `autobe-mcp` requires the reason _before_ the section so an authoring LLM states its reasoning first and lets that reasoning steer which section it names. The JSDoc shape forbids that ordering, so the chain-of-thought steering is lost and an AI may pick a target first and rationalize it after. Do not add a rule that tries to judge whether a reason is "real"; a machine cannot settle that, and a rule that guesses will teach authors to write filler that passes.

## Node And Edge Kinds

Two node kinds exist.

- **Document sections** — a heading in a markdown file, addressed as `<path>#<anchor>`. **A section, never a whole document.** "The grounds are somewhere in this file" is not grounds: a reviewer cannot check it, and it survives every edit to the document, including the one that deletes the paragraph it meant. A whole-document citation resolves trivially — the path exists — so it must be refused explicitly or it becomes the path of least resistance.
- **TypeScript symbols** — a declaration, addressed by its dotted name.

Targets are discriminated by shape: a target containing `#` or ending in `.md` is a document reference; a dotted identifier is a symbol reference. This is a heuristic, so **every diagnostic must name which kind it resolved the target to**, letting a misclassification surface at the point of failure instead of hiding as a confusing "not found".

The default graph is **bipartite**: citers point at cited nodes, and cited nodes point at nothing. `autobe-mcp` gets cycle-freedom structurally from this shape and therefore needs no cycle detection. Symbol-to-symbol citation breaks that property, so it is opt-in, and enabling it enables cycle detection with it.

## Three Questions, Three Rules

The graph is interrogated from three sides. They look similar and are not, and collapsing any two produces a ledger that answers neither honestly. This separation is the most valuable idea inherited from the prior art, which keeps its own three mechanisms deliberately apart.

| Rule | Side | Asks |
| --- | --- | --- |
| `evidence/reference` | edge | Does this citation point at something real? |
| `evidence/require` | source | Does this declaration assert something while citing nothing? |
| `evidence/coverage` | target | Does anything claim to implement this section? |

Each is structurally blind to the others' question, and the blindness is why all three exist.

- **Coverage counts sections with no citation, so it can never see a citation with no section.** A document renamed or a heading re-anchored strands every citation pointing at it, and only `evidence/reference` can say so. Integrity's scope is deliberately wider for exactly this reason.
- **Integrity never sees a declaration that simply has no tag** — there is no edge to inspect. That is `evidence/require`'s question.
- **A citation can satisfy one rule and fail another.** One that resolves but points outside a policy's required documents passes integrity and fails obligation. This is not a contradiction; they are different questions.

The prior art also splits edges into intent and realization so an unbuilt promise cannot turn the ledger green. That distinction is real, but it is a property of the artifact _kind_, which this plugin does not model — the tag grammar cannot express it. Do not invent a split the grammar cannot carry: a ledger whose numbers nobody can explain is worse than a coarser one everybody can.

## Activation Gates

**A coverage rule that fires before its evidence is authorable corrupts the graph.** It does not merely annoy: it pushes the author toward a false citation or an invented exemption, and those outlive the moment.

A rule therefore stays silent until its preconditions hold, and the precondition is a predicate over resident facts, not an `off` switch. Presence is the signal, not length — an empty index that exists proves the slot exists and the author is ready; an absent one proves nothing yet.

## Exemptions

A section excuses itself from coverage in the document, under its heading:

```md
## Naming Conventions

<!-- evidence-exempt: describes a convention, not behavior anything implements -->
```

Three properties are load-bearing.

- **The reason is mandatory.** A marker with a blank reason is an error, not an exemption. A blank reason is not a reason, and accepting one turns a decision somebody made into a hole nobody has to defend. Reporting it also matters more than it looks: whoever wrote the marker believes they addressed the finding, so silently ignoring it leaves them staring at an error they think they fixed.
- **It lives in the document**, because that is where the uncited thing lives. An HTML comment keeps it invisible in every renderer while leaving it plain text — and therefore reviewable — in the source.
- **It is visible to the graph.** A lint disable comment would be cheaper and is wrong on every count: it sits in TypeScript while the uncited thing is a section, it suppresses every future diagnostic on that node rather than this one question, it demands no reason, and nothing can then answer "how many exemptions does this repository carry".

Never auto-exempt, auto-retarget, or delete an artifact or citation to make a graph green. Repair is the author's, and every diagnostic must name the path that performs it.

## Diagnostic Messages Are The Product

Most users meet this plugin only through an error message. A message that names a violation without naming the repair teaches the author to disable the rule.

- State what is wrong, then what fixes it. Name the file, the target, and the resolution kind.
- Never blame the author for a state the rule created by firing too early. If that is possible, the gate is wrong; fix the gate.
- Prefer one precise diagnostic to several overlapping ones.

## Identity Rules That Bite

- **Token boundaries.** If a reference is matched as a token in text, `REQ-X-10` must not satisfy `REQ-X-1`. The ID grammar and the token-boundary character class must be derived together; letting configuration set one without the other reintroduces the substring bug the prior art already fixed.
- **Prose is free; the token is the contract.** Reference identity must never depend on heading text, or every editorial fix silently breaks the graph.
- **Paths are case-sensitive identity even on a case-insensitive host.** Compare segments exactly. Case-insensitive comparison is for producing a better error message, never for deciding identity.
