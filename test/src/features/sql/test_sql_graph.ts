import { EvidAccessor, EvidChecker } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Exercises SQL configuration selectors in both database graph roles.
 *
 * The evaluated configuration must preserve covered and missing-evidence behavior for each selected SQL population.
 *
 * 1. Run real claim and reference configurations for each selector.
 * 2. Evaluate matching acknowledgement and missing-evidence cases.
 * 3. Require the resulting status to match each scenario.
 */
export async function test_sql_graph(): Promise<void> {
  const schema = dedent`
    -- @evid ./requirement.ts#requirement Verifies the table.
    CREATE TABLE account (
      -- @evid ./requirement.ts#requirement Verifies the column.
      id INTEGER,
      -- @evid ./requirement.ts#requirement Verifies the relation.
      FOREIGN KEY (id) REFERENCES parent(id)
    );
  `;
  await TestFileSystem.experiment(
    "sql-graph",
    { "schema.sql": schema, "requirement.ts": "export const requirement = 1;" },
    async (directory) => {
      for (const symbol of ["model", "column", "relation"] as const) {
        const accessor =
          symbol === "model"
            ? "ACCOUNT"
            : symbol === "column"
              ? "ACCOUNT.ID"
              : EvidAccessor.format([
                  "ACCOUNT",
                  'foreign-key:["ID"]->["PARENT"](["ID"])',
                ]);
        for (const role of ["claim", "reference"] as const) {
          for (const acknowledged of [true, false]) {
            await TestFileSystem.save(directory, {
              "schema.sql":
                role === "claim" && acknowledged
                  ? schema.replace(/^.*@evid.*$/gmu, (line) =>
                      line.includes(
                        `Verifies the ${symbol === "model" ? "table" : symbol}.`,
                      )
                        ? line
                        : "",
                    )
                  : schema.replace(/^.*@evid.*$/gmu, ""),
              "requirement.ts":
                role === "reference" && acknowledged
                  ? `/** @evid ./schema.sql#${accessor} Verifies the selected database surface. */\nexport const requirement = 1;`
                  : "export const requirement = 1;",
              "evid.config.ts":
                role === "claim"
                  ? `export default { claims: [{ type: "sql", files: ["schema.sql"], symbol: "${symbol}", reference: { type: "typescript", files: ["requirement.ts"], symbol: "property" } }] };`
                  : `export default { claims: [{ type: "typescript", files: ["requirement.ts"], symbol: "property", reference: { type: "sql", files: ["schema.sql"], symbol: "${symbol}" } }] };`,
            });
            const result = await EvidChecker.check(
              join(directory, "evid.config.ts"),
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
