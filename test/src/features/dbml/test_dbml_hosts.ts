import { EvidDbmlAdapter, EvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches DBML notes and comments only when their schema ownership is direct.
 *
 * Notes on declarations can host evidence, while values and examples are inert and duplicate physical-source aliases retain their own locations.
 *
 * 1. Analyze annotated notes and comments on supported schema declarations.
 * 2. Compare their declarations, hosts, and physical-source aliases.
 * 3. Require annotations in values and examples to remain inert.
 */
export async function test_dbml_hosts(): Promise<void> {
  const source = dedent`
    Table users {
      id int [note: '@evid ./spec.md#column Owns the identifier column.']
      value text [default: '@evid ./spec.md#literal Inert value.'] // @evid ./spec.md#trailing Does not document the next column.
      next int
      Note: '''
      @evid ./spec.md#model Owns the table note.
      \`\`\`
      @evid ./spec.md#example Inert example.
      \`\`\`
      '''
      indexes {
        id [note: '@evid ./spec.md#index Unsupported index carrier.']
      }
    }
    Enum state {
      active [note: '@evid ./spec.md#enum Unsupported enum carrier.']
    }
  `;
  const inventory = await new EvidDbmlAdapter().analyze(
    TestSourceSnapshot.create("schema.dbml", source),
  );
  TestValidator.equals(
    "only eligible documentation creates evidence",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
      ),
    ["./spec.md#column", "./spec.md#model"],
  );
  TestValidator.equals(
    "ineligible annotations diagnose instead of attaching elsewhere",
    inventory.diagnostics.map((diagnostic) => diagnostic.code),
    new Array<string>(3).fill("unsupported-annotation-host"),
  );
  TestValidator.equals(
    "all scalar declarations remain selected",
    inventory.units.filter((unit) => unit.symbol === "column").length,
    3,
  );
  const second = inventory.units.find(
    (unit) => unit.identity.at(-1) === "next",
  );
  TestValidator.predicate(
    "trailing tag never attaches to following member",
    inventory.hosts.every(
      (host) =>
        host.range.start.offset !== source.indexOf("// @evid") ||
        !host.unitIds.includes(second?.id ?? ""),
    ),
  );

  const first = TestSourceSnapshot.create(
    "schema.dbml",
    "Table users { id int }",
    ["schema.dbml"],
  );
  const aliased = TestSourceSnapshot.create(
    "schema.dbml",
    "Table users { id int }",
    ["linked/schema.dbml"],
  );
  const merged = await new EvidDbmlAdapter().analyze(
    TestSourceSnapshot.combine([first, aliased]),
  );
  TestValidator.equals("one physical table inventory", merged.units.length, 2);
  const resolver = new EvidInventory([merged]);
  const primary = resolver.resolve(
    {
      file: "/project/schema.dbml",
      segments: ["users", "id"],
    },
    merged.units.map((unit) => unit.id),
  );
  const linked = resolver.resolve(
    {
      file: "/project/linked/schema.dbml",
      segments: ["users", "id"],
    },
    merged.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "logical aliases retain semantic identity",
    linked.units.map((unit) => unit.id),
    primary.units.map((unit) => unit.id),
  );
}
