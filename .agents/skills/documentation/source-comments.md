# Source And Test Documentation

## Declarations And Members

Document declarations and their members, including every interface property, public class field, constructor, accessor, method, and exported namespace function. Document private helpers where their contract or state ownership is needed to follow the implementation. A class or interface description never replaces member documentation, and inherited behavior needs an explanation at an adapter entry point when it establishes the supported artifact boundary.

Start each JSDoc with one concise summary sentence. Separate the body with a blank comment line and explain the contract in subsequent paragraphs. Include the relevant responsibility, consumer, ownership, default, unit, boundary, or failure behavior. Tags such as `@param`, `@returns`, and `@default` supplement that explanation; they do not replace the body. Do not satisfy this structure by restating the identifier, spelling out its TypeScript type, or repeating generic boilerplate across unrelated declarations. Keep existing constraints and compiler-significant tags intact.

Explain why each interface or class exists, how callers use it, and how it relates to adjacent concepts. Do not leave its declaration JSDoc as a one-line label while expanding only its members. Read the implementation and consumers, then write the explanation directly; do not generate prose from identifier names or apply shared filler with a bulk-edit script.

Treat each member's JSDoc and declaration as one block, with a blank line between consecutive member blocks. Add that spacing during editing; formatting is a final check, not a substitute for it. Describe optional values by what omission means and collections by what their elements represent. Distinguish semantic identity, public address, physical position, selected population, and structural scope wherever confusing them would change the result.

Use a short `@example` where an input, call, or counterexample clarifies target spelling, selection, defaults, or resource lifetime. Verify the example against implementation. Do not attach repetitive examples to every self-explanatory field.

```ts
/**
 * Literal accessor segments naming a declaration within its public file.
 *
 * A dot inside one segment belongs to that name. EvidenceAccessor preserves
 * this boundary when serializing the path for a citation.
 *
 * @example
 * ["Client", "prototype", "send.request"] // Client.prototype["send.request"]
 */
segments: string[];

/**
 * Semantic identity exposed by this public address.
 *
 * Several aliases may share this ID. Coverage counts the unit once regardless
 * of how many public paths name it.
 */
unitId: string;
```

## Implementation Context

Inside functions, explain the purpose of significant phases and the reason for non-obvious branches, ordering, normalization, deduplication, mutation, and cleanup. Put the comment next to the decision it explains. State the invariant or failure it protects; avoid line-by-line narration and comments that only translate the next expression into English. Read producers and consumers before asserting a reason that the implementation does not establish.

```ts
// An incomplete scan may have lost declarations. Preserve its failure before
// considering an empty selection, or missing input could make coverage pass.
if (!snapshot.complete) return incompleteObligation();
```

## Test Scenarios

Give every exported test function scenario JSDoc with a summary, a purpose/context paragraph, and a numbered list of concrete verification steps. Name the initial state, action or mutation, and expected outcomes. Use sublists when one step checks several related outcomes; include the positive, negative, boundary, and recovery cases actually present. Shared fixtures do not replace the individual test's scenario. Separate setup, execution, and assertions with blank lines and explain scenario transitions beside the code. Do not claim behavior that the assertions do not exercise.

```ts
/**
 * Restores reference coverage after a selected source file is deleted and repaired.
 *
 * Watch must retain missing dependencies after a failed analysis so a repaired
 * target can restore coverage without requiring an edit to the citing source.
 *
 * 1. Start with a citation to an existing target and require a passing cycle.
 * 2. Delete the target and check the next cycle:
 *    - The report fails instead of passing with a smaller population.
 *    - The diagnostic identifies the missing target.
 * 3. Restore the target and require recovery without editing the citation.
 */
export async function test_watch_target_recovery(): Promise<void> {
  // Implement the documented setup, mutation, and assertions here.
}
```

## Verification

Before delivery, review all changed declarations, members, function phases, and test scenarios against their implementation. Check documentation attachment and member spacing as well as prose quality. For comment-only TypeScript edits, verify that executable syntax and fixture string contents are unchanged; comment-looking text inside a fixture is test input. An automated missing-comment scan can find omissions, but cannot establish that an explanation is correct or useful. Do not add tests that assert comment wording or source spelling.
