import {
  EvidenceAccessor,
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceSqliteAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Certifies SQLite quoting, schema ownership, generated columns, and explicit composite relations. */
export async function test_sqlite_units(): Promise<void> {
  const source = dedent`
    CREATE TABLE main."Order.Items" (
      "id.part" INTEGER PRIMARY KEY,
      [seller] INTEGER,
      \`price\` INTEGER,
      'total' INTEGER GENERATED ALWAYS AS (price * 2) STORED,
      CONSTRAINT "seller.link" FOREIGN KEY ([seller], "id.part") REFERENCES "Seller" (id, item)
    ) WITHOUT ROWID, STRICT;
    CREATE TEMP TABLE [Scratch] ('untyped', "quote""name" TEXT, \`back\`\`tick\` INTEGER);
  `;
  const snapshot = TestSourceSnapshot.create("schema.sql", source, [
    "schema.sql",
    "alias.sql",
  ]);
  const inventory = await new EvidenceSqliteAdapter().analyze(snapshot);

  TestValidator.equals(
    "SQLite extraction diagnostics",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "SQLite complete declarations",
    inventory.complete,
    true,
  );
  TestValidator.equals(
    "exact semantic names and kinds",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`)
      .sort((left, right) => left.localeCompare(right, "en")),
    [
      'model:main["order.items"]',
      'column:main["order.items"]["id.part"]',
      'column:main["order.items"].seller',
      'column:main["order.items"].price',
      'column:main["order.items"].total',
      'relation:main["order.items"]["foreign key:seller.link"]',
      "model:temp.scratch",
      "column:temp.scratch.untyped",
      'column:temp.scratch["quote\\\"name"]',
      'column:temp.scratch["back`tick"]',
    ].sort((left, right) => left.localeCompare(right, "en")),
  );
  for (const unit of inventory.units) {
    TestValidator.equals("one physical declaration site", unit.sites.length, 1);
    TestValidator.equals(
      "both logical addresses retained",
      inventory.addresses.filter((address) => address.unitId === unit.id)
        .length,
      unit.identity[0] === "temp" ? 4 : 2,
    );
    if (unit.symbol !== "model") {
      const owner = inventory.units.find(
        (candidate) => candidate.id === unit.parentId,
      );
      TestValidator.equals("one owning model", owner?.symbol, "model");
      TestValidator.equals(
        "member belongs to its schema and table",
        unit.identity.slice(0, 2),
        owner?.identity,
      );
    }
  }
  const index = new EvidenceInventory([inventory]);
  const selected = inventory.units.map((unit) => unit.id);
  TestValidator.equals(
    "literal dots resolve without invented owners",
    index.resolve(
      {
        file: "/project/schema.sql",
        segments: ["main", "Order.Items", "id.part"],
      },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "split literal dots do not resolve",
    index.resolve(
      {
        file: "/project/schema.sql",
        segments: ["main", "Order", "Items", "id", "part"],
      },
      selected,
    ).status,
    "missing",
  );

  // Schema identity and content survive relocation while file-qualified addresses move.
  const relocated = await new EvidenceSqliteAdapter().analyze(
    TestSourceSnapshot.create("moved.sql", source),
  );
  TestValidator.equals(
    "file-independent schema identities",
    relocated.units.map((unit) => unit.id),
    inventory.units.map((unit) => unit.id),
  );
  for (const unit of inventory.units)
    TestValidator.equals(
      "relocation-stable fingerprint",
      EvidenceFingerprint.inspect(inventory, unit.id).fingerprint,
      EvidenceFingerprint.inspect(relocated, unit.id).fingerprint,
    );

  // SQLite's main schema is implicit and quoted identifiers remain ASCII-insensitive.
  const duplicate = await new EvidenceSqliteAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "one.sql",
        'CREATE TABLE "Accounts" (id INTEGER);',
      ),
      TestSourceSnapshot.create(
        "two.sql",
        "CREATE TABLE main.accounts (ID INTEGER);",
      ),
    ]),
  );
  TestValidator.equals(
    "duplicate runtime declarations cannot merge as overloads",
    duplicate.complete,
    false,
  );

  const schemas = await new EvidenceSqliteAdapter().analyze(
    TestSourceSnapshot.create(
      "two-schemas.sql",
      "CREATE TABLE Item (id INTEGER); CREATE TEMP TABLE Item (id INTEGER);",
    ),
  );
  const schemaIndex = new EvidenceInventory([schemas]);
  const schemaIds = schemas.units.map((unit) => unit.id);
  for (const schema of ["main", "temp"])
    TestValidator.equals(
      "qualified alias distinguishes same-name schemas",
      schemaIndex.resolve(
        { file: "/project/two-schemas.sql", segments: [schema, "Item", "id"] },
        schemaIds,
      ).status,
      "resolved",
    );
  TestValidator.equals(
    "unqualified alias stays ambiguous across schemas",
    schemaIndex.resolve(
      { file: "/project/two-schemas.sql", segments: ["Item"] },
      schemaIds,
    ).status,
    "ambiguous",
  );
}
