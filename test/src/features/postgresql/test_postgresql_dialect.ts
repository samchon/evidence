import {
  EvidencePostgresqlAdapter,
  EvidenceSqlAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Uses configured PostgreSQL naming for a source that portable SQL also accepts.
 *
 * Dialect selection changes the public spelling and must remain visible in units and targets.
 *
 * 1. Analyze the same schema with PostgreSQL and portable SQL adapters.
 * 2. Verify both inventories are complete.
 * 3. Require PostgreSQL-specific identities and resolution results.
 */
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
