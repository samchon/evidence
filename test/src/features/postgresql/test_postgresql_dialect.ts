import {
  EvidencePostgresqlAdapter,
  EvidenceSqlAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Applies configured PostgreSQL naming even when the same source also parses as portable SQL. */
export async function test_postgresql_dialect(): Promise<void> {
  const snapshot = TestSourceSnapshot.create(
    "schema.sql",
    "CREATE TABLE App.Item (ID INTEGER);",
  );
  const postgres = await new EvidencePostgresqlAdapter().analyze(snapshot);
  const portable = await new EvidenceSqlAdapter().analyze(snapshot);

  TestValidator.equals("PostgreSQL complete", postgres.diagnostics, []);
  TestValidator.equals("portable SQL complete", portable.diagnostics, []);
  TestValidator.equals(
    "PostgreSQL folds configured names to lowercase",
    postgres.units
      .map((unit) => unit.identity)
      .sort((a, b) => a.length - b.length),
    [
      ["app", "item"],
      ["app", "item", "id"],
    ],
  );
  TestValidator.equals(
    "portable SQL uses its independent naming contract",
    portable.units
      .map((unit) => unit.identity)
      .sort((a, b) => a.length - b.length),
    [
      ["APP", "ITEM"],
      ["APP", "ITEM", "ID"],
    ],
  );
}
