import {
  EvidenceGraph,
  EvidenceScalaAdapter,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Requires every selected Scala unit to have an evidence acknowledgement.
 *
 * A Scala reference exposes an undocumented type, function, and property while
 * TypeScript claims selectively retain their declarations, separating graph
 * coverage from review metadata.
 *
 * 1. Analyze the reference and claim inventories and verify complete reference
 *    extraction.
 * 2. For each symbol kind, retain or remove its acknowledgement and verify the
 *    graph result and exact missing population.
 * 3. Analyze a review-only Scala annotation and verify it is retained as review
 *    data without supplying missing coverage.
 */
export async function test_scala_graph(): Promise<void> {
  const reference = await new EvidenceScalaAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Contract.scala",
      dedent`
    class Contract
    def run() = 1
    val value = 1
  `,
    ),
  );
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Claims.ts",
      dedent`
    /** @evidence ./Contract.scala#Contract Verifies the type. */
    export class TypeClaim {}
    /** @evidence ./Contract.scala#run Verifies the operation. */
    export function runClaim() {}
    /** @evidence ./Contract.scala#value Verifies the value. */
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
  const review = await new EvidenceScalaAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Review.scala",
      dedent`
    /** @evidenceReview ./Contract.scala#run Reviewed without an acknowledgement. */
    def review() = 1
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
