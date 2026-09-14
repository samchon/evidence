import {
  EvidenceAccessor,
  EvidencePostgresqlAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";
import type { IDatabaseAdapterCertification } from "../../internal/certification/IDatabaseAdapterCertification";

/** Applies the shared database certification contract to PostgreSQL.
 *
 * The PostgreSQL fixture fixes expected inventory, graph, fingerprint, and mutation behavior.
 *
 * 1. Construct the PostgreSQL certification fixture.
 * 2. Execute the shared database certification suite.
 * 3. Require every declared gate to pass.
 */
export async function test_postgresql_certification(): Promise<void> {
  const relation = 'foreign key ["id"] references ["app","parent","id"]';
  const relationAccessor = EvidenceAccessor.format(["app", "item", relation]);
  const fixture: IDatabaseAdapterCertification = {
    type: "postgresql",
    adapter: new EvidencePostgresqlAdapter(),
    sources: [
      {
        file: "schema.sql",
        content: dedent`
      -- PostgreSQL 🐘
      -- @evidence docs/requirements.md#model Describes the table.
      CREATE TABLE app.Item (
        -- @evidence docs/requirements.md#column Describes the identifier.
        id integer,
        -- @evidence docs/requirements.md#relation Describes the foreign key.
        FOREIGN KEY (id) REFERENCES app.Parent (id)
      );
    `,
      },
    ],
    units: [
      {
        key: "model:app.item",
        symbol: "model",
        identity: ["app", "item"],
        sites: 1,
        addresses: [{ file: "schema.sql", accessor: "app.item" }],
        withdrawals: [],
      },
      {
        key: "column:app.item.id",
        symbol: "column",
        identity: ["app", "item", "id"],
        parent: "model:app.item",
        sites: 1,
        addresses: [{ file: "schema.sql", accessor: "app.item.id" }],
        withdrawals: [],
      },
      {
        key: `relation:${relationAccessor}`,
        symbol: "relation",
        identity: ["app", "item", relation],
        parent: "model:app.item",
        sites: 1,
        addresses: [{ file: "schema.sql", accessor: relationAccessor }],
        withdrawals: [],
      },
    ],
    hosts: [
      { attachment: "attached", units: ["model:app.item"] },
      { attachment: "attached", units: ["column:app.item.id"] },
      { attachment: "attached", units: [`relation:${relationAccessor}`] },
    ],
    requirements: [
      { unit: "model:app.item", target: "docs/requirements.md#model" },
      { unit: "column:app.item.id", target: "docs/requirements.md#column" },
      {
        unit: `relation:${relationAccessor}`,
        target: "docs/requirements.md#relation",
      },
    ],
    excludedUnits: [],
    annotationRanges: 3,
    incomplete: {
      sources: [
        { file: "schema.sql", content: "CREATE TABLE Item (id integer);" },
      ],
      diagnosticCodes: ["postgresql-unsupported-syntax"],
    },
    malformed: {
      sources: [
        { file: "schema.sql", content: "CREATE TABLE app.Item (id integer" },
      ],
      diagnosticCodes: ["postgresql-parse-incomplete"],
    },
    falsePositive: {
      source: {
        file: "schema.sql",
        content: dedent`
        -- PostgreSQL 🐘
        -- @evidence docs/requirements.md#attached Describes the table.
        CREATE TABLE app.Item (value text DEFAULT '@evidence docs/requirements.md#string Inert literal.');
        -- @evidence docs/requirements.md#unattached No following declaration.
      `,
      },
      attachedTarget: "docs/requirements.md#attached",
      unsupportedAnnotations: 1,
    },
    mutation: {
      unit: "model:app.item",
      reasonBefore: "Describes the identifier.",
      reasonAfter: "Documents this identifier.",
      contentBefore: "id integer",
      contentAfter: "id bigint",
    },
  };

  const inventory = await DatabaseAdapterCertification.analyze(fixture);
  DatabaseAdapterCertification.assertInventory(fixture, inventory);
  await DatabaseAdapterCertification.assertGraph(fixture);
  await DatabaseAdapterCertification.assertFailures(fixture);
  await DatabaseAdapterCertification.assertFingerprint(fixture);
  await DatabaseAdapterCertification.assertAmbiguity(fixture);
  for (const mutation of ["unit", "kind", "host", "alias"]) {
    const mutated = structuredClone(inventory);
    if (mutation === "unit") mutated.units.pop();
    else if (mutation === "kind") {
      const unit = mutated.units[0];
      if (unit !== undefined)
        unit.symbol = unit.symbol === "column" ? "relation" : "column";
    } else if (mutation === "host") {
      const host = mutated.hosts[0];
      if (host !== undefined) host.attachment = "unsupported";
    } else {
      const address = mutated.addresses[0];
      if (address !== undefined) address.segments = ["wrong"];
    }
    let rejected = false;
    try {
      DatabaseAdapterCertification.assertInventory(fixture, mutated);
    } catch {
      rejected = true;
    }
    TestValidator.equals(
      `certification rejects changed ${mutation}`,
      rejected,
      true,
    );
  }
}
