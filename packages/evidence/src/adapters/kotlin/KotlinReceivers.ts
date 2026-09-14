import type { IKotlinDeclaration } from "./IKotlinDeclaration";
import type { IKotlinFileAnalysis } from "./IKotlinFileAnalysis";
import type { IKotlinResolvedType } from "./IKotlinResolvedType";
import type { IKotlinTypeReference } from "./IKotlinTypeReference";

/**
 * Resolves explicit nominal receiver names and selected aliases without compiler execution.
 *
 * Extension members must acquire the identity of their receiver type, but the
 * resolver stays within selected source and reports paths needing compiler lookup.
 */
export namespace KotlinReceivers {
  /**
   * Unifies equivalent extension sites before semantic units and addresses are materialized.
   *
   * Resolution happens before publication so aliases and nullable spellings do
   * not create separate units for methods on the same public nominal receiver.
   */
  export function resolve(analyses: IKotlinFileAnalysis[]): void {
    const types = new Map<string, IKotlinDeclaration[]>();
    for (const declaration of analyses.flatMap(
      (analysis) => analysis.declarations,
    )) {
      if (declaration.symbol !== "type") continue;
      const key = JSON.stringify(declaration.identity);
      const entries = types.get(key) ?? [];
      entries.push(declaration);
      types.set(key, entries);
    }
    for (const analysis of analyses)
      for (const declaration of analysis.declarations) {
        if (!declaration.public || declaration.receiver === undefined) continue;
        const resolved = lookup(declaration.receiver, types, new Set<string>());
        if (resolved === undefined) {
          analysis.complete = false;
          analysis.diagnostics.push({
            code: "kotlin-receiver-unresolved",
            severity: "error",
            message:
              declaration.receiver.problem ??
              "The extension receiver cannot be resolved uniquely through selected nominal declarations and type aliases.",
            repair:
              "Select the receiver declaration, use an explicit nominal import or qualified name, or implement the required generic, alias, or wildcard resolution.",
            location: {
              file: analysis.source.physicalPath,
              range: declaration.site.range,
            },
          });
          continue;
        }
        const spelling =
          resolved.segments.map(segment).join(".") +
          (resolved.nullable ? "?" : "");
        const receiverSegment = `extension(${spelling})`;
        declaration.identity[declaration.identity.length - 2] = receiverSegment;
        declaration.address[declaration.address.length - 2] = receiverSegment;
      }
  }

  /**
   * Resolves lexical candidates and expands selected alias chains with cycle detection.
   *
   * A receiver must identify exactly one selected nominal declaration; ambiguity,
   * cycles, and file-private visibility outside the declaring file remain unresolved.
   */
  function lookup(
    reference: IKotlinTypeReference,
    types: Map<string, IKotlinDeclaration[]>,
    visited: Set<string>,
  ): IKotlinResolvedType | undefined {
    if (reference.problem !== undefined) return undefined;
    for (const path of reference.paths) {
      const key = JSON.stringify(path);
      const candidates = types.get(key);
      if (candidates === undefined) continue;
      const privateTypes = candidates.filter(
        (candidate) =>
          candidate.filePrivate && candidate.site.file === reference.file,
      );
      const declarations =
        privateTypes.length !== 0
          ? privateTypes
          : candidates.filter((candidate) => !candidate.filePrivate);
      const declaration = declarations[0];
      if (
        declarations.length !== 1 ||
        declaration === undefined ||
        visited.has(key)
      )
        return undefined;
      if (declaration.aliasTarget === undefined)
        return { segments: path, nullable: reference.nullable };
      const next = new Set(visited);
      next.add(key);
      const resolved = lookup(declaration.aliasTarget, types, next);
      return resolved === undefined
        ? undefined
        : {
            segments: resolved.segments,
            nullable: reference.nullable || resolved.nullable,
          };
    }
    return reference.external === undefined
      ? undefined
      : { segments: reference.external, nullable: reference.nullable };
  }

  /**
   * Retains literal Kotlin identifier boundaries inside the receiver address segment.
   *
   * Non-identifier names use Kotlin backticks so punctuation cannot be mistaken
   * for a separator when the resolved receiver spelling is published.
   */
  function segment(value: string): string {
    return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value) ? value : `\`${value}\``;
  }
}
