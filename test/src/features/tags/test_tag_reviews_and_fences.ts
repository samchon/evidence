import { EvidenceTagParser } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestDocumentation } from "../../internal/TestDocumentation";

/** Keeps reviews, fenced examples, and prose separate from acknowledgements.
 *
 * Only eligible annotation carriers can create evidence or withdrawals; reviews retain their own record type.
 *
 * 1. Parse real tags beside prose, a four-backtick fence, and a shorter closing
 *    fence that must remain fenced.
 * 2. Verify the two acknowledgements, multiline evidence reason, and no accidental
 *    withdrawal.
 * 3. Verify evidence and exclusion reviews stay distinct, only a shaped fingerprint
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
     * @evidence ../real.ts#run Implements the requirement.
     * Continues on the next line.
     * @evidenceReview ../real.ts#run #a3f9c1d Verified the implementation.
     * @evidenceExclude docs/spec.md#unused This part does not apply.
     * @evidenceExcludeReview docs/spec.md#unused #req-scope describes the reviewed boundary.
     * @evidenceReviewed ../fake.ts#fake This is another tag.
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
    ["evidence", "evidenceExclude"],
  );
  TestValidator.equals(
    "multiline reason stops at review",
    result.declarations.map((entry) => entry.reason),
    [
      "Implements the requirement.\nContinues on the next line.",
      "This part does not apply.",
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
  TestValidator.equals("valid review grammar", result.diagnostics, []);
}
