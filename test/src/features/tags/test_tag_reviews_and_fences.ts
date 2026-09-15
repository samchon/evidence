import { EvidenceTagParser } from "@wrtnlabs/evidence";
import type { IEvidenceDiagnostic } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestDocumentation } from "../../internal/TestDocumentation";

/**
 * Keeps reviews, fenced examples, and prose separate from acknowledgements.
 *
 * Only eligible annotation carriers can create evidence or withdrawals; reviews
 * retain their own record type.
 *
 * 1. Parse real tags beside prose, zero- and three-column fences, and a shorter
 *    closing fence that must remain fenced.
 * 2. Put a delimiter four columns beyond the documentation baseline and require
 *    it to remain one indented-code line rather than opening a fence.
 * 3. Start fences after complete and incomplete acknowledgements and require the
 *    opening delimiter to end each pending annotation.
 * 4. End with an unclosed true fence and require its example to stay inert.
 * 5. Verify the acknowledgements, multiline evidence reason, and no accidental
 *    withdrawal.
 * 6. Verify evidence and exclusion reviews stay distinct, only a shaped fingerprint
 *    is consumed, and review description prose remains intact.
 */
export async function test_tag_reviews_and_fences(): Promise<void> {
  const fixture = TestDocumentation.create(dedent`
    /**
     * A sentence mentioning @internal is ordinary prose.
     * ~~~~typescript
     * @evidence ../fake.ts#fake This is only an example.
     * @hidden
     * ~~~
     * @evidence ../still-fenced.ts#fake The short delimiter did not close the fence.
     * ~~~~
     *    \`\`\`typescript
     * @evidence ../three-column.ts#fake This is another example.
     *    \`\`\`
     *     \`\`\` literal indented delimiter
     * @evidence ../real.ts#run Implements the requirement.
     * Continues on the next line.
     * @evidenceReview ../real.ts#run #a3f9c1d Verified the implementation.
     * @evidenceExclude docs/spec.md#unused This part does not apply.
     * @evidenceExcludeReview docs/spec.md#unused #req-scope describes the reviewed boundary.
     * @evidenceReviewed ../fake.ts#fake This is another tag.
     * @evidence ../before-fence.ts#run Keeps only this prose.
     * ~~~text
     * This fenced example is not part of the reason.
     * ~~~
     * @evidence ../missing-reason.ts#run
     * ~~~text
     * This fenced example cannot supply a reason.
     * ~~~
     * \`\`\`typescript
     * @evidence ../unclosed.ts#fake This remains fenced through the host end.
     */
  `);
  const result = EvidenceTagParser.parse(
    fixture.content,
    fixture.host,
    fixture.documentation,
  );

  TestValidator.equals(
    "only real acknowledgements",
    result.declarations.map((entry) => entry.kind),
    ["evidence", "evidenceExclude", "evidence"],
  );
  TestValidator.equals(
    "multiline reason stops at review",
    result.declarations.map((entry) => entry.reason),
    [
      "Implements the requirement.\nContinues on the next line.",
      "This part does not apply.",
      "Keeps only this prose.",
    ],
  );
  TestValidator.equals(
    "opposite review kinds stay distinct",
    result.reviews.map((review) => review.reviews),
    ["evidence", "evidenceExclude"],
  );
  TestValidator.equals(
    "only shaped fingerprint is consumed",
    result.reviews.map((review) => review.fingerprint),
    ["a3f9c1d", undefined],
  );
  TestValidator.equals(
    "anchor prose preserved",
    result.reviews.map((review) => review.description),
    [
      "Verified the implementation.",
      "#req-scope describes the reviewed boundary.",
    ],
  );
  TestValidator.equals("no accidental withdrawal", result.withdrawals, []);
  TestValidator.equals(
    "fence cannot supply a reason",
    result.diagnostics.map(
      (diagnostic: IEvidenceDiagnostic): string => diagnostic.code,
    ),
    ["missing-evidence-reason"],
  );
}
