import {
  EvidAccessor,
  EvidDbmlAdapter,
  EvidGraph,
  EvidTypeScriptAdapter,
  EvidFingerprint,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Evaluates each DBML model, column, and relation target from a TypeScript claim.
 *
 * Evid and review have distinct graph roles, including when a review fingerprint is current or deliberately stale.
 *
 * 1. Select one DBML unit of each reference symbol and calculate its fingerprint.
 * 2. Evaluate evidence, review-only, absent, reviewed, and stale-review TypeScript claims for each target.
 * 3. Require only evidence and current required reviews to pass, while absent and review-only cases retain the selected unit as missing.
 */
export async function test_dbml_reference_graphs(): Promise<void> {
  const reference = await new EvidDbmlAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "schema.dbml",
      dedent`
    Table users { id int }
    Table posts { user_id int }
    Ref owner: posts.user_id > users.id
  `,
    ),
  );
  TestValidator.equals("reference schema complete", reference.diagnostics, []);
  const selected = [
    reference.units.find(
      (unit) => unit.symbol === "model" && unit.identity.at(-1) === "posts",
    ),
    reference.units.find(
      (unit) => unit.symbol === "column" && unit.identity.at(-1) === "user_id",
    ),
    reference.units.find((unit) => unit.symbol === "relation"),
  ];
  for (const unit of selected) {
    if (unit === undefined) throw new Error("Expected each DBML selector.");
    const target = `./schema.dbml#${EvidAccessor.format(unit.identity)}`;
    const fingerprint = EvidFingerprint.inspect(
      reference,
      unit.id,
    ).fingerprint;
    for (const kind of [
      "evidence",
      "evidenceReview",
      "absent",
      "reviewed",
      "stale",
    ]) {
      const reviewed = kind === "reviewed" || kind === "stale";
      const documentation = reviewed
        ? `@evidence ${target} Checks the declared schema contract.\n * @evidenceReview ${target} #${kind === "stale" ? "0000000" : fingerprint} Reviewed the current schema.`
        : kind === "absent"
          ? "No acknowledgement."
          : `@${kind} ${target} ${kind === "evidenceReview" ? `#${fingerprint} ` : ""}Checks the declared schema contract.`;
      const claim = await new EvidTypeScriptAdapter().analyze(
        EvidTestSourceSnapshot.create(
          "contract.ts",
          dedent`
        /** ${documentation} */
        export function verify(): void {}
      `,
        ),
      );
      const result = EvidGraph.evaluate({
        claims: [
          {
            severity: "error",
            inventory: claim,
            unitIds: claim.units.map((entry) => entry.id),
            references: [
              {
                severity: "error",
                inventory: reference,
                requireReview: reviewed,
                unitIds: [unit.id],
                resolutions: await EvidTestGraph.resolveDeclarations(
                  claim,
                  reference,
                  [unit.id],
                ),
                reviewResolutions: await EvidTestGraph.resolveReviews(
                  claim,
                  reference,
                  [unit.id],
                ),
              },
            ],
          },
        ],
      });
      TestValidator.equals(
        `${unit.symbol} reference ${kind}`,
        result.success,
        kind === "evidence" || kind === "reviewed",
      );
      if (kind === "evidenceReview" || kind === "absent")
        TestValidator.equals(
          `${unit.symbol} missing evidence remains visible`,
          EvidTestGraph.obligation(result, 0, 0).missingUnitIds,
          [unit.id],
        );
    }
  }
}
