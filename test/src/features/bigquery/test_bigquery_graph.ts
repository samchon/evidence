import {
  EvidenceBigQueryAdapter,
  EvidenceGraph,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Requires positive and missing coverage in both roles for every database selector. */
export async function test_bigquery_graph(): Promise<void> {
  const adapter = new EvidenceBigQueryAdapter();
  for (const symbol of ["model", "column", "relation"] as const) {
    const target =
      symbol === "model"
        ? "ds.orders"
        : symbol === "column"
          ? "ds.orders.id"
          : "ds.orders.parent_key";
    for (const acknowledged of [true, false]) {
      const annotation = acknowledged
        ? "@evidence ./contract.ts#contract Matches the declared contract."
        : "No acknowledgement.";
      const inventory = await adapter.analyze(
        TestSourceSnapshot.create(
          "schema.sql",
          dedent`
        /* ${symbol === "model" ? annotation : "Orders"} */
        CREATE TABLE ds.orders (
          /* ${symbol === "column" ? annotation : "Identity"} */
          id INT64,
          /* ${symbol === "relation" ? annotation : "Parent key"} */
          CONSTRAINT parent_key FOREIGN KEY (id) REFERENCES ds.parents (id) NOT ENFORCED
        );
      `,
        ),
      );
      const contract = await new EvidenceTypeScriptAdapter().analyze(
        TestSourceSnapshot.create(
          "contract.ts",
          dedent`
        /** ${acknowledged ? `@evidence ./schema.sql#${target} Implements the schema declaration.` : "No acknowledgement."} */
        export function contract() {}
      `,
        ),
      );
      TestValidator.equals(
        "schema extraction succeeds",
        inventory.diagnostics,
        [],
      );
      const ids = inventory.units
        .filter((unit) => unit.symbol === symbol)
        .map((unit) => unit.id);
      TestValidator.equals(`${symbol} denominator`, ids.length, 1);
      const contractIds = contract.units.map((unit) => unit.id);
      for (const claimRole of [true, false]) {
        const claim = claimRole ? inventory : contract;
        const reference = claimRole ? contract : inventory;
        const claimIds = claimRole ? ids : contractIds;
        const referenceIds = claimRole ? contractIds : ids;
        const graph = EvidenceGraph.evaluate({
          claims: [
            {
              severity: "error",
              inventory: claim,
              unitIds: claimIds,
              references: [
                {
                  severity: "error",
                  inventory: reference,
                  unitIds: referenceIds,
                  resolutions: await TestGraph.resolveDeclarations(
                    claim,
                    reference,
                    referenceIds,
                  ),
                },
              ],
            },
          ],
        });
        TestValidator.equals(
          `${symbol} claim=${claimRole} acknowledged=${acknowledged}`,
          graph.success,
          acknowledged,
        );
        TestValidator.equals(
          "missing population remains exact",
          TestGraph.obligation(graph, 0, 0).missingUnitIds,
          acknowledged ? [] : referenceIds,
        );
      }
    }
  }
}
