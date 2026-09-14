import type { ISwiftDeclaration } from "./ISwiftDeclaration";
import type { ISwiftFileAnalysis } from "./ISwiftFileAnalysis";

/** Reconciles extensions against nominal declarations in one configured Swift module. */
export namespace SwiftOwnership {
  /** Resolves local type aliases and extensions, then propagates effective visibility. */
  export function resolve(analyses: ISwiftFileAnalysis[]): void {
    const declarations = analyses.flatMap((analysis) => analysis.declarations);
    const ids = new Map(
      declarations.map((declaration) => [declaration.id, declaration]),
    );
    const types = new Map<string, ISwiftDeclaration[]>();
    for (const declaration of declarations)
      if (declaration.symbol === "type" && !declaration.extension) {
        const key = JSON.stringify(declaration.identity);
        types.set(key, [...(types.get(key) ?? []), declaration]);
      }
    for (const analysis of analyses)
      for (const declaration of analysis.declarations) {
        if (!declaration.extension) continue;
        const target = nominal(
          declaration.target ?? [],
          types,
          new Set<string>(),
        );
        if (target === undefined) {
          declaration.public = false;
          analysis.complete = false;
          analysis.diagnostics.push({
            code: "swift-extension-ownership",
            severity: "error",
            message: `Extension '${declaration.address.join(".")}' requires one selected local nominal type; external, ambiguous, cyclic, and generic ownership is unavailable.`,
            repair:
              "Include the local nominal owner in the configured Swift module or implement external type ownership before checking coverage.",
            location: {
              file: analysis.source.physicalPath,
              range: declaration.site.range,
            },
          });
          continue;
        }
        const old = declaration.address;
        declaration.address = [...target.address];
        declaration.identity = [...target.identity];
        declaration.name = target.name;
        declaration.public = target.public;
        declaration.ownerDeclarationId = target.ownerDeclarationId;
        for (const child of declarations)
          if (descends(child, declaration.id, ids)) {
            child.address = [
              ...target.address,
              ...child.address.slice(old.length),
            ];
            child.identity = [...child.address];
          }
      }
    for (const declaration of declarations)
      declaration.public &&= visible(declaration, ids, new Set<string>());
  }

  /** Resolves only a unique declaration and a finite chain of selected type aliases. */
  function nominal(
    path: string[],
    types: Map<string, ISwiftDeclaration[]>,
    visited: Set<string>,
  ): ISwiftDeclaration | undefined {
    const key = JSON.stringify(path);
    if (visited.has(key)) return undefined;
    visited.add(key);
    const matches = types.get(key) ?? [];
    if (matches.length !== 1) return undefined;
    const declaration = matches[0];
    if (declaration === undefined || !declaration.alias) return declaration;
    if (declaration.target === undefined) return undefined;
    const scope = declaration.identity.slice(0, -1);
    for (let length = scope.length; length >= 0; --length) {
      const resolved = nominal(
        [...scope.slice(0, length), ...declaration.target],
        types,
        new Set(visited),
      );
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }

  /** Uses explicit declaration parents to avoid conflating literal names and containment. */
  function descends(
    declaration: ISwiftDeclaration,
    parentId: string,
    ids: Map<string, ISwiftDeclaration>,
  ): boolean {
    let owner = declaration.ownerDeclarationId;
    const visited = new Set<string>();
    while (owner !== undefined && !visited.has(owner)) {
      if (owner === parentId) return true;
      visited.add(owner);
      owner = ids.get(owner)?.ownerDeclarationId;
    }
    return false;
  }

  /** Clamps descendant exposure to the effective public owner. */
  function visible(
    declaration: ISwiftDeclaration,
    ids: Map<string, ISwiftDeclaration>,
    visited: Set<string>,
  ): boolean {
    if (!declaration.public || visited.has(declaration.id)) return false;
    visited.add(declaration.id);
    const owner =
      declaration.ownerDeclarationId === undefined
        ? undefined
        : ids.get(declaration.ownerDeclarationId);
    return owner === undefined || visible(owner, ids, visited);
  }
}
