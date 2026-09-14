import { EvidenceAccessor, EvidenceSqlAdapter } from "@wrtnlabs/evidence";
import type {
  EvidenceDatabaseSymbol,
  IEvidenceWithdrawal,
} from "@wrtnlabs/evidence";
import { dedent } from "@typia/utils";
import type { IDatabaseAdapterCertification } from "../../internal/certification/IDatabaseAdapterCertification";
import type { IDatabaseAdapterCertificationUnit } from "../../internal/certification/IDatabaseAdapterCertificationUnit";

/** Exact portable SQL contract independent of parser output. */
export namespace SqlCertificationFixture {
  /** Supplies model, column, relation, withdrawal, failure, and fingerprint expectations. */
  export function create(): IDatabaseAdapterCertification {
    const file = "src/certification.sql";
    const relation = 'foreign-key:["ID"]->["PARENT"](["ID"])';
    const units = [
      unit("model", ["CHILD"]),
      unit("column", ["CHILD", "ID"], ["CHILD"]),
      unit("column", ["CHILD", "LEGACY"], ["CHILD"], ["internal"]),
      unit("relation", ["CHILD", relation], ["CHILD"]),
    ];
    return {
      type: "sql",
      adapter: new EvidenceSqlAdapter(),
      sources: [
        {
          file,
          content: dedent`
        -- 검증 🧪
        -- @evidence docs/requirements.md#model Implements the certified model.
        CREATE TABLE child (
          -- 값 🧪
          -- @evidence docs/requirements.md#column Implements the certified column.
          id INTEGER,
          -- @internal Retired column.
          legacy INTEGER,
          -- 검증 🧪
          -- @evidence docs/requirements.md#relation Implements the certified relation.
          FOREIGN KEY (id) REFERENCES parent(id)
        );
      `,
        },
      ],
      units,
      hosts: units
        .filter((entry) => entry.withdrawals.length === 0)
        .map((entry) => ({ attachment: "attached", units: [entry.key] })),
      requirements: [
        { unit: "model:CHILD", target: "docs/requirements.md#model" },
        { unit: "column:CHILD.ID", target: "docs/requirements.md#column" },
        {
          unit: `relation:${EvidenceAccessor.format(["CHILD", relation])}`,
          target: "docs/requirements.md#relation",
        },
      ],
      excludedUnits: [],
      annotationRanges: 4,
      incomplete: {
        sources: [
          { file, content: "ALTER TABLE child ADD COLUMN more INTEGER;" },
        ],
        diagnosticCodes: ["sql-unsupported-syntax"],
      },
      malformed: {
        sources: [{ file, content: "CREATE TABLE broken (id INTEGER;" }],
        diagnosticCodes: ["sql-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file,
          content: dedent`
        -- @evidence docs/requirements.md#attached Attached table documentation.
        CREATE TABLE example (
          value VARCHAR(100) DEFAULT '@evidence docs/requirements.md#literal Inert SQL literal.'
        );
        -- @evidence docs/requirements.md#orphan Detached comment.
      `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 1,
      },
      mutation: {
        unit: "column:CHILD.ID",
        reasonBefore: "Implements the certified column.",
        reasonAfter: "Explains the certified column differently.",
        contentBefore: "id INTEGER",
        contentAfter: "id BIGINT",
      },
    };

    /** Constructs one contract-defined unit and canonical address. */
    function unit(
      symbol: EvidenceDatabaseSymbol,
      identity: string[],
      parent?: string[],
      withdrawals: IEvidenceWithdrawal["tag"][] = [],
    ): IDatabaseAdapterCertificationUnit {
      return {
        key: `${symbol}:${EvidenceAccessor.format(identity)}`,
        symbol,
        identity,
        sites: 1,
        addresses: [{ file, accessor: EvidenceAccessor.format(identity) }],
        withdrawals,
        ...(parent === undefined
          ? {}
          : { parent: `model:${EvidenceAccessor.format(parent)}` }),
      };
    }
  }
}
