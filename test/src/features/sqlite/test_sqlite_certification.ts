import { EvidenceSqliteAdapter } from "@wrtnlabs/evidence";
import { dedent } from "@typia/utils";

import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";
import type { IDatabaseAdapterCertification } from "../../internal/certification/IDatabaseAdapterCertification";

/** Runs the common inventory, missing-edge, ambiguity, and fingerprint gates on independently authored SQLite expectations. */
export async function test_sqlite_certification(): Promise<void> {
  const fixture: IDatabaseAdapterCertification = {
    type: "sqlite",
    adapter: new EvidenceSqliteAdapter(),
    sources: [
      {
        file: "schema.sql",
        content: dedent`
      -- SQLite 계약 😀
      -- @evidence docs/requirements.md#model Describes the table.
      CREATE TABLE Account (
        -- @evidence docs/requirements.md#column Describes the owner.
        owner INTEGER DEFAULT 1,
        -- @evidence docs/requirements.md#relation Describes the foreign key.
        CONSTRAINT owner_link FOREIGN KEY (owner) REFERENCES Owners(id)
      );
    `,
      },
    ],
    units: [
      {
        key: "model:main.account",
        symbol: "model",
        identity: ["main", "account"],
        sites: 1,
        addresses: [{ file: "schema.sql", accessor: "Account" }, { file: "schema.sql", accessor: "main.Account" }],
        withdrawals: [],
      },
      {
        key: "column:main.account.owner",
        symbol: "column",
        identity: ["main", "account", "owner"],
        parent: "model:main.account",
        sites: 1,
        addresses: [{ file: "schema.sql", accessor: "Account.owner" }, { file: "schema.sql", accessor: "main.Account.owner" }],
        withdrawals: [],
      },
      {
        key: 'relation:main.account["foreign key:owner_link"]',
        symbol: "relation",
        identity: ["main", "account", "foreign key:owner_link"],
        parent: "model:main.account",
        sites: 1,
        addresses: [
          { file: "schema.sql", accessor: 'Account["foreign key:owner_link"]' },
          { file: "schema.sql", accessor: 'main.Account["foreign key:owner_link"]' },
        ],
        withdrawals: [],
      },
    ],
    hosts: [
      { attachment: "attached", units: ["model:main.account"] },
      { attachment: "attached", units: ["column:main.account.owner"] },
      {
        attachment: "attached",
        units: ['relation:main.account["foreign key:owner_link"]'],
      },
    ],
    requirements: [
      { unit: "model:main.account", target: "docs/requirements.md#model" },
      {
        unit: "column:main.account.owner",
        target: "docs/requirements.md#column",
      },
      {
        unit: 'relation:main.account["foreign key:owner_link"]',
        target: "docs/requirements.md#relation",
      },
    ],
    excludedUnits: [],
    annotationRanges: 3,
    incomplete: {
      sources: [
        {
          file: "schema.sql",
          content: "CREATE TABLE derived AS SELECT 1 AS id;",
        },
      ],
      diagnosticCodes: ["unsupported-sqlite-syntax"],
    },
    malformed: {
      sources: [
        { file: "schema.sql", content: "CREATE TABLE malformed (id INTEGER," },
      ],
      diagnosticCodes: ["sqlite-parse-incomplete"],
    },
    falsePositive: {
      source: {
        file: "schema.sql",
        content: dedent`
      -- @evidence docs/requirements.md#attached Real documentation.
      CREATE TABLE Plain (text_value TEXT DEFAULT '@evidence docs/requirements.md#literal Inert text.');
      -- @evidence docs/requirements.md#detached Detached comment.
    `,
      },
      attachedTarget: "docs/requirements.md#attached",
      unsupportedAnnotations: 1,
    },
    mutation: {
      unit: "model:main.account",
      reasonBefore: "Describes the owner.",
      reasonAfter: "Explains the owner.",
      contentBefore: "DEFAULT 1",
      contentAfter: "DEFAULT 2",
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
