import { EvidenceChecker } from "@wrtnlabs/evidence";
import type { EvidenceDatabaseSymbol } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Evaluates PostgreSQL selectors as claim and reference populations.
 *
 * Selector role determines coverage ownership, and review-only annotations
 * cannot satisfy a missing obligation.
 *
 * 1. Build configurations for each PostgreSQL selector in both roles.
 * 2. Check covered and missing-evidence graph outcomes.
 * 3. Verify review-only evidence remains uncovered.
 */
export async function test_postgresql_graph(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    "postgresql-graph",
    {
      "claim.sql": dedent`
      -- @evidence ./reference.ts#contract Covers the model.
      CREATE TABLE app.Item (
        -- @evidence ./reference.ts#contract Covers the column.
        id integer,
        -- @evidence ./reference.ts#contract Covers the relation.
        FOREIGN KEY (id) REFERENCES app.Other (id)
      );
    `,
      "reference.ts": "export function contract() {}\n",
      "reference.sql":
        "CREATE TABLE app.Other (id integer, FOREIGN KEY (id) REFERENCES app.Parent (id));\n",
      "claim.ts":
        "/** @evidence ./reference.sql#app.other Covers the table subtree. */\nexport function claim() {}\n",
    },
    async (directory) => {
      for (const symbol of ["model", "column", "relation"] as const)
        for (const direction of ["claim", "reference"] as const) {
          const configuration =
            direction === "claim"
              ? `export default { claims: [{ type: "postgresql", files: ["claim.sql"], symbol: "${symbol}", reference: { type: "typescript", files: ["reference.ts"], symbol: "function" } }] };`
              : `export default { claims: [{ type: "typescript", files: ["claim.ts"], symbol: "function", reference: { type: "postgresql", files: ["reference.sql"], symbol: "${symbol}" } }] };`;
          const filename = direction === "claim" ? "claim.sql" : "claim.ts";
          const original =
            direction === "claim"
              ? claimSource(symbol)
              : "/** @evidence ./reference.sql#app.other Covers the table subtree. */\nexport function claim() {}\n";
          await EvidenceTestFileSystem.save(directory, {
            "evidence.config.ts": configuration,
            [filename]: original,
          });
          const path = join(directory, "evidence.config.ts");
          const complete = await EvidenceChecker.check(path);
          TestValidator.equals(
            `${symbol} ${direction} succeeds`,
            complete.success,
            true,
          );
          for (const marker of ["Ordinary prose", "@evidenceReview"]) {
            await EvidenceTestFileSystem.save(directory, {
              [filename]: original.replaceAll("@evidence", marker),
            });
            const missing = await EvidenceChecker.check(path);
            TestValidator.equals(
              `${symbol} ${direction} ${marker} does not cover`,
              missing.success,
              false,
            );
          }
          await EvidenceTestFileSystem.save(directory, { [filename]: original });
        }
    },
  );
}

/**
 * Builds PostgreSQL source with one acknowledgement on the selected host kind.
 *
 * Unselected model, column, and relation positions receive ordinary prose so
 * each selector scenario isolates its own eligible documentation carrier.
 */
function claimSource(symbol: EvidenceDatabaseSymbol): string {
  return dedent`
    -- ${symbol === "model" ? "@evidence ./reference.ts#contract Covers the model." : "Table declaration."}
    CREATE TABLE app.Item (
      -- ${symbol === "column" ? "@evidence ./reference.ts#contract Covers the column." : "Column declaration."}
      id integer,
      -- ${symbol === "relation" ? "@evidence ./reference.ts#contract Covers the relation." : "Relation declaration."}
      FOREIGN KEY (id) REFERENCES app.Other (id)
    );
  `;
}
