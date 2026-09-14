import typia from "typia";

import { EvidenceInventory } from "../../graph/EvidenceInventory";
import { EvidenceParser } from "../../parsers/EvidenceParser";
import { EvidenceParserError } from "../../parsers/EvidenceParserError";
import { EvidenceTagParser } from "../../parsers/EvidenceTagParser";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceHost } from "../../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidencePublicAddress } from "../../structures/IEvidencePublicAddress";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";
import type { IEvidenceTagParseResult } from "../../structures/IEvidenceTagParseResult";
import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { ISwiftDeclaration } from "./ISwiftDeclaration";
import type { ISwiftDocumentation } from "./ISwiftDocumentation";
import type { ISwiftFileAnalysis } from "./ISwiftFileAnalysis";
import { SwiftDocumentation } from "./SwiftDocumentation";
import { SwiftFileScanner } from "./SwiftFileScanner";
import { SwiftOwnership } from "./SwiftOwnership";

/** Builds Swift source-public inventories from the configured source snapshot. */
export class SwiftAdapter implements IEvidenceAdapter {
  /** Public configuration discriminator owned by this adapter. */
  public readonly type = "swift";

  /** Builds a fresh inventory and releases the bounded parser session. */
  public async analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const inventory: IEvidenceInventory = {
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
          "Restore access to the selected Swift source before evaluating coverage.",
        location: { file: diagnostic.path },
      })),
      dependencies: [
        ...input.dependencies,
        ...input.files.map((source) => ({
          path: source.physicalPath,
          recursive: false,
        })),
      ],
      complete: input.complete,
    };
    const parser = new EvidenceParser();
    try {
      const analyses = await Promise.all(
        input.files.map((source) => this.scan(parser, source)),
      );
      SwiftOwnership.resolve(analyses);
      for (const analysis of analyses) {
        inventory.diagnostics.push(...analysis.diagnostics);
        inventory.complete &&= analysis.complete;
      }
      const published = this.materializeUnits(
        inventory,
        analyses,
        input.root.physical ?? input.root.absolute,
      );
      this.materializeDocumentation(inventory, analyses, published);
      return new EvidenceInventory([inventory]).snapshot();
    } finally {
      await parser.close();
    }
  }

  /** Converts parser failures into incomplete source analysis. */
  private async scan(
    parser: EvidenceParser,
    source: IEvidenceSourceFile,
  ): Promise<ISwiftFileAnalysis> {
    const file = source.addresses[0]?.relative ?? source.physicalPath;
    try {
      return await parser.parse(
        { type: "swift", file, content: source.content },
        (session) => new SwiftFileScanner(session, source).scan(),
      );
    } catch (cause) {
      const parserError =
        cause instanceof EvidenceParserError ? cause : undefined;
      return {
        source,
        declarations: [],
        documentation: [],
        diagnostics: [
          {
            code: `swift-${parserError?.code ?? "parse-failed"}`,
            severity: "error",
            message:
              parserError?.message ??
              `Swift parsing failed: ${cause instanceof Error ? cause.message : String(cause)}`,
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

  /** Reconciles overload families and retains each physical declaration address. */
  private materializeUnits(
    inventory: IEvidenceInventory,
    analyses: ISwiftFileAnalysis[],
    moduleRoot: string,
  ): Map<string, string> {
    const published = new Map<string, string>();
    const publicDeclarations = analyses.flatMap((analysis) =>
      analysis.declarations.filter((declaration) => declaration.public),
    );
    for (const declaration of publicDeclarations)
      published.set(declaration.id, this.unitId(declaration, moduleRoot));

    const units = new Map<string, IEvidenceUnit>();
    const records = new Map(
      publicDeclarations.map((declaration) => [declaration.id, declaration]),
    );
    const declarationIds = new Map<string, Set<string>>();
    const addresses = new Set<string>();
    for (const analysis of analyses)
      for (const declaration of analysis.declarations) {
        if (!declaration.public) continue;
        const id = this.unitId(declaration, moduleRoot);
        const parentId =
          declaration.ownerDeclarationId === undefined
            ? undefined
            : published.get(declaration.ownerDeclarationId);
        const previousDeclarations =
          declarationIds.get(id) ?? new Set<string>();
        if (
          declaration.symbol !== "function" &&
          !declaration.extension &&
          previousDeclarations.size !== 0 &&
          !previousDeclarations.has(declaration.id) &&
          !this.protocolDefault(declaration, previousDeclarations, records)
        )
          this.problem(
            inventory,
            analysis,
            "swift-declaration-conflict",
            `Swift public identity '${declaration.identity.join(".")}' has more than one selected declaration.`,
            "Select one source declaration for this module identity before checking coverage.",
          );
        if (!declaration.extension) previousDeclarations.add(declaration.id);
        declarationIds.set(id, previousDeclarations);

        let unit = units.get(id);
        if (unit === undefined) {
          unit = {
            id,
            type: "swift",
            symbol: declaration.symbol,
            identity: declaration.identity,
            name: declaration.name,
            sites: [structuredClone(declaration.site)],
            withdrawals: [],
            ...(parentId === undefined ? {} : { parentId }),
          };
          units.set(id, unit);
        } else {
          if (unit.parentId !== parentId)
            this.problem(
              inventory,
              analysis,
              "swift-ownership-conflict",
              `Swift accessor '${declaration.address.join(".")}' has distinct lexical owners.`,
              "Rename the colliding declaration or implement disambiguated ownership addressing before checking coverage.",
            );
          if (!unit.sites.some((site) => site.id === declaration.site.id))
            unit.sites.push(structuredClone(declaration.site));
        }

        for (const sourceAddress of analysis.source.addresses) {
          const address: IEvidencePublicAddress = {
            unitId: id,
            file: sourceAddress.absolute,
            segments: declaration.address,
          };
          const key = JSON.stringify(address);
          if (addresses.has(key)) continue;
          addresses.add(key);
          inventory.addresses.push(address);
        }
      }
    inventory.units.push(...units.values());
    return published;
  }

  /** Allows a protocol requirement and its explicit extension property implementation to share a unit. */
  private protocolDefault(
    declaration: ISwiftDeclaration,
    previous: Set<string>,
    records: Map<string, ISwiftDeclaration>,
  ): boolean {
    if (declaration.symbol !== "property" || previous.size !== 1) return false;
    const first = records.get([...previous][0] ?? "");
    if (first === undefined) return false;
    const pair = [first, declaration];
    return (
      pair.some((entry) => entry.form === "protocol_property_declaration") &&
      pair.some(
        (entry) =>
          entry.form === "property_declaration" &&
          records.get(entry.ownerDeclarationId ?? "")?.extension === true,
      )
    );
  }

  /** Resolves withdrawals before publishing attached annotation hosts. */
  private materializeDocumentation(
    inventory: IEvidenceInventory,
    analyses: ISwiftFileAnalysis[],
    published: Map<string, string>,
  ): void {
    const units = new Map(inventory.units.map((unit) => [unit.id, unit]));
    for (const analysis of analyses)
      for (const documentation of analysis.documentation) {
        const groups = this.attachmentGroups(documentation, published);
        if (groups.size === 0) continue;
        inventory.annotationRanges.push({
          file: analysis.source.physicalPath,
          range: documentation.range,
        });
        for (const [siteId, unitIds] of groups) {
          const parsed = this.parse(
            analysis.source,
            documentation,
            this.host(analysis.source, documentation, siteId, unitIds),
          );
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
    for (const analysis of analyses) {
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
      this.materializeUndocumentedHosts(inventory, analysis, published, hidden);
    }
  }

  /** Retains public declaration sites even when they carry no documentation. */
  private materializeUndocumentedHosts(
    inventory: IEvidenceInventory,
    analysis: ISwiftFileAnalysis,
    published: Map<string, string>,
    hidden: Set<string>,
  ): void {
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
    const groups = new Map<string, ISwiftDeclaration[]>();
    for (const declaration of analysis.declarations) {
      const unitId = published.get(declaration.id);
      if (
        unitId === undefined ||
        hidden.has(unitId) ||
        documented.has(declaration.id)
      )
        continue;
      const declarations = groups.get(declaration.site.id) ?? [];
      declarations.push(declaration);
      groups.set(declaration.site.id, declarations);
    }
    for (const declarations of groups.values()) {
      const first = declarations[0];
      if (first === undefined) continue;
      const unitIds = Array.from(
        new Set(
          declarations.flatMap((declaration) => {
            const unitId = published.get(declaration.id);
            return unitId === undefined ? [] : [unitId];
          }),
        ),
      );
      inventory.hosts.push({
        id: `${first.site.id}:host`,
        file: analysis.source.physicalPath,
        range: first.site.range,
        origins: analysis.source.addresses.map((address) => address.absolute),
        siteId: first.site.id,
        unitIds,
        attachment: "attached",
      });
    }
  }

  /** Groups published semantic owners by their physical declaration site. */
  private attachmentGroups(
    documentation: ISwiftDocumentation,
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

  /** Creates an attached or explicitly unsupported documentation carrier. */
  private host(
    source: IEvidenceSourceFile,
    documentation: ISwiftDocumentation,
    siteId: string | undefined,
    unitIds: string[],
  ): IEvidenceHost {
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
              "Move the annotation into DocC attached to a supported public Swift declaration.",
          }),
    };
  }

  /** Parses Evidence tags only after the adapter establishes their host. */
  private parse(
    source: IEvidenceSourceFile,
    documentation: ISwiftDocumentation,
    host: IEvidenceHost,
  ): IEvidenceTagParseResult {
    return EvidenceTagParser.parse(
      source.content,
      host,
      SwiftDocumentation.read(source, documentation, host.id),
    );
  }

  /** Detects Evidence or withdrawal annotations outside masked examples. */
  private annotation(
    analysis: ISwiftFileAnalysis,
    documentation: ISwiftDocumentation,
  ): boolean {
    return this.annotationPattern(
      SwiftDocumentation.read(analysis.source, documentation, documentation.id)
        .text,
      true,
    );
  }

  /** Detects acknowledgements and reviews on withdrawn carriers. */
  private claimAnnotation(
    analysis: ISwiftFileAnalysis,
    documentation: ISwiftDocumentation,
  ): boolean {
    return this.annotationPattern(
      SwiftDocumentation.read(analysis.source, documentation, documentation.id)
        .text,
      false,
    );
  }

  /** Recognizes supported annotation names at documentation line boundaries. */
  private annotationPattern(raw: string, withdrawal: boolean): boolean {
    return withdrawal
      ? /(?:^|[\r\n])[ \t]*@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
          raw,
        )
      : /(?:^|[\r\n])[ \t]*@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)\b/u.test(
          raw,
        );
  }

  /** Follows explicit parent ownership to propagate withdrawal. */
  private withdrawn(
    id: string,
    units: Map<string, IEvidenceUnit>,
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

  /** Separates programming kinds while unifying module-scoped overload identities. */
  private unitId(declaration: ISwiftDeclaration, moduleRoot: string): string {
    return `swift:${JSON.stringify([moduleRoot, declaration.symbol, ...declaration.identity])}`;
  }

  /** Marks a declaration conflict as incomplete analysis. */
  private problem(
    inventory: IEvidenceInventory,
    analysis: ISwiftFileAnalysis,
    code: string,
    message: string,
    repair: string,
  ): void {
    inventory.complete = false;
    inventory.diagnostics.push({
      code,
      severity: "error",
      message,
      repair,
      location: { file: analysis.source.physicalPath },
    });
  }
}
