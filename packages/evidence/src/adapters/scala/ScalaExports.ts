import type { IScalaDeclaration } from "./IScalaDeclaration";
import type { IScalaFileAnalysis } from "./IScalaFileAnalysis";

/** Resolves named exports as alternate addresses of selected public source members. */
export namespace ScalaExports {
  /** Keeps source ownership and identity while attaching the export's own declaration site. */
  export function resolve(analyses: IScalaFileAnalysis[]): void {
    const declarations = analyses.flatMap((analysis) => analysis.declarations);
    for (const analysis of analyses) for (const exported of analysis.exports) {
      let owners: IScalaDeclaration[] = [];
      for (const path of exported.paths) {
        owners = declarations.filter((declaration) => declaration.object && JSON.stringify(declaration.lookup) === JSON.stringify(path));
        if (owners.length !== 0) break;
      }
      const owner = owners.length === 1 ? owners[0] : undefined;
      const targets = owner === undefined ? [] : declarations.filter((declaration) => declaration.ownerDeclarationId === owner.id && declaration.name === exported.member && declaration.public && declaration.syntax !== "export_declaration");
      const identities = new Set(targets.map((target) => `${target.symbol}:${JSON.stringify(target.identity)}`));
      const target = identities.size === 1 ? targets[0] : undefined;
      if (target === undefined || targets.some((candidate) => declarations.some((child) => child.ownerDeclarationId === candidate.id))) {
        analysis.complete = false;
        analysis.diagnostics.push({ code: "scala-export-resolution", severity: "error", message: `Export '${exported.member}' requires one selected public object member without nested declarations. Missing, ambiguous, restricted, chained, and container exports cannot establish a complete surface.`, repair: "Select the declaring singleton object and export a named leaf member, or implement the required export resolution.", location: { file: analysis.source.physicalPath, range: exported.declaration.site.range } });
        continue;
      }
      exported.declaration.public = true;
      exported.declaration.identity = target.identity;
      exported.declaration.symbol = target.symbol;
      exported.declaration.ownerDeclarationId = target.ownerDeclarationId;
    }
  }
}
