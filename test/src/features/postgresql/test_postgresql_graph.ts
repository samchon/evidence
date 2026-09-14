import { EvidenceChecker } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Certifies each PostgreSQL selector in both roles, including missing and review-only evidence. */
export async function test_postgresql_graph(): Promise<void> {
  await TestFileSystem.experiment(
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
          await TestFileSystem.save(directory, {
            "evidence.config.ts": configuration,
          });
          const path = join(directory, "evidence.config.ts");
          const complete = await EvidenceChecker.check(path);
          TestValidator.equals(
            `${symbol} ${direction} succeeds`,
            complete.success,
            true,
          );
          const filename = direction === "claim" ? "claim.sql" : "claim.ts";
          const original =
            direction === "claim"
              ? dedent`
          -- @evidence ./reference.ts#contract Covers the model.
          CREATE TABLE app.Item (
            -- @evidence ./reference.ts#contract Covers the column.
            id integer,
            -- @evidence ./reference.ts#contract Covers the relation.
            FOREIGN KEY (id) REFERENCES app.Other (id)
          );
        `
              : "/** @evidence ./reference.sql#app.other Covers the table subtree. */\nexport function claim() {}\n";
          for (const marker of ["Ordinary prose", "@evidenceReview"]) {
            await TestFileSystem.save(directory, {
              [filename]: original.replaceAll("@evidence", marker),
            });
            const missing = await EvidenceChecker.check(path);
            TestValidator.equals(
              `${symbol} ${direction} ${marker} does not cover`,
              missing.success,
              false,
            );
          }
          await TestFileSystem.save(directory, { [filename]: original });
        }
    },
  );
}
