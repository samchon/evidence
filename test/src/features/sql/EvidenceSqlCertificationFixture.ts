import { EvidenceAccessor, EvidenceSqlAdapter } from "evidence";
import type { EvidenceDatabaseSymbol, IEvidenceWithdrawal } from "evidence";
import { dedent } from "@typia/utils";
import type { IEvidenceDatabaseAdapterCertification } from "../../internal/certification/IEvidenceDatabaseAdapterCertification";
import type { IEvidenceDatabaseAdapterCertificationUnit } from "../../internal/certification/IEvidenceDatabaseAdapterCertificationUnit";

/**
 * Defines the portable SQL contract for shared database certification.
 *
 * This fixture keeps expected declarations, diagnostics, and fingerprint
 * behavior independent of the SQL scanner output under test.
 */
export namespace EvidenceSqlCertificationFixture {
  /**
   * Creates the complete portable SQL adapter certification fixture.
   *
   * Shared certification uses its model, column, relation, withdrawal, failure,
   * and fingerprint expectations to verify common database behavior.
   */
  export function create(): IEvidenceDatabaseAdapterCertification {
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
        -- @Evidence docs/requirements.md#model Implements the certified model.
        CREATE TABLE child (
          -- 값 🧪
          -- @Evidence docs/requirements.md#column Implements the certified column.
          id INTEGER,
          -- @internal Retired column.
          legacy INTEGER,
          -- 검증 🧪
          -- @Evidence docs/requirements.md#relation Implements the certified relation.
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
        -- @Evidence docs/requirements.md#attached Attached table documentation.
        CREATE TABLE example (
          value VARCHAR(100) DEFAULT '@Evidence docs/requirements.md#literal Inert SQL literal.'
        );
        -- @Evidence docs/requirements.md#orphan Detached comment.
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

    /**
     * Creates one contract-defined unit with its canonical source address.
     *
     * A supplied parent becomes the explicit model owner; omission preserves a
     * top-level model record.
     */
    function unit(
      symbol: EvidenceDatabaseSymbol,
      identity: string[],
      parent?: string[],
      withdrawals: IEvidenceWithdrawal["tag"][] = [],
    ): IEvidenceDatabaseAdapterCertificationUnit {
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
