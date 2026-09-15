import { EvidenceGraph, EvidenceMatlabAdapter, EvidenceTypeScriptAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Evaluates each selected MATLAB declaration as a required cross-language
 * reference.
 *
 * Evidence and reviews have different graph effects: missing evidence fails
 * coverage, while a review is retained but cannot satisfy it.
 *
 * 1. Extract MATLAB type, function, and property units with TypeScript claims.
 * 2. Evaluate each selector with and without its matching acknowledgement.
 * 3. Require exact missing populations when evidence is absent.
 * 4. Verify a review-only claim leaves its referenced function uncovered.
 */
export async function test_matlab_graph(): Promise<void> {
  const reference = await new EvidenceMatlabAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Contract.m",
      dedent`
    classdef Contract
      properties
        value = 1
      end
      methods
        function run(obj)
        end
      end
    end
  `.concat("\n"),
    ),
  );
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Claims.ts",
      dedent`
    /** @evidence ./Contract.m#Contract Verifies the type. */
    export class TypeClaim {}
    /** @evidence ./Contract.m#Contract.run Verifies the operation. */
    export function runClaim() {}
    /** @evidence ./Contract.m#Contract.value Verifies the value. */
    export const valueClaim = 1;
  `.concat("\n"),
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
                  ? "#Contract.run"
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
  const review = await new EvidenceMatlabAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/review.m",
      dedent`
    function review()
      % @evidenceReview ./Contract.m#Contract.run Reviewed without an acknowledgement.
    end
  `.concat("\n"),
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
