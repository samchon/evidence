import type { IEvidSwiftDeclaration } from "./IEvidSwiftDeclaration";
import type { IEvidSwiftFileAnalysis } from "./IEvidSwiftFileAnalysis";

/**
 * Reconciles extensions against nominal declarations in one configured Swift
 * module.
 *
 * The pass resolves selected local aliases without importing compiler metadata,
 * then propagates visibility from the verified nominal owner to extension
 * members.
 */
export namespace EvidSwiftOwnership {
  /**
   * Resolves local aliases and extension-introduced types before propagating
   * visibility.
   *
   * Repeated passes handle declarations whose owner is another pending
   * extension; unresolved cycles remain incomplete instead of gaining an
   * invented owner.
   */
  export function resolve(analyses: IEvidSwiftFileAnalysis[]): void {
    const declarations = analyses.flatMap((analysis) => analysis.declarations);
    const ids = new Map(
      declarations.map((declaration) => [declaration.id, declaration]),
    );
    const pending = new Set(
      declarations.filter((declaration) => declaration.extension),
    );
    let progress = true;
    while (progress && pending.size !== 0) {
      progress = false;
      const types = new Map<string, IEvidSwiftDeclaration[]>();
      for (const declaration of declarations)
        if (
          declaration.symbol === "type" &&
          !declaration.extension &&
          ![...pending].some((extension) =>
            descends(declaration, extension.id, ids),
          )
        ) {
          const key = JSON.stringify(declaration.identity);
          types.set(key, [...(types.get(key) ?? []), declaration]);
        }
      for (const declaration of pending) {
        const target = nominal(
          declaration.target ?? [],
          types,
          declaration.site.file,
          new Set<string>(),
        );
        if (target === undefined) continue;
        const old = declaration.address;
        declaration.address = [...target.address];
        declaration.identity = [...target.identity];
        declaration.name = target.name;
        declaration.public = target.public;
        if (target.ownerDeclarationId === undefined)
          delete declaration.ownerDeclarationId;
        else declaration.ownerDeclarationId = target.ownerDeclarationId;
        for (const child of declarations)
          if (descends(child, declaration.id, ids)) {
            child.address = [
              ...target.address,
              ...child.address.slice(old.length),
            ];
            child.identity = [...child.address];
          }
        pending.delete(declaration);
        progress = true;
      }
    }
    for (const declaration of pending) {
      declaration.public = false;
      const analysis = analyses.find(
        (entry) => entry.source.physicalPath === declaration.site.file,
      );
      if (analysis === undefined) continue;
      analysis.complete = false;
      analysis.diagnostics.push({
        code: "swift-extension-ownership",
        severity: "error",
        message: `Extension '${declaration.address.join(".")}' requires one accessible selected local nominal type; external, ambiguous, cyclic, and generic ownership is unavailable.`,
        repair:
          "Include the accessible local nominal owner in the configured Swift module or implement external type ownership before checking coverage.",
        location: {
          file: analysis.source.physicalPath,
          range: declaration.site.range,
        },
      });
    }
    for (const declaration of declarations)
      declaration.public &&= visible(declaration, ids, new Set<string>());
  }

  /**
   * Resolves a unique accessible declaration and a finite chain of selected
   * type aliases.
   *
   * A visited path set rejects cycles before they can grant an extension an
   * invented owner.
   */
  function nominal(
    path: string[],
    types: Map<string, IEvidSwiftDeclaration[]>,
    file: string,
    visited: Set<string>,
  ): IEvidSwiftDeclaration | undefined {
    const key = JSON.stringify(path);
    if (visited.has(key)) return undefined;
    visited.add(key);
    const accessible = (types.get(key) ?? []).filter(
      (declaration) =>
        !declaration.filePrivate || declaration.site.file === file,
    );
    const local = accessible.filter(
      (declaration) =>
        declaration.filePrivate && declaration.site.file === file,
    );
    const matches = local.length !== 0 ? local : accessible;
    if (matches.length !== 1) return undefined;
    const declaration = matches[0];
    if (declaration === undefined) return undefined;
    if (!declaration.alias)
      return ["class", "struct", "actor", "enum", "protocol"].includes(
        declaration.form,
      )
        ? declaration
        : undefined;
    if (declaration.target === undefined) return undefined;
    const scope = declaration.identity.slice(0, -1);
    for (let length = scope.length; length >= 0; --length) {
      const resolved = nominal(
        [...scope.slice(0, length), ...declaration.target],
        types,
        declaration.site.file,
        new Set(visited),
      );
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }

  /**
   * Uses explicit declaration parents to distinguish literal names from
   * containment.
   *
   * This preserves names that contain punctuation without interpreting them as
   * paths.
   */
  function descends(
    declaration: IEvidSwiftDeclaration,
    parentId: string,
    ids: Map<string, IEvidSwiftDeclaration>,
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

  /**
   * Clamps descendant exposure to the effective public owner.
   *
   * Recursive ownership also rejects a malformed parent cycle from the
   * published surface.
   */
  function visible(
    declaration: IEvidSwiftDeclaration,
    ids: Map<string, IEvidSwiftDeclaration>,
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
