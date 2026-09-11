import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTagParser } from "../../../../packages/evidence/src/EvidenceTagParser";
import { TestDocumentation } from "../../internal/TestDocumentation";

/** Missing prose, malformed targets, and compiler-only links are reported without producing evidence. */
export async function test_tag_diagnostics(): Promise<void> {
  const fixture = TestDocumentation.create(dedent`
    /**
     * @evidence
     * @evidence ../source.ts#value
     * @evidence ../source.ts#A.[0] Invalid accessor.
     * @evidence ../bad%ZZ.ts#value Invalid percent encoding.
     * @evidence {@link Symbol} Compiler-only lookup.
     * @evidence {@linkplain Symbol} Compiler-only lookup.
     * @evidenceReview docs/spec.md#rule #A3F9C1D
     * @evidenceReview docs/spec.md#rule #a3f9c1d
     */
  `);
  const result = EvidenceTagParser.parse(
    fixture.content,
    fixture.host,
    fixture.documentation,
  );

  TestValidator.equals(
    "diagnostic categories",
    result.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "malformed-target",
      "missing-evidence-reason",
      "malformed-target",
      "malformed-target",
      "unsupported-inline-link",
      "unsupported-inline-link",
      "malformed-fingerprint",
      "missing-review-description",
    ],
  );
  TestValidator.equals("invalid tags add no evidence", result.declarations, []);
  TestValidator.equals("invalid reviews add no reviews", result.reviews, []);

  for (const attachment of ["unattached", "unsupported"] as const) {
    const unowned = TestDocumentation.create(
      "/** @evidence ../source.ts#value Supplies evidence. */",
      undefined,
      attachment,
    );
    const parsed = EvidenceTagParser.parse(
      unowned.content,
      unowned.host,
      unowned.documentation,
    );
    TestValidator.equals(
      "unsupported host remains a finding",
      parsed.diagnostics.map((diagnostic) => diagnostic.code),
      ["unsupported-annotation-host"],
    );
    TestValidator.equals(
      "no guessed next-declaration attachment",
      parsed.declarations,
      [],
    );
  }
}
