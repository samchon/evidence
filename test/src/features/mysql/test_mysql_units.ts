import { EvidenceAccessor, EvidenceInventory, EvidenceMysqlAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Extracts MySQL schema units with database-qualified ownership.
 *
 * Tables, columns, and composite foreign keys must have exact owners and
 * aliases, without inventing relationships from indexes or inline syntax.
 *
 * 1. Analyze qualified schemas with composite relations and aliases.
 * 2. Verify exact units, owners, relation endpoints, and supported addresses.
 * 3. Require unsupported relation-like constructs to stay absent.
 */
export async function test_mysql_units(): Promise<void> {
  const inventory = await new EvidenceMysqlAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      dedent`
      CREATE TABLE \`Store\`.\`Parent\` (id INT PRIMARY KEY, code INT);
      CREATE TABLE \`Store\`.\`Child\` (
        id INT PRIMARY KEY,
        parent_id INT REFERENCES \`Store\`.\`Parent\` (id),
        parent_code INT,
        KEY lookup (parent_id),
        FOREIGN KEY parent_fk (parent_id, parent_code) REFERENCES \`Store\`.\`Parent\` (id, code)
      ) ENGINE=InnoDB;
    `,
      ["schema.sql", "alias/schema.sql"],
    ),
  );

  TestValidator.equals("complete MySQL schema", inventory.diagnostics, []);
  TestValidator.equals(
    "exact schema surface",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`)
      .sort((left, right) => left.localeCompare(right)),
    [
      "model:Store.Parent",
      "column:Store.Parent.id",
      "column:Store.Parent.code",
      "model:Store.Child",
      "column:Store.Child.id",
      "column:Store.Child.parent_id",
      "column:Store.Child.parent_code",
      `relation:Store.Child[${JSON.stringify('foreign-key:["parent_id","parent_code"]->["Store","Parent"](["id","code"])')}]`,
    ].sort((left, right) => left.localeCompare(right)),
  );
  const child = inventory.units.find((unit) => unit.name === "Child");
  if (child === undefined) throw new Error("Missing child model.");
  TestValidator.predicate(
    "children share exactly one model",
    inventory.units
      .filter((unit) => unit.identity[1] === "Child" && unit.symbol !== "model")
      .every((unit) => unit.parentId === child.id),
  );
  const selected = inventory.units.map((unit) => unit.id);
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "logical alias preserves database ownership",
    graph.resolve(
      {
        file: "/project/alias/schema.sql",
        segments: [
          "Store",
          "Child",
          'foreign-key:["parent_id","parent_code"]->["Store","Parent"](["id","code"])',
        ],
      },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "database case remains source exact",
    graph.resolve(
      { file: "/project/schema.sql", segments: ["store", "Child"] },
      selected,
    ).status,
    "missing",
  );

  const literal = await new EvidenceMysqlAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "literal.sql",
      "CREATE TABLE `Order Detail` (`value.part` INT, `상품 이름` TEXT);",
    ),
  );
  TestValidator.equals(
    "backticks retain literal names",
    literal.diagnostics,
    [],
  );
  const literalGraph = new EvidenceInventory([literal]);
  const literalSelected = literal.units.map((unit) => unit.id);
  TestValidator.equals(
    "dotted column remains one segment",
    literalGraph.resolve(
      {
        file: "/project/literal.sql",
        segments: ["Order Detail", "value.part"],
      },
      literalSelected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "literal dot is not containment",
    literalGraph.resolve(
      {
        file: "/project/literal.sql",
        segments: ["Order Detail", "value", "part"],
      },
      literalSelected,
    ).status,
    "missing",
  );
  TestValidator.equals(
    "BMP quoted names remain exact",
    literalGraph.resolve(
      { file: "/project/literal.sql", segments: ["Order Detail", "상품 이름"] },
      literalSelected,
    ).status,
    "resolved",
  );

  const localReference = await new EvidenceMysqlAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "qualified.sql",
      "CREATE TABLE Store.Child (parent_id INT, FOREIGN KEY (parent_id) REFERENCES Parent (id));",
    ),
  );
  const explicitReference = await new EvidenceMysqlAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "qualified.sql",
      "CREATE TABLE Store.Child (parent_id INT, FOREIGN KEY (parent_id) REFERENCES Store.Parent (id));",
    ),
  );
  TestValidator.equals(
    "relative database reference remains complete",
    localReference.diagnostics,
    [],
  );
  TestValidator.equals(
    "explicit database reference remains complete",
    explicitReference.diagnostics,
    [],
  );
  TestValidator.equals(
    "database qualification has one foreign-key identity",
    localReference.units
      .filter((unit) => unit.symbol === "relation")
      .map((unit) => unit.id),
    explicitReference.units
      .filter((unit) => unit.symbol === "relation")
      .map((unit) => unit.id),
  );
}
