import typia from "typia";

import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import { EvidInventory } from "../../graph/EvidInventory";
import { EvidParser } from "../../parsers/EvidParser";
import { EvidParserError } from "../../parsers/EvidParserError";
import { EvidTagParser } from "../../parsers/EvidTagParser";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidHost } from "../../structures/IEvidHost";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";
import type { IEvidTagParseResult } from "../../structures/IEvidTagParseResult";
import type { IEvidUnit } from "../../structures/IEvidUnit";
import { EvidGoFileScanner } from "./EvidGoFileScanner";
import { EvidGoPackageResolver } from "./EvidGoPackageResolver";
import type { IEvidGoDocumentation } from "./IEvidGoDocumentation";
import type { IEvidGoFileAnalysis } from "./IEvidGoFileAnalysis";

/**
 * Coordinates Go file scanning, package ownership, and documentation
 * materialization.
 *
 * A file scan cannot resolve every method owner: receiver types can live in
 * another selected file of the package. `EvidGoPackageResolver` therefore
 * publishes identities and addresses after all file analyses exist.
 * Documentation then joins those identities through recorded declaration sites,
 * including grouped declarations and package-specific test boundaries.
 *
 * The pipeline retains discovery and parse failures before common inventory
 * validation. It never treats an unresolved receiver as permission to omit a
 * method and report complete coverage over the remaining units.
 */
export class EvidGoAdapter implements IEvidAdapter {
  /**
   * Go artifact discriminator for the package extraction pipeline.
   *
   * This selects Go visibility and receiver rules. Package placement comes from
   * the selected source records rather than from claim or reference role.
   */
  public readonly type = "go";

  /**
   * Builds a Go package inventory from an independently captured input
   * snapshot.
   *
   * All files are scanned before package publication and documentation
   * attachment. Discovery dependencies survive for watch recovery, and the
   * invocation closes its parser on every path before returning a serializable
   * inventory.
   */
  public async analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const inventory: IEvidInventory = {
      schemaVersion: 1,
      sources: input.files,
      annotationRanges: [],
      units: [],
      addresses: [],
      hosts: [],
      declarations: [],
      reviews: [],
      diagnostics: input.diagnostics.map((diagnostic) => ({
        code: `source-${diagnostic.code}`,
        severity: "error",
        message: diagnostic.message,
        repair:
          "Restore access to the selected Go source before evaluating coverage.",
        location: { file: diagnostic.path },
      })),
      dependencies: input.dependencies,
      complete: input.complete,
    };
    const parser = new EvidParser();
    try {
      const analyses = await Promise.all(
        input.files.map((source) => this.scan(parser, source)),
      );
      for (const analysis of analyses) {
        inventory.diagnostics.push(...analysis.diagnostics);
        inventory.complete &&= analysis.complete;
      }
      // A receiver declaration can live in another selected package file. Resolve
      // package ownership before interpreting method comments as evidence hosts.
      const published = new EvidGoPackageResolver(
        analyses,
        inventory,
      ).publish();
      this.materializeDocumentation(inventory, analyses, published);
      return new EvidInventory([inventory]).snapshot();
    } finally {
      await parser.close();
    }
  }

  private async scan(
    parser: EvidParser,
    source: IEvidSourceFile,
  ): Promise<IEvidGoFileAnalysis> {
    const file = source.addresses[0]?.relative ?? source.physicalPath;
    try {
      return await parser.parse(
        { type: "go", file, content: source.content },
        (session) => new EvidGoFileScanner(session, source).scan(),
      );
    } catch (cause) {
      const parserError = cause instanceof EvidParserError ? cause : undefined;
      return {
        source,
        directory: source.physicalPath.replace(/[\\/][^\\/]*$/u, ""),
        testFile: source.physicalPath.endsWith("_test.go"),
        declarations: [],
        documentation: [],
        diagnostics: [
          {
            code: `go-${parserError?.code ?? "parse-failed"}`,
            severity: "error",
            message:
              parserError?.message ??
              `Go parsing failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            repair:
              "Correct the source or add adapter support before evaluating coverage.",
            location: {
              file: source.physicalPath,
              ...(parserError?.range === undefined
                ? {}
                : { range: parserError.range }),
            },
          },
        ],
        complete: false,
      };
    }
  }

  private materializeDocumentation(
    inventory: IEvidInventory,
    analyses: IEvidGoFileAnalysis[],
    published: Map<string, string>,
  ): void {
    const units = new Map(inventory.units.map((unit) => [unit.id, unit]));
    for (const analysis of analyses)
      for (const documentation of analysis.documentation) {
        const groups = this.attachmentGroups(documentation, published);
        if (groups.size === 0 && !this.annotation(analysis, documentation))
          continue;
        inventory.annotationRanges.push({
          file: analysis.source.physicalPath,
          range: documentation.range,
        });
        for (const [siteId, unitIds] of groups) {
          const host = this.host(
            analysis.source,
            documentation,
            siteId,
            unitIds,
          );
          const parsed = this.parse(analysis.source, documentation, host);
          for (const unitId of unitIds) {
            const unit = units.get(unitId);
            if (unit !== undefined)
              unit.withdrawals.push(...parsed.withdrawals);
          }
        }
      }
    const hidden = new Set<string>();
    for (const unit of inventory.units)
      if (this.withdrawn(unit.id, units, new Set<string>()))
        hidden.add(unit.id);
    for (const analysis of analyses)
      for (const documentation of analysis.documentation) {
        const publishedGroups = this.attachmentGroups(documentation, published);
        const groups = new Map<string, string[]>();
        for (const [siteId, unitIds] of publishedGroups) {
          const visible = unitIds.filter((unitId) => !hidden.has(unitId));
          if (visible.length !== 0) groups.set(siteId, visible);
        }
        if (
          groups.size === 0 &&
          publishedGroups.size !== 0 &&
          !this.claimAnnotation(analysis, documentation)
        )
          continue;
        if (groups.size === 0) {
          if (!this.annotation(analysis, documentation)) continue;
          const host = this.host(analysis.source, documentation, undefined, []);
          inventory.hosts.push(host);
          const parsed = this.parse(analysis.source, documentation, host);
          inventory.declarations.push(...parsed.declarations);
          inventory.reviews.push(...parsed.reviews);
          inventory.diagnostics.push(...parsed.diagnostics);
          continue;
        }
        for (const [siteId, unitIds] of groups) {
          const host = this.host(
            analysis.source,
            documentation,
            siteId,
            unitIds,
          );
          inventory.hosts.push(host);
          const parsed = this.parse(analysis.source, documentation, host);
          inventory.declarations.push(...parsed.declarations);
          inventory.reviews.push(...parsed.reviews);
          inventory.diagnostics.push(...parsed.diagnostics);
        }
      }
    this.materializeUndocumentedHosts(inventory, analyses, published, hidden);
  }

  private materializeUndocumentedHosts(
    inventory: IEvidInventory,
    analyses: IEvidGoFileAnalysis[],
    published: Map<string, string>,
    hidden: Set<string>,
  ): void {
    for (const analysis of analyses) {
      const documented = new Set(
        analysis.documentation.flatMap((documentation) =>
          documentation.attachments.flatMap((attachment) => {
            const unitId = published.get(attachment.declarationId);
            return unitId !== undefined && !hidden.has(unitId)
              ? [attachment.declarationId]
              : [];
          }),
        ),
      );
      const positions = new Map<string, string[]>();
      for (const declaration of analysis.declarations) {
        const unitId = published.get(declaration.id);
        if (
          unitId === undefined ||
          hidden.has(unitId) ||
          documented.has(declaration.id)
        )
          continue;
        const unitIds = positions.get(declaration.positionSiteId) ?? [];
        if (!unitIds.includes(unitId)) unitIds.push(unitId);
        positions.set(declaration.positionSiteId, unitIds);
      }
      for (const [siteId, unitIds] of positions) {
        const site = inventory.units
          .flatMap((unit) => unit.sites)
          .find(
            (candidate) =>
              candidate.id === siteId &&
              candidate.file === analysis.source.physicalPath,
          );
        if (site === undefined) continue;
        inventory.hosts.push({
          id: `${site.id}:host`,
          file: analysis.source.physicalPath,
          range: site.range,
          origins: analysis.source.addresses.map((address) => address.absolute),
          siteId,
          unitIds,
          attachment: "attached",
        });
      }
    }
  }

  private attachmentGroups(
    documentation: IEvidGoDocumentation,
    published: Map<string, string>,
  ): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const attachment of documentation.attachments) {
      const unitId = published.get(attachment.declarationId);
      if (unitId === undefined) continue;
      const unitIds = groups.get(attachment.siteId) ?? [];
      if (!unitIds.includes(unitId)) unitIds.push(unitId);
      groups.set(attachment.siteId, unitIds);
    }
    return groups;
  }

  private host(
    source: IEvidSourceFile,
    documentation: IEvidGoDocumentation,
    siteId: string | undefined,
    unitIds: string[],
  ): IEvidHost {
    const attached = siteId !== undefined && unitIds.length !== 0;
    return {
      id: `${documentation.id}:host:${siteId ?? "unsupported"}`,
      file: source.physicalPath,
      range: documentation.range,
      origins: source.addresses.map((address) => address.absolute),
      unitIds,
      attachment: attached ? "attached" : "unsupported",
      ...(attached ? { siteId } : {}),
      ...(attached
        ? {}
        : {
            problem:
              "Move the annotation into an immediately adjacent Go documentation comment on a supported exported declaration.",
          }),
    };
  }

  private parse(
    source: IEvidSourceFile,
    documentation: IEvidGoDocumentation,
    host: IEvidHost,
  ): IEvidTagParseResult {
    const mapped = EvidDocumentation.read(
      source.content,
      host.id,
      documentation.range,
      documentation.syntax,
    );
    return EvidTagParser.parse(source.content, host, mapped);
  }

  private annotation(
    analysis: IEvidGoFileAnalysis,
    documentation: IEvidGoDocumentation,
  ): boolean {
    return this.annotationPattern(
      EvidDocumentation.read(
        analysis.source.content,
        documentation.id,
        documentation.range,
        documentation.syntax,
      ).text,
      true,
    );
  }

  private claimAnnotation(
    analysis: IEvidGoFileAnalysis,
    documentation: IEvidGoDocumentation,
  ): boolean {
    return this.annotationPattern(
      EvidDocumentation.read(
        analysis.source.content,
        documentation.id,
        documentation.range,
        documentation.syntax,
      ).text,
      false,
    );
  }

  private annotationPattern(raw: string, withdrawal: boolean): boolean {
    return withdrawal
      ? /(?:^|[\r\n])[ \t]*@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
          raw,
        )
      : /(?:^|[\r\n])[ \t]*@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)\b/u.test(
          raw,
        );
  }

  private withdrawn(
    id: string,
    units: Map<string, IEvidUnit>,
    visited: Set<string>,
  ): boolean {
    if (visited.has(id)) return false;
    visited.add(id);
    const unit = units.get(id);
    if (unit === undefined) return false;
    if (unit.withdrawals.length !== 0) return true;
    return unit.parentId === undefined
      ? false
      : this.withdrawn(unit.parentId, units, visited);
  }
}
