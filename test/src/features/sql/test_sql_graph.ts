import { EvidenceChecker } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Exercises real configuration selectors in both database graph roles with passing and missing-evidence cases. */
export async function test_sql_graph(): Promise<void> {
  const schema = dedent`
    -- @evidence ./requirement.ts#requirement Verifies the table.
    CREATE TABLE account (
      -- @evidence ./requirement.ts#requirement Verifies the column.
      id INTEGER,
      -- @evidence ./requirement.ts#requirement Verifies the relation.
      FOREIGN KEY (id) REFERENCES parent(id)
    );
  `;
  await TestFileSystem.experiment(
    "sql-graph",
    { "schema.sql": schema, "requirement.ts": "export const requirement = 1;" },
    async (directory) => {
      for (const symbol of ["model", "column", "relation"] as const) {
        for (const role of ["claim", "reference"] as const) {
          for (const acknowledged of [true, false]) {
            await TestFileSystem.save(directory, {
              "schema.sql":
                role === "claim" && acknowledged
                  ? schema.replace(/^.*@evidence.*$/gmu, (line) =>
                      line.includes(
                        `Verifies the ${symbol === "model" ? "table" : symbol}.`,
                      )
                        ? line
                        : "",
                    )
                  : schema.replace(/^.*@evidence.*$/gmu, ""),
              "requirement.ts":
                role === "reference" && acknowledged
                  ? "/** @evidence ./schema.sql#ACCOUNT Verifies the selected database surface. */\nexport const requirement = 1;"
                  : "export const requirement = 1;",
              "evidence.config.ts":
                role === "claim"
                  ? `export default { claims: [{ type: "sql", files: ["schema.sql"], symbol: "${symbol}", reference: { type: "typescript", files: ["requirement.ts"], symbol: "property" } }] };`
                  : `export default { claims: [{ type: "typescript", files: ["requirement.ts"], symbol: "property", reference: { type: "sql", files: ["schema.sql"], symbol: "${symbol}" } }] };`,
            });
            const result = await EvidenceChecker.check(
              join(directory, "evidence.config.ts"),
            );
            TestValidator.equals(
              `${symbol} ${role} acknowledged=${acknowledged}`,
              result.success,
              acknowledged,
            );
            TestValidator.notEquals(
              "analysis remains complete",
              result.status,
              "incomplete",
            );
          }
        }
      }
    },
  );
}
