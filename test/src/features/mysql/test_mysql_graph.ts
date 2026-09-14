import { EvidenceChecker } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Requires every MySQL selector in claim and reference roles across a TypeScript boundary. */
export async function test_mysql_graph(): Promise<void> {
  for (const symbol of ["model", "column", "relation"] as const)
    for (const mysqlClaims of [true, false])
      await TestFileSystem.experiment(
        `mysql-graph-${symbol}-${mysqlClaims}`,
        {
          "evidence.config.ts": mysqlClaims
            ? `export default { claims: [{ type: "mysql", files: ["schema.sql"], symbol: "${symbol}", reference: { type: "typescript", files: ["contract.ts"], symbol: "function" } }] };`
            : `export default { claims: [{ type: "typescript", files: ["contract.ts"], symbol: "function", reference: { type: "mysql", files: ["schema.sql"], symbol: "${symbol}" } }] };`,
          "schema.sql": dedent`
            /** @evidence ./contract.ts#run Verifies the model. */
            CREATE TABLE Child (
              /** @evidence ./contract.ts#run Verifies the column. */
              parent_id INT,
              /** @evidence ./contract.ts#run Verifies the relation. */
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
          await TestFileSystem.save(
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
