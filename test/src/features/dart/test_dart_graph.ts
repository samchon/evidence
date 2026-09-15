import {
  EvidGraph,
  EvidDartAdapter,
  EvidTypeScriptAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates Dart type, function, and property coverage across a TypeScript claim.
 *
 * Each selected reference kind remains an obligation without evidence, and review metadata is tracked separately from acknowledgement.
 *
 * 1. Analyze one Dart type, function, and property plus TypeScript claims for each target.
 * 2. Evaluate covered and uncovered graph states for every symbol kind and compare exact missing IDs.
 * 3. Resolve a review-only Dart annotation and require it to leave the referenced function missing.
 */
export async function test_dart_graph(): Promise<void> {
  const reference = await new EvidDartAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Contract.dart",
      dedent`
    class Contract {}
    int run() => 1;
    final value = 1;
  `,
    ),
  );
  const claims = await new EvidTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Claims.ts",
      dedent`
    /** @evid ./Contract.dart#Contract Verifies the type. */
    export class TypeClaim {}
    /** @evid ./Contract.dart#run Verifies the operation. */
    export function runClaim() {}
    /** @evid ./Contract.dart#value Verifies the value. */
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
      const graph = EvidGraph.evaluate({
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
  const review = await new EvidDartAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Review.dart",
      dedent`
    /** @evidReview ./Contract.dart#run Reviewed without an acknowledgement. */
    int review() => 1;
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
  const graph = EvidGraph.evaluate({
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
