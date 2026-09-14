import {
  EvidenceAccessor,
  EvidenceInventory,
  EvidenceSqlAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Establishes composite foreign-key identity, file-independent ownership, and actual qualified-name ambiguity. */
export async function test_sql_units(): Promise<void> {
  const adapter = new EvidenceSqlAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      dedent`
    CREATE TABLE sales.child (
      first INTEGER,
      second INTEGER,
      FOREIGN KEY (first, second) REFERENCES sales.parent(left_id, right_id)
    );
  `,
    ),
  );
  TestValidator.equals("complete composite schema", inventory.diagnostics, []);
  TestValidator.equals(
    "exact kinds",
    inventory.units
      .map((unit) => unit.symbol)
      .sort((left, right) => left.localeCompare(right, "en")),
    ["column", "column", "model", "relation"],
  );
  const model = inventory.units.find((unit) => unit.symbol === "model");
  if (model === undefined) throw new Error("Missing owning table.");
  TestValidator.equals("qualified model", model.identity, ["SALES", "CHILD"]);
  const children = inventory.units.filter((unit) => unit.symbol !== "model");
  TestValidator.predicate(
    "every database member belongs to its table",
    children.every((unit) => unit.parentId === model.id),
  );
  const relation = children.find((unit) => unit.symbol === "relation");
  TestValidator.equals("composite ordered endpoints", relation?.identity, [
    "SALES",
    "CHILD",
    'foreign-key:["FIRST","SECOND"]->["SALES","PARENT"](["LEFT_ID","RIGHT_ID"])',
  ]);

  const duplicate = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("first.sql", "CREATE TABLE same (id INTEGER);"),
      TestSourceSnapshot.create(
        "second.sql",
        "CREATE TABLE same (value INTEGER);",
      ),
    ]),
  );
  TestValidator.equals(
    "cross-file duplicate schema ownership cannot merge",
    duplicate.complete,
    false,
  );

  const ambiguous = await adapter.analyze(
    TestSourceSnapshot.create(
      "ambiguous.sql",
      "CREATE TABLE a (b INTEGER); CREATE TABLE a.b (id INTEGER);",
    ),
  );
  TestValidator.equals(
    "different schema objects are both inventoried",
    ambiguous.complete,
    true,
  );
  const address = ambiguous.addresses.find(
    (entry) => EvidenceAccessor.format(entry.segments) === "A.B",
  );
  if (address === undefined) throw new Error("Missing ambiguous address.");
  TestValidator.equals(
    "schema qualification and column collision stays ambiguous",
    new EvidenceInventory([ambiguous]).resolve(
      address,
      ambiguous.units.map((unit) => unit.id),
    ).status,
    "ambiguous",
  );

  const unavailable = TestSourceSnapshot.create("missing.sql", "");
  unavailable.complete = false;
  unavailable.diagnostics.push({
    code: "path-unreadable",
    path: unavailable.files[0]?.physicalPath ?? "missing.sql",
    message: "Access denied.",
  });
  const failed = await adapter.analyze(unavailable);
  TestValidator.equals(
    "source failure stays incomplete",
    failed.complete,
    false,
  );
  TestValidator.predicate(
    "original source diagnostic retained",
    failed.diagnostics.some(
      (diagnostic) => diagnostic.code === "source-path-unreadable",
    ),
  );
}
