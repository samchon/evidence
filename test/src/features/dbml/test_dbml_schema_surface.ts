import {
  EvidenceDbmlAdapter,
  EvidenceInventory,
  EvidenceFingerprint,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Classifies DBML aliases, relation cardinalities, composites, and Unicode
 * source positions.
 *
 * The schema surface must preserve canonical model ownership and literal column
 * segments while relation identity records direction and cardinality.
 *
 * 1. Analyze aliased tables, scalar columns, all inline and named relation forms,
 *    and a composite reference.
 * 2. Compare model, column, relation, and relation-owner identities; resolve an
 *    alias to its canonical column unit.
 * 3. Verify UTF-16 positions for escaped Unicode notes and quoted names, then
 *    retain a review separately without changing the table fingerprint.
 */
export async function test_dbml_schema_surface(): Promise<void> {
  const source = dedent`
    Table core.users as U {
      id int [pk, ref: < posts.user_id, ref: <> profiles.user_id]
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
    EvidenceTestSourceSnapshot.create("schema/main.dbml", source),
  );

  TestValidator.equals("complete DBML schema", inventory.diagnostics, []);
  TestValidator.equals(
    "three tables",
    inventory.units
      .filter((unit) => unit.symbol === "model")
      .map((unit) => unit.identity)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
      ),
    [
      ["core", "users"],
      ["public", "posts"],
      ["public", "profiles"],
    ].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
    ),
  );
  TestValidator.equals(
    "all declared scalar columns remain columns",
    inventory.units.filter((unit) => unit.symbol === "column").length,
    7,
  );
  TestValidator.equals(
    "eight independent relations",
    inventory.units.filter((unit) => unit.symbol === "relation").length,
    8,
  );
  TestValidator.equals(
    "relation owning model follows cardinality",
    inventory.units
      .filter(
        (unit) =>
          unit.symbol === "relation" &&
          (unit.identity.at(-1) ?? "").startsWith("$ref:") &&
          !(unit.identity.at(-1) ?? "").includes("["),
      )
      .map((unit) => [unit.identity.at(-1), unit.identity.slice(0, 2)])
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
      ),
    [
      ["$ref:composite", ["public", "posts"]],
      ["$ref:reverse", ["public", "posts"]],
      ["$ref:pair", ["public", "profiles"]],
      ["$ref:network", ["core", "users"]],
    ].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
    ),
  );
  TestValidator.equals(
    "inline relation identity preserves cardinality and owning table",
    inventory.units
      .filter(
        (unit) =>
          unit.symbol === "relation" &&
          (unit.identity.at(-1) ?? "").startsWith("$ref:["),
      )
      .map((unit) => unit.identity)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
      ),
    [
      [
        "public",
        "posts",
        "$ref:" +
          JSON.stringify([
            ["core", "users"],
            ["id"],
            "<",
            ["public", "posts"],
            ["user_id"],
          ]),
      ],
      [
        "core",
        "users",
        "$ref:" +
          JSON.stringify([
            ["core", "users"],
            ["id"],
            "<>",
            ["public", "profiles"],
            ["user_id"],
          ]),
      ],
      [
        "public",
        "posts",
        "$ref:" +
          JSON.stringify([
            ["public", "posts"],
            ["user_id"],
            ">",
            ["core", "users"],
            ["id"],
          ]),
      ],
      [
        "public",
        "profiles",
        "$ref:" +
          JSON.stringify([
            ["public", "profiles"],
            ["user_id"],
            "-",
            ["core", "users"],
            ["id"],
          ]),
      ],
    ].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
    ),
  );
  const canonical = new EvidenceInventory([inventory]).resolve(
    {
      file: "/project/schema/main.dbml",
      segments: ["core", "users", "id"],
    },
    inventory.units.map((unit) => unit.id),
  );
  const alias = new EvidenceInventory([inventory]).resolve(
    {
      file: "/project/schema/main.dbml",
      segments: ["U", "id"],
    },
    inventory.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "alias addresses retain one identity",
    alias.units.map((unit) => unit.id),
    canonical.units.map((unit) => unit.id),
  );
  const annotation = inventory.declarations[0];
  if (annotation === undefined || annotation.location.range === undefined)
    throw new Error("Expected source-mapped annotation.");
  TestValidator.equals(
    "escaped note decoded to one annotation",
    inventory.declarations.length,
    1,
  );
  TestValidator.equals(
    "Unicode UTF16 annotation start",
    annotation.location.range.start.offset,
    source.indexOf("@evidence"),
  );
  const literal = inventory.units.find(
    (unit) => unit.identity.at(-1) === "display.name😀",
  );
  if (literal === undefined || literal.sites[0] === undefined)
    throw new Error("Expected literal-name declaration site.");
  const literalSite = literal.sites[0];
  TestValidator.equals(
    "quoted dots remain literal segments",
    literal.identity,
    ["public", "posts", "display.name😀"],
  );
  TestValidator.equals(
    "original declaration starts at UTF16 offset",
    literalSite.range.start.offset,
    source.indexOf('"display.name😀"'),
  );
  TestValidator.equals(
    "original CRLF declaration column",
    literalSite.range.start.column,
    3,
  );

  const revised = await new EvidenceDbmlAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "schema/main.dbml",
      source.replace(
        "Post storage.",
        "Post storage.\\n@evidenceReview ../spec.md#display Reviewed storage semantics.",
      ),
    ),
  );
  TestValidator.equals(
    "decoded note review retained separately",
    revised.reviews.length,
    1,
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
