import { EvidenceChecker } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Evaluates MySQL selectors in both claim and reference graph roles.
 *
 * A TypeScript boundary must preserve selected database obligations whether
 * MySQL supplies claims or referenced units.
 *
 * 1. Build graph configurations for each supported MySQL selector and role.
 * 2. Check covered and missing-evidence outcomes for each configuration.
 * 3. Require the graph result and missing population to match the selected role.
 */
export async function test_mysql_graph(): Promise<void> {
  for (const symbol of ["model", "column", "relation"] as const)
    for (const mysqlClaims of [true, false])
      await EvidenceTestFileSystem.experiment(
        `mysql-graph-${symbol}-${mysqlClaims}`,
        {
          "evidence.config.ts": mysqlClaims
            ? `export default { claims: [{ type: "mysql", files: ["schema.sql"], symbol: "${symbol}", reference: { type: "typescript", files: ["contract.ts"], symbol: "function" } }] };`
            : `export default { claims: [{ type: "typescript", files: ["contract.ts"], symbol: "function", reference: { type: "mysql", files: ["schema.sql"], symbol: "${symbol}" } }] };`,
          "schema.sql": dedent`
            ${mysqlClaims && symbol === "model" ? "/** @evidence ./contract.ts#run Verifies the model. */" : ""}
            CREATE TABLE Child (
              ${mysqlClaims && symbol === "column" ? "/** @evidence ./contract.ts#run Verifies the column. */" : ""}
              parent_id INT,
              ${mysqlClaims && symbol === "relation" ? "/** @evidence ./contract.ts#run Verifies the relation. */" : ""}
              FOREIGN KEY parent_fk (parent_id) REFERENCES Parent (id)
            );
          `,
          "contract.ts": dedent`
            /** @evidence ./schema.sql#Child Verifies the schema. */
            export function run() {}
          `,
        },
        async (directory) => {
          const config = join(directory, "evidence.config.ts");
          const complete = await EvidenceChecker.check(config);

          TestValidator.equals(
            `${symbol} role ${mysqlClaims} passes`,
            complete.success,
            true,
          );
          await EvidenceTestFileSystem.save(
            directory,
            mysqlClaims
              ? {
                  "schema.sql":
                    "CREATE TABLE Child (parent_id INT, FOREIGN KEY parent_fk (parent_id) REFERENCES Parent (id));",
                }
              : { "contract.ts": "export function run() {}" },
          );
          const missing = await EvidenceChecker.check(config);
          TestValidator.equals(
            `${symbol} role ${mysqlClaims} missing evidence fails`,
            missing.success,
            false,
          );
        },
      );
}
