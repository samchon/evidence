import typia from "typia";

import type { ISqlFileAnalysis } from "../sql/ISqlFileAnalysis";
import type { IPostgresqlFileAnalysis } from "./IPostgresqlFileAnalysis";

/** Reconciles ALTER and COMMENT sites independently of selected file ordering.
 *
 * PostgreSQL permits extension statements in other files, so publication waits
 * until a unique selected declaration can establish their semantic ownership.
 */
export namespace PostgresqlOwnership {
  /** Resolves every deferred extension against exactly one declaration.
   *
   * Ambiguity makes analysis incomplete rather than allowing an ALTER or COMMENT
   * to silently attach to an arbitrary same-named table.
   */
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
        const comments = analyses
          .flatMap((candidate) => candidate.references ?? [])
          .filter(
            (candidate) =>
              candidate.comment &&
              JSON.stringify(candidate.identity) ===
                JSON.stringify(reference.identity),
          );
        if (
          matches.length !== 1 ||
          original === undefined ||
          (reference.comment && comments.length !== 1)
        ) {
          analysis.complete = false;
          analysis.diagnostics.push({
            code: "postgresql-unresolved-owner",
            severity: "error",
            message: `PostgreSQL ${reference.comment ? "COMMENT" : "ALTER"} target '${reference.identity.join(".")}' needs exactly one selected declaration and at most one COMMENT assignment.`,
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
    const unavailable = new Set(
      declarations
        .filter((declaration) => !declaration.public)
        .map((declaration) => declaration.id),
    );
    for (const declaration of declarations)
      if (
        declaration.ownerDeclarationId !== undefined &&
        unavailable.has(declaration.ownerDeclarationId)
      )
        declaration.public = false;
  }
}
