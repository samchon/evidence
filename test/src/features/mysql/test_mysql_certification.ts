import { EvidenceAccessor, EvidenceMysqlAdapter } from "@wrtnlabs/evidence";
import type { EvidenceDatabaseSymbol } from "@wrtnlabs/evidence";
import { dedent } from "@typia/utils";

import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";
import type { IDatabaseAdapterCertification } from "../../internal/certification/IDatabaseAdapterCertification";
import type { IDatabaseAdapterCertificationUnit } from "../../internal/certification/IDatabaseAdapterCertificationUnit";

/** Applies the shared database certification contract to MySQL.
 *
 * The MySQL fixture specifies expected inventory, coverage, failure, ambiguity, and fingerprint behavior at the database adapter boundary.
 *
 * 1. Construct the MySQL certification fixture.
 * 2. Execute the shared database certification suite.
 * 3. Require every declared adapter gate to pass.
 */
export async function test_mysql_certification(): Promise<void> {
  const relation = 'foreign-key:["parent_id"]->["Parent"](["id"])';
  const fixture: IDatabaseAdapterCertification = {
    type: "mysql",
    adapter: new EvidenceMysqlAdapter(),
    sources: [
      {
        file: "schema.sql",
        content: dedent`
      /* 계약 😀 */

      CREATE TABLE Parent (id INT PRIMARY KEY);
      /** @evidence ./docs/requirements.md#model Verifies the child model. */
      CREATE TABLE Child (
        /** @evidence ./docs/requirements.md#column Verifies the parent identifier. */
        parent_id INT,
        /** @evidence ./docs/requirements.md#relation Verifies the foreign key. */
        FOREIGN KEY (parent_id) REFERENCES Parent (id)
      );
    `,
      },
    ],
    units: [
      unit("model", ["Parent"]),
      unit("column", ["Parent", "id"], "model:Parent"),
      unit("model", ["Child"]),
      unit("column", ["Child", "parent_id"], "model:Child"),
      unit("relation", ["Child", relation], "model:Child"),
    ],
    hosts: [
      { attachment: "attached", units: ["model:Parent"] },
      { attachment: "attached", units: ["column:Parent.id"] },
      { attachment: "attached", units: ["model:Child"] },
      { attachment: "attached", units: ["column:Child.parent_id"] },
      {
        attachment: "attached",
        units: [`relation:${EvidenceAccessor.format(["Child", relation])}`],
      },
    ],
    requirements: [
      { unit: "model:Child", target: "./docs/requirements.md#model" },
      {
        unit: "column:Child.parent_id",
        target: "./docs/requirements.md#column",
      },
      {
        unit: `relation:${EvidenceAccessor.format(["Child", relation])}`,
        target: "./docs/requirements.md#relation",
      },
    ],
    excludedUnits: ["relation:Parent.id"],
    annotationRanges: 3,
    incomplete: {
      sources: [
        {
          file: "schema.sql",
          content:
            "CREATE TABLE t (id INT); ALTER TABLE t ADD COLUMN added INT;",
        },
      ],
      diagnosticCodes: ["sql-unsupported-syntax"],
    },
    malformed: {
      sources: [{ file: "schema.sql", content: "CREATE TABLE t (id INT;" }],
      diagnosticCodes: ["mysql-parse-incomplete"],
    },
    falsePositive: {
      source: {
        file: "schema.sql",
        content: dedent`
      /** @evidence ./docs/requirements.md#attached Verifies the table. */
      CREATE TABLE Source (value TEXT DEFAULT '@evidence ./docs/requirements.md#inert Inert SQL string.');
    `,
      },
      attachedTarget: "./docs/requirements.md#attached",
      unsupportedAnnotations: 0,
    },
    mutation: {
      unit: "model:Child",
      reasonBefore: "Verifies the parent identifier.",
      reasonAfter: "Checks the parent identifier.",
      contentBefore: "parent_id INT",
      contentAfter: "parent_id BIGINT",
    },
  };

  DatabaseAdapterCertification.assertInventory(
    fixture,
    await DatabaseAdapterCertification.analyze(fixture),
  );
  await DatabaseAdapterCertification.assertGraph(fixture);
  await DatabaseAdapterCertification.assertFailures(fixture);
  await DatabaseAdapterCertification.assertFingerprint(fixture);
  await DatabaseAdapterCertification.assertAmbiguity(fixture);
}

/** Creates one MySQL unit expectation independently of parser output.
 *
 * The helper formats the semantic identity once for its key and source address,
 * preserving an explicit parent only for members owned by a model.
 */
function unit(
  symbol: EvidenceDatabaseSymbol,
  identity: string[],
  parent?: string,
): IDatabaseAdapterCertificationUnit {
  const accessor = EvidenceAccessor.format(identity);
  return {
    key: `${symbol}:${accessor}`,
    symbol,
    identity,
    sites: 1,
    addresses: [{ file: "schema.sql", accessor }],
    withdrawals: [],
    ...(parent === undefined ? {} : { parent }),
  };
}
