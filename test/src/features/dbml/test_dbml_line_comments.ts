import { EvidDbmlAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves DBML line-comment continuation and fence state at shared inline hosts.
 *
 * Consecutive line comments can form one eligible annotation, while fenced text remains inert and one inline relation site can document both its column and relation.
 *
 * 1. Analyze CRLF comments containing a fenced annotation, a continued table annotation, and inline references.
 * 2. Require only unfenced annotations to produce declarations and preserve their original UTF-16 offset.
 * 3. Verify each inline column host includes both the column and its relation unit.
 */
export async function test_dbml_line_comments(): Promise<void> {
  const source = dedent`
    // \`\`\`dbml
    // @evid ./spec.md#example Inert example.
    // @hidden
    // \`\`\`
    // 😀
    // @evid ./spec.md#table
    // Persists the user identity.
    Table users { id int }
    Table posts {
      // @evid ./spec.md#owner
      // Connects the post to its owner.
      user_id int [ref: > users.id]
      reviewer_id int [ref: > users.id]
    }
  `.replace(/\n/gu, "\r\n");
  const inventory = await new EvidDbmlAdapter().analyze(
    TestSourceSnapshot.create("schema.dbml", source),
  );

  TestValidator.equals(
    "line comment schema complete",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "fenced annotations remain inert and continuations survive",
    inventory.declarations.map((entry) => [entry.target, entry.reason]),
    [
      ["./spec.md#table", "Persists the user identity."],
      ["./spec.md#owner", "Connects the post to its owner."],
    ],
  );
  TestValidator.equals(
    "fenced withdrawal never hides a table",
    inventory.units.flatMap((unit) => unit.withdrawals),
    [],
  );
  for (const name of ["user_id", "reviewer_id"]) {
    const host = inventory.hosts.find(
      (entry) =>
        entry.attachment === "attached" &&
        entry.unitIds.some((id) =>
          inventory.units.some(
            (unit) => unit.id === id && unit.identity.at(-1) === name,
          ),
        ),
    );
    if (host === undefined)
      throw new Error(`Missing ${name} documentation host.`);
    TestValidator.equals(
      `${name} documents both scalar column and inline relation`,
      inventory.units
        .filter((unit) => host.unitIds.includes(unit.id))
        .map((unit) => unit.symbol)
        .sort((left, right) => left.localeCompare(right, "en")),
      ["column", "relation"],
    );
  }
  const annotation = inventory.declarations[0];
  if (annotation === undefined || annotation.location.range === undefined)
    throw new Error("Missing source-mapped table annotation.");
  TestValidator.equals(
    "continued annotation retains original UTF16 start",
    annotation.location.range.start.offset,
    source.indexOf("@evid ./spec.md#table"),
  );
}
