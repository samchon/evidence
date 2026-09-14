import {
  EvidenceGraph,
  EvidenceZigAdapter,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates Zig selectors as required cross-language references.
 *
 * Selected units require evidence, and reviews remain recorded without supplying missing coverage.
 *
 * 1. Extract each Zig selector with matching claims.
 * 2. Evaluate acknowledged and undocumented populations.
 * 3. Verify review-only references remain missing.
 */
export async function test_zig_graph(): Promise<void> {
  const reference = await new EvidenceZigAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Contract.zig",
      dedent`
    pub const Contract = struct { const privateValue = 1; };
    pub fn run() i32 { return 1; }
    pub const value = 1;
  `,
    ),
  );
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Claims.ts",
      dedent`
    /** @evidence ./Contract.zig#Contract Verifies the type. */
    export class TypeClaim {}
    /** @evidence ./Contract.zig#run Verifies the operation. */
    export function runClaim() {}
    /** @evidence ./Contract.zig#value Verifies the value. */
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
                  : "#value",
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
                resolutions: await TestGraph.resolveDeclarations(
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
        TestGraph.obligation(graph, 0, 0).missingUnitIds,
        acknowledged ? [] : unitIds,
      );
    }
  }
  const review = await new EvidenceZigAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Review.zig",
      dedent`
    /// @evidenceReview ./Contract.zig#run Reviewed without an acknowledgement.
    pub fn review() i32 { return 1; }
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
            reviewResolutions: await TestGraph.resolveReviews(
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
    TestGraph.obligation(graph, 0, 0).missingUnitIds,
    functions,
  );
}
