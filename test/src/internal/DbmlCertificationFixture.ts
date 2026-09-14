import { EvidenceAccessor, EvidenceDbmlAdapter } from "@wrtnlabs/evidence";
import type { EvidenceDatabaseSymbol } from "@wrtnlabs/evidence";
import { dedent } from "@typia/utils";

import type { IDatabaseAdapterCertification } from "./certification/IDatabaseAdapterCertification";
import type { IDatabaseAdapterCertificationUnit } from "./certification/IDatabaseAdapterCertificationUnit";

/** Independent exact fixture for DBML schema declarations and annotation ownership. */
export namespace DbmlCertificationFixture {
  /** Supplies model, column and relation coverage with default exposure and withdrawal controls. */
  export function create(): IDatabaseAdapterCertification {
    const file = "schema/certification.dbml";
    const model = key("model", ["public", "users"]);
    const column = key("column", ["public", "posts", "user_id"]);
    const relation = key("relation", ["public", "posts", "$ref:owner"]);
    return {
      type: "dbml",
      adapter: new EvidenceDbmlAdapter(),
      sources: [
        {
          file,
          content: dedent`
        /* 😀 @evidence is inert mid-line prose.
         * @evidence ../docs/requirements.md#model Persists the account identity.
         */
        Table users {
          id int [pk]
        }
        Table posts {
          /* 😀
           * @evidence ../docs/requirements.md#column Stores the account foreign key.
           */
          user_id int
        }
        /* 😀
         * @evidence ../docs/requirements.md#relation Connects each post to its account.
         */
        Ref owner: posts.user_id > users.id
        Table hidden {
          id int
          Note: '@internal'
        }
      `,
        },
      ],
      units: [
        unit(file, "model", ["public", "users"]),
        unit(file, "column", ["public", "users", "id"]),
        unit(file, "model", ["public", "posts"]),
        unit(file, "column", ["public", "posts", "user_id"]),
        unit(file, "relation", ["public", "posts", "$ref:owner"]),
        {
          ...unit(file, "model", ["public", "hidden"]),
          withdrawals: ["internal"],
        },
        unit(file, "column", ["public", "hidden", "id"]),
      ],
      hosts: [
        model,
        key("column", ["public", "users", "id"]),
        key("model", ["public", "posts"]),
        column,
        relation,
      ].map((name) => ({ attachment: "attached", units: [name] })),
      requirements: [
        { unit: model, target: "../docs/requirements.md#model" },
        { unit: column, target: "../docs/requirements.md#column" },
        { unit: relation, target: "../docs/requirements.md#relation" },
      ],
      excludedUnits: ["model:status"],
      annotationRanges: 4,
      incomplete: {
        sources: [{ file, content: "TablePartial common { id int }" }],
        diagnosticCodes: ["dbml-unsupported-syntax"],
      },
      malformed: {
        sources: [{ file, content: "Table users { id int" }],
        diagnosticCodes: ["dbml-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file,
          content: dedent`
        /* @evidence ../docs/requirements.md#attached Owns the schema table. */
        Table users {
          id int
          example text [default: '@evidence ../docs/requirements.md#literal Inert default value.']
          Note: '''
          \`\`\`
          @evidence ../docs/requirements.md#example Inert fenced example.
          \`\`\`
          '''
        }
      `,
        },
        attachedTarget: "../docs/requirements.md#attached",
        unsupportedAnnotations: 0,
      },
      mutation: {
        unit: model,
        reasonBefore: "Persists the account identity.",
        reasonAfter: "Records the stable account identity.",
        contentBefore: "id int [pk]",
        contentAfter: "id bigint [pk]",
      },
    };
  }

  /** Formats expected unit keys from literal contract segments. */
  function key(symbol: EvidenceDatabaseSymbol, identity: string[]): string {
    return `${symbol}:${EvidenceAccessor.format(identity)}`;
  }

  /** Constructs expected canonical and default-schema addresses without consulting extraction. */
  function unit(
    file: string,
    symbol: EvidenceDatabaseSymbol,
    identity: string[],
  ): IDatabaseAdapterCertificationUnit {
    return {
      key: key(symbol, identity),
      symbol,
      identity,
      ...(symbol === "model"
        ? {}
        : { parent: key("model", identity.slice(0, 2)) }),
      sites: 1,
      addresses: [identity, identity.slice(1)].map((segments) => ({
        file,
        accessor: EvidenceAccessor.format(segments),
      })),
      withdrawals: [],
    };
  }
}
