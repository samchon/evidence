import { EvidAccessor, EvidBigQueryAdapter } from "evid";
import type {
  EvidDatabaseSymbol,
  IEvidWithdrawal,
} from "evid";
import { dedent } from "@typia/utils";

import type { IEvidDatabaseAdapterCertification } from "../../internal/certification/IEvidDatabaseAdapterCertification";
import type { IEvidDatabaseAdapterCertificationUnit } from "../../internal/certification/IEvidDatabaseAdapterCertificationUnit";

/** Defines independent GoogleSQL expectations for shared database certification.
 *
 * The fixture supplies the semantic inventory and failure contract that the
 * BigQuery adapter must satisfy without deriving expected values from its own
 * syntax-tree output.
 */
export namespace BigQueryCertificationFixture {
  /** Creates the complete BigQuery adapter certification fixture.
   *
   * Shared certification consumes its selectors, documentation hosts,
   * withdrawals, failure controls, and semantic mutation expectations.
   */
  export function create(): IEvidDatabaseAdapterCertification {
    const file = "src/certification.bqsql";
    const units = [
      unit("model", ["project", "dataset", "child"]),
      unit("column", ["project", "dataset", "child", "id"], []),
      unit("column", ["project", "dataset", "child", "legacy"], ["internal"]),
      unit("relation", ["project", "dataset", "child", "parent_key"], []),
    ];
    return {
      type: "bigquery",
      adapter: new EvidBigQueryAdapter(),
      sources: [
        {
          file,
          content: dedent`
        -- 😀 Schema
        -- @evidence docs/requirements.md#model Implements the certified model.
        CREATE TABLE \`project.dataset.child\` (
          -- 😀 Identity
          -- @evidence docs/requirements.md#column Implements the certified column.
          id INT64,
          -- @internal Retired field.
          legacy STRING,
          -- 😀 Relationship
          -- @evidence docs/requirements.md#relation Implements the certified relation.
          CONSTRAINT parent_key FOREIGN KEY (id) REFERENCES project.dataset.parent (id) NOT ENFORCED
        );
      `,
        },
      ],
      units,
      hosts: units
        .filter((entry) => entry.withdrawals.length === 0)
        .map((entry) => ({ attachment: "attached", units: [entry.key] })),
      requirements: [
        {
          unit: "model:project.dataset.child",
          target: "docs/requirements.md#model",
        },
        {
          unit: "column:project.dataset.child.id",
          target: "docs/requirements.md#column",
        },
        {
          unit: "relation:project.dataset.child.parent_key",
          target: "docs/requirements.md#relation",
        },
      ],
      excludedUnits: [],
      annotationRanges: 4,
      incomplete: {
        sources: [
          { file, content: "ALTER TABLE ds.child ADD COLUMN more INT64;" },
        ],
        diagnosticCodes: ["bigquery-unsupported-syntax"],
      },
      malformed: {
        sources: [{ file, content: "CREATE TABLE ds.broken (id INT64;" }],
        diagnosticCodes: ["bigquery-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file,
          content: dedent`
        -- @evidence docs/requirements.md#attached Attached table documentation.
        CREATE TABLE ds.example (value STRING DEFAULT '@evidence docs/requirements.md#literal Inert SQL literal.');
        -- @evidence docs/requirements.md#orphan Detached comment.
      `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 1,
      },
      mutation: {
        unit: "column:project.dataset.child.id",
        reasonBefore: "Implements the certified column.",
        reasonAfter: "Explains the certified column differently.",
        contentBefore: "id INT64",
        contentAfter: "id NUMERIC",
      },
    };

    /** Creates one independently specified model or owned member expectation.
     *
     * The helper derives its canonical address from semantic identity and
     * assigns non-model records to the fixture's certified model owner.
     */
    function unit(
      symbol: EvidDatabaseSymbol,
      identity: string[],
      withdrawals?: IEvidWithdrawal["tag"][],
    ): IEvidDatabaseAdapterCertificationUnit {
      return {
        key: `${symbol}:${EvidAccessor.format(identity)}`,
        symbol,
        identity,
        sites: 1,
        addresses: [{ file, accessor: EvidAccessor.format(identity) }],
        withdrawals: withdrawals ?? [],
        ...(symbol === "model"
          ? {}
          : { parent: "model:project.dataset.child" }),
      };
    }
  }
}
