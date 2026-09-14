import typia from "typia";

import type { ISqlFileAnalysis } from "../sql/ISqlFileAnalysis";
import type { IPostgresqlFileAnalysis } from "./IPostgresqlFileAnalysis";

/** Reconciles ALTER and COMMENT sites independently of selected file ordering. */
export namespace PostgresqlOwnership {
  /** Requires one declared owner and retains all extension sites for fingerprints. */
  export function resolve(input: ISqlFileAnalysis[]): void {
    const analyses = typia.assert<IPostgresqlFileAnalysis[]>(input);
    const declarations = analyses.flatMap((analysis) => analysis.declarations);
    for (const analysis of analyses)
      for (const reference of analysis.references ?? []) {
        const declaration = analysis.declarations.find(
          (candidate) => candidate.id === reference.declarationId,
        );
        if (declaration === undefined) continue;
        const matches = declarations.filter(
          (candidate) =>
            candidate.merge !== true &&
            candidate.symbol === declaration.symbol &&
            JSON.stringify(candidate.identity) ===
              JSON.stringify(reference.identity),
        );
        const original = matches[0];
        if (matches.length !== 1 || original === undefined) {
          analysis.complete = false;
          analysis.diagnostics.push({
            code: "postgresql-unresolved-owner",
            severity: "error",
            message: `PostgreSQL ${reference.comment ? "COMMENT" : "ALTER"} target '${reference.identity.join(".")}' needs exactly one selected declaration.`,
            repair:
              "Select the schema-qualified CREATE TABLE declaration and remove conflicting definitions.",
            location: {
              file: analysis.source.physicalPath,
              range: declaration.site.range,
            },
          });
          declaration.public = false;
          continue;
        }
        if (original.ownerDeclarationId !== undefined)
          declaration.ownerDeclarationId = original.ownerDeclarationId;
      }
  }
}
