import {
  EvidBigQueryAdapter,
  EvidTypeScriptAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves BigQuery targets with quoted segments and source-file aliases intact.
 *
 * A target resolver must preserve project, dataset, table, and flexible field boundaries when it follows evidence across files.
 *
 * 1. Build a schema with qualified, quoted, and nested declaration names.
 * 2. Resolve evidence targets that use the supported file aliases and literal accessor spelling.
 * 3. Require exact paths to resolve while flattened or otherwise invalid paths retain their failure status.
 */
export async function test_bigquery_targets(): Promise<void> {
  const reference = await new EvidBigQueryAdapter().analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      dedent`
    CREATE TABLE \`acme-prod.dataset.orders\` (\`display name\` STRING);
  `,
      ["schema.sql", "alias.sql"],
    ),
  );
  const claims = await new EvidTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "claims.ts",
      dedent`
    /** @evid ./schema.sql#["acme-prod"].dataset.orders["display name"] Cites the literal field. */
    export function original() {}
    /** @evid ./alias.sql#["acme-prod"].dataset.orders["display name"] Cites the file alias. */
    export function alias() {}
    /** @evid ./schema.sql#["acme-prod"].dataset.orders.missing Names no declared field. */
    export function missing() {}
  `,
    ),
  );
  TestValidator.equals(
    "qualified schema is complete",
    reference.diagnostics,
    [],
  );
  const selected = reference.units
    .filter((unit) => unit.symbol === "column")
    .map((unit) => unit.id);
  const resolutions = await TestGraph.resolveDeclarations(
    claims,
    reference,
    selected,
  );
  for (const [reason, status] of [
    ["Cites the literal field.", "resolved"],
    ["Cites the file alias.", "resolved"],
    ["Names no declared field.", "missing-member"],
  ] as const) {
    const declaration = claims.declarations.find(
      (candidate) => candidate.reason === reason,
    );
    if (declaration === undefined) throw new Error(`Missing claim: ${reason}`);
    const resolution = resolutions.find(
      (candidate) => candidate.declarationId === declaration.id,
    );
    if (resolution === undefined)
      throw new Error(`Missing resolution: ${reason}`);
    TestValidator.equals(reason, resolution.resolution.status, status);
  }
  TestValidator.equals(
    "aliases identify one semantic column",
    resolutions
      .filter((resolution) => resolution.resolution.status === "resolved")
      .map((resolution) => resolution.resolution.units.map((unit) => unit.id)),
    [selected, selected],
  );
}
