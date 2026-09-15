import { posix } from "node:path";

import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidMatlabDeclaration } from "./IEvidMatlabDeclaration";
import type { IEvidMatlabFileAnalysis } from "./IEvidMatlabFileAnalysis";

/**
 * Reconciles selected class folders, external implementations, and property accessors.
 *
 * MATLAB distributes one public class surface across files, so semantic ownership
 * must be proven from class-folder paths before units and annotation hosts exist.
 */
export namespace EvidMatlabOwnership {
  /**
   * Resolves all ownership before any public identities or hosts are published.
   *
   * This order lets a missing external implementation remain an observable
   * dependency and prevents an accessor from becoming a second property unit.
   */
  export function resolve(
    analyses: IEvidMatlabFileAnalysis[],
    inventory: IEvidInventory,
  ): void {
    const files = new Map(
      analyses.map((analysis) => [
        analysis.source.physicalPath.replaceAll("\\", "/"),
        analysis,
      ]),
    );
    for (const analysis of analyses) {
      const directory = posix.dirname(
        analysis.source.physicalPath.replaceAll("\\", "/"),
      );
      if (posix.basename(directory).startsWith("@"))
        inventory.dependencies.push({ path: directory, recursive: true });
      for (const declaration of analysis.declarations) {
        if (declaration.externalOwner === undefined) continue;
        inventory.dependencies.push({
          path: declaration.externalOwner,
          recursive: false,
        });
        const ownerAnalysis = files.get(declaration.externalOwner);
        const owner =
          ownerAnalysis === undefined
            ? undefined
            : ownerAnalysis.declarations.find(
                (candidate) =>
                  candidate.symbol === "type" &&
                  candidate.ownerDeclarationId === undefined,
              );
        if (owner === undefined || ownerAnalysis === undefined) {
          problem(
            analysis,
            declaration,
            "class-folder",
            "An external method requires its selected @Class/Class.m classdef; legacy classes are not inferred.",
          );
          declaration.public = false;
          continue;
        }
        const prototype = ownerAnalysis.declarations.find(
          (candidate) =>
            candidate.ownerDeclarationId === owner.id &&
            candidate.name === declaration.name &&
            candidate.symbol === "function",
        );
        if (prototype !== undefined && prototype.implementation === undefined)
          problem(
            analysis,
            declaration,
            "method-conflict",
            "An external method duplicates an inline or abstract class method.",
          );
        declaration.ownerDeclarationId = owner.id;
        declaration.anchor = owner.anchor;
        declaration.address = [...owner.address, declaration.name];
        declaration.identity = declaration.address;
        declaration.public &&= owner.public && (prototype?.public ?? true);
        declaration.publicFiles = ownerAnalysis.source.addresses.map(
          (address) => address.absolute,
        );
        inventory.dependencies.push({
          path: posix.dirname(declaration.externalOwner),
          recursive: true,
        });
      }
      for (const declaration of analysis.declarations) {
        if (declaration.implementation === undefined) continue;
        inventory.dependencies.push({
          path: declaration.implementation,
          recursive: false,
        });
        const externalAnalysis = files.get(declaration.implementation);
        const external =
          externalAnalysis === undefined
            ? undefined
            : externalAnalysis.declarations.find(
                (candidate) =>
                  candidate.externalOwner === declaration.anchor &&
                  candidate.name === declaration.name,
              );
        if (external === undefined)
          problem(
            analysis,
            declaration,
            "external-method",
            "A nonabstract external method prototype has no selected implementation; include its @Class method file.",
          );
      }
    }
    for (const analysis of analyses)
      for (const declaration of analysis.declarations) {
        if (declaration.accessor === undefined) continue;
        const property = analyses
          .flatMap((item) => item.declarations)
          .find(
            (candidate) =>
              candidate.accessor === undefined &&
              candidate.getPublic !== undefined &&
              candidate.anchor === declaration.anchor &&
              candidate.ownerDeclarationId === declaration.ownerDeclarationId &&
              candidate.name === declaration.name,
          );
        if (property === undefined) {
          problem(
            analysis,
            declaration,
            "accessor",
            "A property accessor has no declared property in its selected class.",
          );
          declaration.public = false;
        } else {
          declaration.public =
            property.public &&
            (declaration.accessor === "get"
              ? property.getPublic === true
              : property.setPublic === true);
        }
      }
    const seen = new Map<string, IEvidMatlabDeclaration>();
    for (const analysis of analyses)
      for (const declaration of analysis.declarations) {
        if (!declaration.public) continue;
        const identity = JSON.stringify([
          declaration.anchor,
          declaration.symbol,
          declaration.identity,
          declaration.accessor ??
            (declaration.implementation === undefined
              ? "definition"
              : "prototype"),
        ]);
        if (seen.has(identity))
          problem(
            analysis,
            declaration,
            "declaration-conflict",
            "Two declarations expose the same MATLAB owner and name.",
          );
        seen.set(identity, declaration);
      }
  }

  /**
   * Records unresolved source ownership without shrinking a passing population.
   *
   * The ownership pass retains this diagnostic when class-folder or external
   * declarations cannot be paired, preserving an incomplete result for recovery.
   */
  function problem(
    analysis: IEvidMatlabFileAnalysis,
    declaration: IEvidMatlabDeclaration,
    code: string,
    message: string,
  ): void {
    analysis.complete = false;
    analysis.diagnostics.push({
      code: `matlab-${code}`,
      severity: "error",
      message,
      repair:
        "Select a unique classdef and its external implementations, or correct the conflicting declaration.",
      location: {
        file: analysis.source.physicalPath,
        range: declaration.site.range,
      },
    });
  }
}
