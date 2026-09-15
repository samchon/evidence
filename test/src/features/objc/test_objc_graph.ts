import { EvidenceGraph, EvidenceObjcAdapter, EvidenceTypeScriptAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Evaluates every selected Objective-C declaration as a graph reference.
 *
 * Evidence covers selected units, whereas reviews remain recorded without
 * satisfying missing obligations.
 *
 * 1. Extract Objective-C units and TypeScript claims for each selector.
 * 2. Evaluate covered and undocumented selector populations.
 * 3. Verify a review-only reference stays missing.
 */
export async function test_objc_graph(): Promise<void> {
  const reference = await new EvidenceObjcAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Contract.h",
      dedent`
    @interface Contract
    @property int value;
    @end
    int run(void);
  `,
    ),
  );
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Claims.ts",
      dedent`
    /** @evidence ./Contract.h#Contract Verifies the type. */
    export class TypeClaim {}
    /** @evidence ./Contract.h#run Verifies the operation. */
    export function runClaim() {}
    /** @evidence ./Contract.h#Contract.value Verifies the value. */
    export const valueClaim = 1;
  `,
    ),
  );

  TestValidator.equals(
    "complete reference extraction",
    reference.diagnostics,
    [],
  );
  for (const symbol of ["type", "function", "property"] as const) {
    const unitIds = reference.units
      .filter((unit) => unit.symbol === symbol)
      .map((unit) => unit.id);
    TestValidator.equals(`undocumented ${symbol} selected`, unitIds.length, 1);
    for (const acknowledged of [true, false]) {
      const claim = structuredClone(claims);
      claim.declarations = acknowledged
        ? claim.declarations.filter((item) =>
            item.target.endsWith(
              symbol === "type"
                ? "#Contract"
                : symbol === "function"
                  ? "#run"
                  : "#Contract.value",
            ),
          )
        : [];
      const graph = EvidenceGraph.evaluate({
        claims: [
          {
            severity: "error",
            inventory: claim,
            unitIds: claim.units.map((unit) => unit.id),
            references: [
              {
                severity: "error",
                inventory: reference,
                unitIds,
                resolutions: await EvidenceTestGraph.resolveDeclarations(
                  claim,
                  reference,
                  unitIds,
                ),
              },
            ],
          },
        ],
      });
      TestValidator.equals(
        `${symbol} cross-language coverage ${acknowledged}`,
        graph.success,
        acknowledged,
      );
      TestValidator.equals(
        `${symbol} exact missing population`,
        EvidenceTestGraph.obligation(graph, 0, 0).missingUnitIds,
        acknowledged ? [] : unitIds,
      );
    }
  }
  const review = await new EvidenceObjcAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Review.m",
      dedent`
    /** @evidenceReview ./Contract.h#run Reviewed without an acknowledgement. */
    int review(void) { return 1; }
  `,
    ),
  );
  TestValidator.equals(
    "review is separate from evidence",
    review.declarations,
    [],
  );
  TestValidator.equals("review is retained", review.reviews.length, 1);
  const functions = reference.units
    .filter((unit) => unit.symbol === "function")
    .map((unit) => unit.id);
  const graph = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: review,
        unitIds: review.units.map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: functions,
            resolutions: [],
            reviewResolutions: await EvidenceTestGraph.resolveReviews(
              review,
              reference,
              functions,
            ),
          },
        ],
      },
    ],
  });
  TestValidator.equals(
    "review never supplies missing coverage",
    EvidenceTestGraph.obligation(graph, 0, 0).missingUnitIds,
    functions,
  );
}
