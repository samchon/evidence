import typia from "typia";

import { EvidenceDocumentation } from "../EvidenceDocumentation";
import { EvidenceInventory } from "../EvidenceInventory";
import { EvidenceParser } from "../EvidenceParser";
import { EvidenceParserError } from "../EvidenceParserError";
import { EvidenceTagParser } from "../EvidenceTagParser";
import type { IEvidenceAdapter } from "../structures/IEvidenceAdapter";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceSourceSnapshot } from "../structures/IEvidenceSourceSnapshot";
import type { IEvidenceTagParseResult } from "../structures/IEvidenceTagParseResult";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { IEcmaScriptComment } from "./IEcmaScriptComment";
import type { IEcmaScriptFileAnalysis } from "./IEcmaScriptFileAnalysis";
import { EcmaScriptExportResolver } from "./EcmaScriptExportResolver";
import { EcmaScriptFileScanner } from "./EcmaScriptFileScanner";
import { EcmaScriptModuleResolver } from "./EcmaScriptModuleResolver";
import type { EcmaScriptType } from "./EcmaScriptType";

/** Shared inventory pipeline for TypeScript and JavaScript adapters. */
export class EcmaScriptAdapter implements IEvidenceAdapter {
  public constructor(
    public readonly type: EcmaScriptType,
    private readonly name: string,
  ) {}

  public async analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const moduleResolution =
      this.type === "javascript"
        ? await new EcmaScriptModuleResolver().resolve(input.files)
        : undefined;
    const sourceDiagnostics: IEvidenceInventory["diagnostics"] =
      input.diagnostics.map((diagnostic) => ({
        code: `source-${diagnostic.code}`,
        severity: "error",
        message: diagnostic.message,
        repair: `Restore access to the selected ${this.name} source before evaluating coverage.`,
        location: { file: diagnostic.path },
      }));
    const parser = new EvidenceParser();
    const inventory: IEvidenceInventory = {
      schemaVersion: 1,
      sources: input.files,
      annotationRanges: [],
      units: [],
      addresses: [],
      hosts: [],
      declarations: [],
      reviews: [],
      diagnostics: [
        ...sourceDiagnostics,
        ...(moduleResolution?.diagnostics ?? []),
      ],
      dependencies: [
        ...input.dependencies,
        ...(moduleResolution?.dependencies ?? []),
      ],
      complete: input.complete && (moduleResolution?.complete ?? true),
    };
    try {
      const analyses = await Promise.all(
        input.files.map((source) =>
          this.scan(
            parser,
            source,
            this.type === "javascript" && moduleResolution !== undefined
              ? (moduleResolution.modes.get(source.id) ?? "commonjs")
              : "esm",
          ),
        ),
      );
      for (const analysis of analyses) {
        inventory.annotationRanges.push(
          ...analysis.comments
            .filter((comment) => comment.syntax.opening === "/**")
            .map((comment) => ({
              file: analysis.source.physicalPath,
              range: comment.range,
            })),
        );
        inventory.units.push(...analysis.units.map((entry) => entry.unit));
        inventory.diagnostics.push(...analysis.diagnostics);
        inventory.complete &&= analysis.complete;
      }
      const published = new EcmaScriptExportResolver(
        analyses,
        inventory,
        input.root,
        this.type,
      ).publish();
      inventory.units = inventory.units.filter((unit) =>
        published.has(unit.id),
      );
      this.materializeComments(inventory, analyses, published);
      return new EvidenceInventory([inventory]).snapshot();
    } finally {
      await parser.close();
    }
  }

  private async scan(
    parser: EvidenceParser,
    source: IEvidenceSourceFile,
    mode: IEcmaScriptFileAnalysis["mode"],
  ): Promise<IEcmaScriptFileAnalysis> {
    const file = source.addresses[0]?.relative ?? source.physicalPath;
    try {
      return await parser.parse(
        { type: this.type, file, content: source.content },
        (session) =>
          new EcmaScriptFileScanner(session, source, this.type, mode).scan(),
      );
    } catch (cause) {
      const parserError =
        cause instanceof EvidenceParserError ? cause : undefined;
      return {
        source,
        mode,
        units: [],
        excludedRoots: [],
        exports: [],
        imports: [],
        positions: [],
        comments: [],
        diagnostics: [
          {
            code: `${this.type}-${parserError?.code ?? "parse-failed"}`,
            severity: "error",
            message:
              parserError?.message ??
              `${this.name} parsing failed: ${cause instanceof Error ? cause.message : String(cause)}`,
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

  private materializeComments(
    inventory: IEvidenceInventory,
    analyses: IEcmaScriptFileAnalysis[],
    published: Set<string>,
  ): void {
    const units = new Map(inventory.units.map((unit) => [unit.id, unit]));
    for (const analysis of analyses)
      for (const comment of analysis.comments) {
        const attachments = comment.attachments.filter((entry) =>
          published.has(entry.unitId),
        );
        if (
          attachments.length === 0 &&
          !this.annotation(analysis.source, comment)
        )
          continue;
        const siteId = attachments[0]?.siteId;
        const unitIds = Array.from(
          new Set(attachments.map((entry) => entry.unitId)),
        );
        const candidate = this.host(analysis.source, comment, siteId, unitIds);
        if (candidate.attachment === "attached") {
          const parsed = this.parse(analysis.source, comment, candidate);
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
      for (const comment of analysis.comments) {
        const publishedAttachments = comment.attachments.filter((entry) =>
          published.has(entry.unitId),
        );
        const attachments = publishedAttachments.filter(
          (entry) =>
            entry.withdrawalOnly !== true &&
            entry.positionId !== undefined &&
            !hidden.has(entry.unitId),
        );
        if (
          attachments.length === 0 &&
          publishedAttachments.length !== 0 &&
          !this.claimAnnotation(analysis.source, comment)
        )
          continue;
        if (
          attachments.length === 0 &&
          !this.annotation(analysis.source, comment)
        )
          continue;
        const siteId = attachments[0]?.siteId;
        const positionId = attachments[0]?.positionId;
        const unitIds = Array.from(
          new Set(
            attachments
              .filter(
                (entry) =>
                  entry.positionId === positionId && entry.siteId === siteId,
              )
              .map((entry) => entry.unitId),
          ),
        );
        const host = this.host(analysis.source, comment, siteId, unitIds);
        inventory.hosts.push(host);
        const parsed = this.parse(analysis.source, comment, host);
        inventory.declarations.push(...parsed.declarations);
        inventory.reviews.push(...parsed.reviews);
        inventory.diagnostics.push(...parsed.diagnostics);
      }
    this.materializeUndocumentedHosts(inventory, analyses, published, hidden);
  }

  private materializeUndocumentedHosts(
    inventory: IEvidenceInventory,
    analyses: IEcmaScriptFileAnalysis[],
    published: Set<string>,
    hidden: Set<string>,
  ): void {
    const documented = new Set(
      analyses.flatMap((analysis) =>
        analysis.comments.flatMap((comment) =>
          comment.attachments.flatMap((attachment) =>
            attachment.withdrawalOnly !== true &&
            attachment.positionId !== undefined &&
            published.has(attachment.unitId) &&
            !hidden.has(attachment.unitId)
              ? [attachment.positionId]
              : [],
          ),
        ),
      ),
    );
    for (const analysis of analyses)
      for (const position of analysis.positions) {
        if (documented.has(position.id)) continue;
        const unitIds = position.unitIds.filter(
          (unitId) => published.has(unitId) && !hidden.has(unitId),
        );
        if (unitIds.length === 0) continue;
        inventory.hosts.push({
          id: `${position.id}:host`,
          file: analysis.source.physicalPath,
          range: position.range,
          origins: analysis.source.addresses.map((address) => address.absolute),
          siteId: position.siteId,
          unitIds,
          attachment: "attached",
        });
      }
  }

  private host(
    source: IEvidenceSourceFile,
    comment: IEcmaScriptComment,
    siteId: string | undefined,
    unitIds: string[],
  ): IEvidenceHost {
    const attached = siteId !== undefined && unitIds.length !== 0;
    return {
      id: comment.id,
      file: source.physicalPath,
      range: comment.range,
      origins: source.addresses.map((address) => address.absolute),
      unitIds,
      attachment: attached ? "attached" : "unsupported",
      ...(attached ? { siteId } : {}),
      ...(attached
        ? {}
        : {
            problem: `Move the annotation into JSDoc attached to a supported public ${this.name} declaration.`,
          }),
    };
  }

  private parse(
    source: IEvidenceSourceFile,
    comment: IEcmaScriptComment,
    host: IEvidenceHost,
  ): IEvidenceTagParseResult {
    const documentation = EvidenceDocumentation.read(
      source.content,
      host.id,
      host.range,
      comment.syntax,
    );
    return EvidenceTagParser.parse(source.content, host, documentation);
  }

  private annotation(
    source: IEvidenceSourceFile,
    comment: IEcmaScriptComment,
  ): boolean {
    const raw = source.content.slice(
      comment.range.start.offset,
      comment.range.end.offset,
    );
    return /(?:^|[\r\n])[ \t]*(?:(?:\/\/|\/\*+|\*)[ \t]*)?@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
      raw,
    );
  }

  private claimAnnotation(
    source: IEvidenceSourceFile,
    comment: IEcmaScriptComment,
  ): boolean {
    const raw = source.content.slice(
      comment.range.start.offset,
      comment.range.end.offset,
    );
    return /(?:^|[\r\n])[ \t]*(?:(?:\/\/|\/\*+|\*)[ \t]*)?@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)\b/u.test(
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
}
