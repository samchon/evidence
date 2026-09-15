import {
  EvidGraph,
  EvidLuaAdapter,
  EvidTypeScriptAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Evaluates Lua selector coverage for undocumented and review-only claims.
 *
 * Each selected Lua unit remains missing until evidence resolves; reviews never substitute for evidence.
 *
 * 1. Select each Lua symbol kind. 2. Evaluate acknowledged and missing graphs. 3. Require review-only references to remain missing.
 */
export async function test_lua_graph(): Promise<void> {
  const reference = await new EvidLuaAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Contract.lua",
      dedent`
    function run() return 1 end
    value = 1
  `,
    ),
  );
  const claims = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Claims.ts",
      dedent`
    /** @evidence ./Contract.lua#run Verifies the operation. */
    export function runClaim() {}
    /** @evidence ./Contract.lua#value Verifies the value. */
    export const valueClaim = 1;
  `,
    ),
  );

  TestValidator.equals(
    "complete reference extraction",
    reference.diagnostics,
    [],
  );
  for (const symbol of ["function", "property"] as const) {
    const unitIds = reference.units
      .filter((unit) => unit.symbol === symbol)
      .map((unit) => unit.id);
    TestValidator.equals(`undocumented ${symbol} selected`, unitIds.length, 1);
    for (const acknowledged of [true, false]) {
      const claim = structuredClone(claims);
      claim.declarations = acknowledged
        ? claim.declarations.filter((item) =>
            item.target.endsWith(symbol === "function" ? "#run" : "#value"),
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
                resolutions: await EvidTestGraph.resolveDeclarations(
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
        EvidTestGraph.obligation(graph, 0, 0).missingUnitIds,
        acknowledged ? [] : unitIds,
      );
    }
  }
  const review = await new EvidLuaAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Review.lua",
      dedent`
    --- @evidenceReview ./Contract.lua#run Reviewed without an acknowledgement.
    function review() return 1 end
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
            reviewResolutions: await EvidTestGraph.resolveReviews(
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
    EvidTestGraph.obligation(graph, 0, 0).missingUnitIds,
    functions,
  );
}
