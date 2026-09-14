import {
  EvidenceAccessor,
  EvidenceDbmlAdapter,
  EvidenceGraph,
  EvidenceTypeScriptAdapter,
  EvidenceFingerprint,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Verifies every DBML reference selector against real cross-language targets and missing/review-only evidence. */
export async function test_dbml_reference_graphs(): Promise<void> {
  const reference = await new EvidenceDbmlAdapter().analyze(
    TestSourceSnapshot.create(
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
    const target = `./schema.dbml#${EvidenceAccessor.format(unit.identity)}`;
    const fingerprint = EvidenceFingerprint.inspect(
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
      const claim = await new EvidenceTypeScriptAdapter().analyze(
        TestSourceSnapshot.create(
          "contract.ts",
          dedent`
        /** ${documentation} */
        export function verify(): void {}
      `,
        ),
      );
      const result = EvidenceGraph.evaluate({
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
                resolutions: await TestGraph.resolveDeclarations(
                  claim,
                  reference,
                  [unit.id],
                ),
                reviewResolutions: await TestGraph.resolveReviews(
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
          TestGraph.obligation(result, 0, 0).missingUnitIds,
          [unit.id],
        );
    }
  }
}
