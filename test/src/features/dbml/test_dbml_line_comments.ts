import { EvidenceDbmlAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves continuation/fence state across line comments and all obligations at shared inline sites. */
export async function test_dbml_line_comments(): Promise<void> {
  const source = dedent`
    // \`\`\`dbml
    // @evidence ./spec.md#example Inert example.
    // @hidden
    // \`\`\`
    // 😀
    // @evidence ./spec.md#table
    // Persists the user identity.
    Table users { id int }
    Table posts {
      // @evidence ./spec.md#owner
      // Connects the post to its owner.
      user_id int [ref: > users.id]
      reviewer_id int [ref: > users.id]
    }
  `.replace(/\n/gu, "\r\n");
  const inventory = await new EvidenceDbmlAdapter().analyze(
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
    TestValidator.equals(
      `${name} documents both scalar column and inline relation`,
      inventory.units
        .filter((unit) => host?.unitIds.includes(unit.id) === true)
        .map((unit) => unit.symbol)
        .sort((left, right) => left.localeCompare(right, "en")),
      ["column", "relation"],
    );
  }
  TestValidator.equals(
    "continued annotation retains original UTF16 start",
    inventory.declarations[0]?.location.range?.start.offset,
    source.indexOf("@evidence ./spec.md#table"),
  );
}
