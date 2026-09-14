import { EvidenceTagParser } from "../../parsers/EvidenceTagParser";
import { ScalaDocumentation } from "./ScalaDocumentation";
import type { IScalaDeclaration } from "./IScalaDeclaration";
import type { IScalaFileAnalysis } from "./IScalaFileAnalysis";

/**
 * Resolves named exports as alternate addresses of selected public source members.
 *
 * Export syntax has its own physical declaration and documentation site, while
 * the forwarded member retains identity and withdrawal ownership at its source.
 */
export namespace ScalaExports {
  /**
   * Keeps source ownership and identity while attaching the export's own declaration site.
   *
   * Only one selected singleton owner can satisfy an export; ambiguity remains
   * incomplete instead of choosing a same-named member from another object.
   */
  export function resolve(analyses: IScalaFileAnalysis[]): void {
    const declarations = analyses.flatMap((analysis) => analysis.declarations);
    const hidden = withdrawals(analyses);
    for (const analysis of analyses)
      for (const exported of analysis.exports) {
        if (hidden.has(exported.declaration.ownerDeclarationId ?? "")) continue;
        let owners: IScalaDeclaration[] = [];
        for (const path of exported.paths) {
          const candidates = declarations.filter(
            (declaration) =>
              (declaration.object || declaration.symbol !== "type") &&
              JSON.stringify(declaration.lookup) === JSON.stringify(path),
          );
          owners =
            candidates.length === 1 && candidates[0]?.object === true
              ? candidates
              : [];
          if (candidates.length !== 0) break;
        }
        const candidate = owners.length === 1 ? owners[0] : undefined;
        const owner =
          candidate !== undefined && staticObject(candidate, declarations)
            ? candidate
            : undefined;
        const targets =
          owner === undefined
            ? []
            : declarations.filter(
                (declaration) =>
                  declaration.ownerDeclarationId === owner.id &&
                  declaration.name === exported.member &&
                  declaration.public &&
                  declaration.syntax !== "export_declaration",
              );
        const identities = new Set(
          targets.map(
            (target) => `${target.symbol}:${JSON.stringify(target.identity)}`,
          ),
        );
        const target = identities.size === 1 ? targets[0] : undefined;
        if (
          target === undefined ||
          [
            "class_definition",
            "trait_definition",
            "object_definition",
            "enum_definition",
            "package_object",
          ].includes(target.syntax) ||
          targets.some((candidate) =>
            declarations.some(
              (child) => child.ownerDeclarationId === candidate.id,
            ),
          )
        ) {
          analysis.complete = false;
          analysis.diagnostics.push({
            code: "scala-export-resolution",
            severity: "error",
            message: `Export '${exported.member}' requires one selected public object member without nested declarations. Missing, ambiguous, restricted, chained, and container exports cannot establish a complete surface.`,
            repair:
              "Select the declaring singleton object and export a named leaf member, or implement the required export resolution.",
            location: {
              file: analysis.source.physicalPath,
              range: exported.declaration.site.range,
            },
          });
          continue;
        }
        exported.declaration.public = true;
        exported.declaration.name = target.name;
        exported.declaration.identity = target.identity;
        exported.declaration.symbol = target.symbol;
        if (target.ownerDeclarationId === undefined)
          delete exported.declaration.ownerDeclarationId;
        else
          exported.declaration.ownerDeclarationId = target.ownerDeclarationId;
      }
  }

  /** Resolves lexical withdrawals before exports can expose alternate addresses. */
  function withdrawals(analyses: IScalaFileAnalysis[]): Set<string> {
    const hidden = new Set<string>();
    const declarations = analyses.flatMap((analysis) => analysis.declarations);
    for (const analysis of analyses)
      for (const documentation of analysis.documentation) {
        for (const attachment of documentation.attachments) {
          const parsed = EvidenceTagParser.parse(
            analysis.source.content,
            {
              id: documentation.id,
              file: analysis.source.physicalPath,
              range: documentation.range,
              origins: analysis.source.addresses.map(
                (address) => address.absolute,
              ),
              siteId: attachment.siteId,
              unitIds: [attachment.declarationId],
              attachment: "attached",
            },
            ScalaDocumentation.read(
              analysis.source,
              documentation,
              documentation.id,
            ),
          );
          if (parsed.withdrawals.length !== 0)
            hidden.add(attachment.declarationId);
        }
      }
    for (let previous = -1; previous !== hidden.size;) {
      previous = hidden.size;
      for (const declaration of declarations)
        if (hidden.has(declaration.ownerDeclarationId ?? ""))
          hidden.add(declaration.id);
    }
    return hidden;
  }

  /** Requires a namespace path made entirely of singleton objects and package objects. */
  function staticObject(
    declaration: IScalaDeclaration,
    declarations: IScalaDeclaration[],
  ): boolean {
    let current: IScalaDeclaration | undefined = declaration;
    const visited = new Set<string>();
    while (current !== undefined) {
      if (
        visited.has(current.id) ||
        (!current.object && current.syntax !== "package_object")
      )
        return false;
      visited.add(current.id);
      const parent: string | undefined = current.ownerDeclarationId;
      current =
        parent === undefined
          ? undefined
          : declarations.find((candidate) => candidate.id === parent);
    }
    return true;
  }
}
