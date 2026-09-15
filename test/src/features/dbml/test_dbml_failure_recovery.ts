import { EvidenceDbmlAdapter, EvidenceInventory, EvidenceFingerprint } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Prevents malformed, conflicting, unsupported, or unresolved DBML from passing
 * with a smaller inventory.
 *
 * A failed schema analysis must retain incompleteness until the underlying
 * source is repaired rather than reporting empty coverage.
 *
 * 1. Analyze malformed, conflicting, unsupported, and unresolved DBML source.
 * 2. Require each case to report incompleteness with its diagnostic.
 * 3. Repair the affected source and require normal schema analysis to recover.
 */
export async function test_dbml_failure_recovery(): Promise<void> {
  const adapter = new EvidenceDbmlAdapter();
  const failures = [
    "Table users { id int [ref] }",
    "Enum state { active active }",
    "Enum state { active } Enum public.state { inactive }",
    'Table "users { id int }',
    "Table users { id int }\nRef: users.id > absent.id",
    "Table users { id int }\nTable public.users { other int }",
    "Table users { id int id text }",
    "Table users as U { id int }\nTable other as U { id int }",
    "Table users { id int tenant int }\nRef: users.(id, tenant) > users.id",
    "Table users { id int }\nRef: users.(id, id) > users.(id, id)",
    "TablePartial common { id int }\nTable users { ~common }",
    "Table users { id int }\nTableGroup selected { users }",
    "Table users { id int }\nTable other { id int }\nRef same: users.id > other.id\nRef same: users.id > other.id",
    'import "external.dbml"',
    "Table users { id int }\nRef: users.id >? users.id",
  ];
  for (const content of failures) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.dbml", content),
    );
    TestValidator.equals(
      `incomplete source: ${content}`,
      inventory.complete,
      false,
    );
    TestValidator.predicate(
      "actionable DBML failure",
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.code.startsWith("dbml-") &&
          diagnostic.repair !== undefined,
      ),
    );
  }
  const inaccessible = await adapter.analyze(
    EvidenceTestSourceSnapshot.fail(
      EvidenceTestSourceSnapshot.create("schema.dbml", "Table users { id int }"),
      {
        code: "path-unreadable",
        path: "/project/schema.dbml",
        message: "The selected source is inaccessible.",
      },
    ),
  );
  TestValidator.equals(
    "source failure stays incomplete",
    inaccessible.complete,
    false,
  );

  // Missing cross-file endpoints become complete when the newly selected source arrives.
  const dependent = EvidenceTestSourceSnapshot.create(
    "relations.dbml",
    dedent`
    Table posts { user_id int }
    Ref owner: posts.user_id > users.id
  `,
  );
  const base = EvidenceTestSourceSnapshot.create(
    "users.dbml",
    "Table users { id int }",
  );
  const missing = await adapter.analyze(dependent);
  const recovered = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([dependent, base]),
  );
  TestValidator.equals("missing dependency fails", missing.complete, false);
  TestValidator.equals(
    "new source dependency recovers",
    recovered.diagnostics,
    [],
  );
  TestValidator.equals(
    "all cross-file dependencies retained",
    recovered.dependencies
      .map((entry) => entry.path)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
      ),
    ["/project/relations.dbml", "/project/users.dbml"],
  );
  const moved = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      dependent,
      EvidenceTestSourceSnapshot.create(
        "moved.dbml",
        "Table public.users { id int }",
      ),
    ]),
  );
  TestValidator.equals(
    "moving a model preserves schema identity",
    recovered.units
      .map((unit) => unit.id)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
      ),
    moved.units
      .map((unit) => unit.id)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
      ),
  );
  const hidden = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "hidden.dbml",
      "Table users { id int Note: '@hidden' }",
    ),
  );
  TestValidator.equals(
    "withdrawn parent hides its column",
    new EvidenceInventory([hidden]).select(
      hidden.units
        .filter((unit) => unit.symbol === "column")
        .map((unit) => unit.id),
    ).units.length,
    0,
  );
  TestValidator.equals(
    "withdrawn schema carries no eligible host",
    hidden.hosts.length,
    0,
  );

  // A changed endpoint participates in its owning model fingerprint.
  const altered = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "relations.dbml",
        (dependent.files[0]?.content ?? "").replace(" > ", " - "),
      ),
      base,
    ]),
  );
  const before = recovered.units.find(
    (unit) => unit.symbol === "model" && unit.identity.at(-1) === "posts",
  );
  const after = altered.units.find(
    (unit) => unit.symbol === "model" && unit.identity.at(-1) === "posts",
  );
  if (before === undefined || after === undefined)
    throw new Error("Expected posts model.");
  TestValidator.notEquals(
    "relation ownership/cardinality changes model fingerprint",
    EvidenceFingerprint.inspect(recovered, before.id).fingerprint,
    EvidenceFingerprint.inspect(altered, after.id).fingerprint,
  );
}
