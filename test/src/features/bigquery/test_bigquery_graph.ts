import {
  EvidBigQueryAdapter,
  EvidGraph,
  EvidTypeScriptAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Evaluates acknowledgement coverage for each BigQuery model, column, and relation selector.
 *
 * Both directions of a database-to-TypeScript claim must use the exact selected denominator rather than treating a missing acknowledgement as an empty population.
 *
 * 1. Create one schema unit of each selector kind and one TypeScript contract with and without reciprocal evidence.
 * 2. Evaluate each inventory as both claimant and reference.
 * 3. Require acknowledged graphs to pass and unacknowledged graphs to report every referenced unit as missing.
 */
export async function test_bigquery_graph(): Promise<void> {
  const adapter = new EvidBigQueryAdapter();
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
        EvidTestSourceSnapshot.create(
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
      const contract = await new EvidTypeScriptAdapter().analyze(
        EvidTestSourceSnapshot.create(
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
        const graph = EvidGraph.evaluate({
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
                  resolutions: await EvidTestGraph.resolveDeclarations(
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
          EvidTestGraph.obligation(graph, 0, 0).missingUnitIds,
          acknowledged ? [] : referenceIds,
        );
      }
    }
  }
}
