import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTagParser } from "../../../../packages/evidence/src/EvidenceTagParser";
import { TestDocumentation } from "../../internal/TestDocumentation";

/** Reviews, fenced examples, and prose mentions never become acknowledgements or withdrawals. */
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
