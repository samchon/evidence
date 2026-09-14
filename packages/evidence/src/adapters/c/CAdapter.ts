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
import type { CDeclarationForm } from "./CDeclarationForm";
import type { ICDeclaration } from "./ICDeclaration";
import type { ICDeclarationAddress } from "./ICDeclarationAddress";
import type { ICDeclarationGroup } from "./ICDeclarationGroup";
import type { ICDocumentation } from "./ICDocumentation";
import type { ICFileAnalysis } from "./ICFileAnalysis";
import { CDocumentation } from "./CDocumentation";
import { CFileScanner } from "./CFileScanner";

/**
 * Reconciles C declaration records and Doxygen ownership into graph inventory.
 *
 * File scanning records tags, declarators, source sites, and documentation before
 * publication. Materialization groups compatible declarations within their
 * physical file boundary, projects supported aliases, then attaches annotations
 * to the resulting semantic owners. Cross-file name equality is not C linkage
 * analysis and does not authorize merging units.
 *
 * Each analysis owns its parser and output records. Source and syntax failures
 * remain on the inventory through final ownership validation, preventing partial
 * extraction from being mistaken for a complete empty population.
 */
export class CAdapter implements IEvidenceAdapter {
  /**
   * C artifact discriminator for extraction and inventory records.
   *
   * A header extension alone does not select C++ semantics; configuration chooses
   * this adapter and its C-specific declaration and tag namespaces.
   */
  public readonly type = "c";

  /**
   * Analyzes captured C source and returns reconciled, serializable records.
   *
   * The snapshot is validated and copied before parsing. Compatible declarations
   * are materialized before documentation so aliases and shared sites retain
   * correct owners. Parser resources close on both success and failure.
   */
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
          "Restore access to the selected C source before evaluating coverage.",
        location: { file: diagnostic.path },
      })),
      dependencies: input.dependencies,
      complete: input.complete,
    };
    const parser = new EvidenceParser();
    try {
      const analyses = await Promise.all(
        input.files.map((source) => this.scan(parser, source)),
      );
      for (const analysis of analyses) {
        inventory.diagnostics.push(...analysis.diagnostics);
        inventory.complete &&= analysis.complete;
      }
      // Resolve identity before attaching tags: typedef aliases and shared
      // declarators must not manufacture extra semantic evidence hosts.
      const published = this.materializeUnits(inventory, analyses);
      this.materializeDocumentation(inventory, analyses, published);
      return new EvidenceInventory([inventory]).snapshot();
    } finally {
      await parser.close();
    }
  }

  private async scan(
    parser: EvidenceParser,
    source: IEvidenceSourceFile,
  ): Promise<ICFileAnalysis> {
    const file = source.addresses[0]?.relative ?? source.physicalPath;
    try {
      return await parser.parse(
        { type: "c", file, content: source.content },
        (session) => new CFileScanner(session, source).scan(),
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
            code: `c-${parserError?.code ?? "parse-failed"}`,
            severity: "error",
            message:
              parserError?.message ??
              `C parsing failed: ${cause instanceof Error ? cause.message : String(cause)}`,
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

  private materializeUnits(
    inventory: IEvidenceInventory,
    analyses: ICFileAnalysis[],
  ): Map<string, string> {
    const declarations = analyses.flatMap((analysis) => analysis.declarations);
    const declarationAnalysis = new Map<string, ICFileAnalysis>();
    for (const analysis of analyses)
      for (const declaration of analysis.declarations)
        declarationAnalysis.set(declaration.id, analysis);

    const declarationIds = new Map<string, string>();
    const groups = new Map<string, ICDeclarationGroup>();
    const published = new Map<string, string>();
    for (const analysis of analyses)
      for (const declaration of analysis.declarations) {
        const id = this.unitId(declaration, analysis.source.id);
        declarationIds.set(declaration.id, id);
        published.set(declaration.id, id);
        let group = groups.get(id);
        if (group === undefined) {
          group = { id, declarations: [] };
          groups.set(id, group);
        }
        group.declarations.push(declaration);
      }

    const tagForms = new Map<string, Set<CDeclarationForm>>();
    const firstTags = new Map<string, ICDeclaration>();
    for (const declaration of declarations) {
      if (declaration.tagName === undefined) continue;
      const analysis = declarationAnalysis.get(declaration.id);
      if (analysis === undefined) continue;
      const key = `${analysis.source.id}:${declaration.tagName}`;
      const forms = tagForms.get(key) ?? new Set<CDeclarationForm>();
      forms.add(declaration.form);
      tagForms.set(key, forms);
      if (!firstTags.has(key)) firstTags.set(key, declaration);
    }
    for (const [key, forms] of tagForms)
      if (forms.size > 1) {
        const first = firstTags.get(key);
        const analysis =
          first === undefined ? undefined : declarationAnalysis.get(first.id);
        if (first !== undefined && analysis !== undefined)
          this.problem(
            inventory,
            analysis,
            "c-tag-conflict",
            `C tag '${first.tagName ?? first.name}' has incompatible struct, union, or enum forms.`,
            "Use one tag kind for this name within the physical source file.",
          );
      }

    for (const group of groups.values()) {
      const first = group.declarations[0];
      const analysis =
        first === undefined ? undefined : declarationAnalysis.get(first.id);
      if (first === undefined || analysis === undefined) continue;
      const forms = new Set(
        group.declarations.map((declaration) => declaration.form),
      );
      const definitions = group.declarations.filter(
        (declaration) => declaration.definition,
      );
      const repeatedDefinition =
        (first.form === "function" ||
          first.form === "struct" ||
          first.form === "union" ||
          first.form === "enum") &&
        definitions.length > 1;
      const repeatedMember =
        (first.form === "field" || first.form === "enumerator") &&
        group.declarations.length > 1;
      if (forms.size > 1 || repeatedDefinition || repeatedMember)
        this.problem(
          inventory,
          analysis,
          "c-declaration-conflict",
          `C identity '${first.identity.join(".")}' has incompatible declarations inside one physical source file.`,
          "Keep compatible declarations with at most one aggregate, enum, or function definition.",
        );
    }

    const resolvedAddresses = new Map<string, ICDeclarationAddress[]>();
    for (const declaration of declarations)
      resolvedAddresses.set(
        declaration.id,
        this.declarationAddresses(declaration, groups, declarationIds),
      );

    const canonicalAddresses = new Set<string>();
    const canonicalOwners = new Map<string, string>();
    const reportedAddresses = new Set<string>();
    for (const analysis of analyses)
      for (const declaration of analysis.declarations)
        for (const sourceAddress of analysis.source.addresses)
          for (const address of resolvedAddresses.get(declaration.id) ?? []) {
            if (!address.canonical) continue;
            const key = this.addressKey(
              sourceAddress.absolute,
              address.segments,
            );
            canonicalAddresses.add(key);
            const unitId = published.get(declaration.id);
            const owner = canonicalOwners.get(key);
            if (
              unitId !== undefined &&
              owner !== undefined &&
              owner !== unitId &&
              !reportedAddresses.has(key)
            ) {
              reportedAddresses.add(key);
              this.problem(
                inventory,
                analysis,
                "c-declaration-conflict",
                `C address '${address.segments.join(".")}' names incompatible declarations inside one physical source file.`,
                "Rename or remove the conflicting ordinary identifier declaration.",
              );
            } else if (unitId !== undefined && owner === undefined)
              canonicalOwners.set(key, unitId);
          }

    const units = new Map<string, IEvidenceUnit>();
    const addresses = new Set<string>();
    for (const analysis of analyses)
      for (const declaration of analysis.declarations) {
        const id = published.get(declaration.id);
        if (id === undefined) continue;
        const parentId =
          declaration.ownerDeclarationId === undefined
            ? undefined
            : published.get(declaration.ownerDeclarationId);
        let unit = units.get(id);
        if (unit === undefined) {
          unit = {
            id,
            type: "c",
            symbol: declaration.symbol,
            identity: declaration.identity,
            name: declaration.name,
            sites: [structuredClone(declaration.site)],
            withdrawals: [],
            ...(parentId === undefined ? {} : { parentId }),
          };
          units.set(id, unit);
        } else if (!unit.sites.some((site) => site.id === declaration.site.id))
          unit.sites.push(structuredClone(declaration.site));

        for (const sourceAddress of analysis.source.addresses)
          for (const declarationAddress of resolvedAddresses.get(
            declaration.id,
          ) ?? []) {
            if (
              !declarationAddress.canonical &&
              declarationAddress.aliasPrefixes.some((prefix) =>
                canonicalAddresses.has(
                  this.addressKey(sourceAddress.absolute, prefix),
                ),
              )
            )
              continue;
            const address: IEvidencePublicAddress = {
              unitId: id,
              file: sourceAddress.absolute,
              segments: declarationAddress.segments,
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

  private declarationAddresses(
    declaration: ICDeclaration,
    groups: Map<string, ICDeclarationGroup>,
    declarationIds: Map<string, string>,
  ): ICDeclarationAddress[] {
    if (declaration.ownerDeclarationId === undefined)
      return declaration.addresses;
    const ownerId = declarationIds.get(declaration.ownerDeclarationId);
    const owner = ownerId === undefined ? undefined : groups.get(ownerId);
    if (owner === undefined) return [];
    const output: ICDeclarationAddress[] = [];
    const keys = new Set<string>();
    for (const ownerDeclaration of owner.declarations)
      for (const address of ownerDeclaration.addresses) {
        const candidate: ICDeclarationAddress = {
          segments: [...address.segments, declaration.name],
          canonical: address.canonical,
          aliasPrefixes: address.aliasPrefixes,
        };
        const key = JSON.stringify(candidate);
        if (keys.has(key)) continue;
        keys.add(key);
        output.push(candidate);
      }
    return output;
  }

  private materializeDocumentation(
    inventory: IEvidenceInventory,
    analyses: ICFileAnalysis[],
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

  private materializeUndocumentedHosts(
    inventory: IEvidenceInventory,
    analysis: ICFileAnalysis,
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
    const groups = new Map<string, ICDeclaration[]>();
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

  private attachmentGroups(
    documentation: ICDocumentation,
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
    source: IEvidenceSourceFile,
    documentation: ICDocumentation,
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
              "Move the annotation into Doxygen attached to a supported C declaration.",
          }),
    };
  }

  private parse(
    source: IEvidenceSourceFile,
    documentation: ICDocumentation,
    host: IEvidenceHost,
  ): IEvidenceTagParseResult {
    return EvidenceTagParser.parse(
      source.content,
      host,
      CDocumentation.read(source, documentation, host.id),
    );
  }

  private annotation(
    analysis: ICFileAnalysis,
    documentation: ICDocumentation,
  ): boolean {
    return this.annotationPattern(
      CDocumentation.read(analysis.source, documentation, documentation.id)
        .text,
      true,
    );
  }

  private claimAnnotation(
    analysis: ICFileAnalysis,
    documentation: ICDocumentation,
  ): boolean {
    return this.annotationPattern(
      CDocumentation.read(analysis.source, documentation, documentation.id)
        .text,
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

  private unitId(declaration: ICDeclaration, sourceId: string): string {
    return `c:${JSON.stringify(sourceId)}:${declaration.symbol}:${JSON.stringify(declaration.identity)}`;
  }

  private addressKey(file: string, segments: string[]): string {
    return JSON.stringify([file, segments]);
  }

  private problem(
    inventory: IEvidenceInventory,
    analysis: ICFileAnalysis,
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
