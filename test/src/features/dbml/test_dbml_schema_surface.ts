import {
  EvidenceDbmlAdapter,
  EvidenceInventory,
  EvidenceFingerprint,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Verifies schema aliases, all relation forms/cardinalities, composites and exact Unicode source positions. */
export async function test_dbml_schema_surface(): Promise<void> {
  const source = dedent`
    Table core.users as U {
      id int [pk]
      tenant int
    }
    Enum state {
      active
      inactive [note: 'A descriptive enum value.']
    }
    Table posts {
      user_id int [ref: > U.id]
      tenant int
      state state
      "display.name😀" varchar(120) [note: '😀\\n@evidence ../spec.md#display Preserves a literal column name.']
      Note: 'Post storage.'
    }
    Table profiles {
      user_id int [ref: - U.id]
    }
    Ref composite {
      posts.(user_id, tenant) > core.users.(id, tenant)
    }
    Ref reverse: U.id < posts.user_id
    Ref pair: U.id - profiles.user_id
    Ref network: U.id <> posts.user_id
  `.replace(/\n/gu, "\r\n");
  const inventory = await new EvidenceDbmlAdapter().analyze(
    TestSourceSnapshot.create("schema/main.dbml", source),
  );

  TestValidator.equals("complete DBML schema", inventory.diagnostics, []);
  TestValidator.equals(
    "three tables",
    inventory.units
      .filter((unit) => unit.symbol === "model")
      .map((unit) => unit.identity)
      .sort(),
    [
      ["core", "users"],
      ["public", "posts"],
      ["public", "profiles"],
    ].sort(),
  );
  TestValidator.equals(
    "all declared scalar columns remain columns",
    inventory.units.filter((unit) => unit.symbol === "column").length,
    7,
  );
  TestValidator.equals(
    "six independent relations",
    inventory.units.filter((unit) => unit.symbol === "relation").length,
    6,
  );
  TestValidator.equals(
    "relation owning model follows cardinality",
    inventory.units
      .filter(
        (unit) =>
          unit.symbol === "relation" &&
          unit.identity.at(-1)?.startsWith("$ref:") &&
          !unit.identity.at(-1)?.includes("["),
      )
      .map((unit) => [unit.identity.at(-1), unit.identity.slice(0, 2)])
      .sort(),
    [
      ["$ref:composite", ["public", "posts"]],
      ["$ref:reverse", ["public", "posts"]],
      ["$ref:pair", ["public", "profiles"]],
      ["$ref:network", ["core", "users"]],
    ].sort(),
  );
  const canonical = new EvidenceInventory([inventory]).resolve({
    file: "/project/schema/main.dbml",
    segments: ["core", "users", "id"],
  });
  const alias = new EvidenceInventory([inventory]).resolve({
    file: "/project/schema/main.dbml",
    segments: ["U", "id"],
  });
  TestValidator.equals(
    "alias addresses retain one identity",
    alias.units.map((unit) => unit.id),
    canonical.units.map((unit) => unit.id),
  );
  const annotation = inventory.declarations[0];
  TestValidator.equals(
    "escaped note decoded to one annotation",
    inventory.declarations.length,
    1,
  );
  TestValidator.equals(
    "Unicode UTF16 annotation start",
    annotation?.location.range?.start.offset,
    source.indexOf("@evidence"),
  );
  const literal = inventory.units.find(
    (unit) => unit.identity.at(-1) === "display.name😀",
  );
  TestValidator.equals(
    "quoted dots remain literal segments",
    literal?.identity,
    ["public", "posts", "display.name😀"],
  );
  TestValidator.equals(
    "original declaration starts at UTF16 offset",
    literal?.sites[0]?.range.start.offset,
    source.indexOf('"display.name😀"'),
  );
  TestValidator.equals(
    "original CRLF declaration column",
    literal?.sites[0]?.range.start.column,
    3,
  );

  const revised = await new EvidenceDbmlAdapter().analyze(
    TestSourceSnapshot.create(
      "schema/main.dbml",
      source.replace(
        "Post storage.",
        "Post storage.\\n@evidenceReview ../spec.md#display Reviewed storage semantics.",
      ),
    ),
  );
  const originalTable = inventory.units.find(
    (unit) => unit.symbol === "model" && unit.identity.at(-1) === "posts",
  );
  const revisedTable = revised.units.find(
    (unit) => unit.symbol === "model" && unit.identity.at(-1) === "posts",
  );
  if (originalTable === undefined || revisedTable === undefined)
    throw new Error("DBML posts table is absent.");
  TestValidator.equals(
    "review-only note edit preserves subtree fingerprint",
    EvidenceFingerprint.inspect(inventory, originalTable.id).fingerprint,
    EvidenceFingerprint.inspect(revised, revisedTable.id).fingerprint,
  );
}
