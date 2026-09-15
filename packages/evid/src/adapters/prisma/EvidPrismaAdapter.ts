import typia from "typia";

import { EvidInventory } from "../../graph/EvidInventory";
import { EvidTagParser } from "../../parsers/EvidTagParser";
import type { IEvidPrismaCommentRun } from "./IEvidPrismaCommentRun";
import type { IEvidPrismaFileAnalysis } from "./IEvidPrismaFileAnalysis";
import type { IEvidPrismaLocatedDeclaration } from "./IEvidPrismaLocatedDeclaration";
import type { IEvidPrismaModel } from "./IEvidPrismaModel";
import type { IEvidPrismaOwnedUnit } from "./IEvidPrismaOwnedUnit";
import type { IEvidPrismaSchemaFile } from "./IEvidPrismaSchemaFile";
import { IEvidnventoryMerge } from "../../internal/IEvidnventoryMerge";
import { EvidPrismaFileScanner } from "./EvidPrismaFileScanner";
import { EvidPrismaModelLoader } from "./EvidPrismaModelLoader";
import { EvidSourceText } from "../../internal/EvidSourceText";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidHost } from "../../structures/IEvidHost";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";
import type { IEvidTagParseResult } from "../../structures/IEvidTagParseResult";
import type { IEvidUnit } from "../../structures/IEvidUnit";
import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidArtifactType } from "../../typings/EvidArtifactType";
import type { EvidDatabaseSymbol } from "../../typings/EvidDatabaseSymbol";

/**
 * Extracts Prisma models, columns, relations, and declaration documentation.
 *
 * Selected files form one schema for the Prisma model loader, while a separate
 * source scan retains exact declaration and comment coordinates. Materialization
 * joins those views so semantic schema units remain tied to their physical hosts.
 * A schema-loading failure produces incomplete analysis instead of an empty pass.
 */
export class EvidPrismaAdapter implements IEvidAdapter {
  /**
   * Artifact discriminator selecting Prisma schema extraction.
   *
   * Prisma target spelling and database selectors apply to the resulting inventory.
   */
  public readonly type: EvidArtifactType = "prisma";

  /**
   * Loads one combined schema from a validated, cloned source snapshot.
   *
   * Incomplete discovery is returned without attempting to certify partial schema
   * content. Complete input is deduplicated by physical identity, parsed for models,
   * and joined to source locations before annotations are materialized.
   */
  public async analyze(
    snapshot: IEvidSourceSnapshot,
  ): Promise<IEvidInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const inventory = this.inventory(input);
    if (!input.complete || input.files.length === 0)
      return new EvidInventory([inventory]).snapshot();

    const files = this.schemaFiles(input.files);
    let models: IEvidPrismaModel[];
    try {
      models = (await EvidPrismaModelLoader.load(input.root.absolute, files))
        .models;
    } catch (cause) {
      inventory.complete = false;
      inventory.diagnostics.push({
        code: "prisma-parse-failed",
        severity: "error",
        message: `The configured Prisma schema could not be parsed: ${this.message(cause)}`,
        repair:
          "Correct the schema, or restore a compatible @prisma/prisma-schema-wasm dependency when parser resolution or validation failed.",
        ...(files[0] === undefined
          ? {}
          : { location: { file: files[0].source.physicalPath } }),
      });
      return new EvidInventory([inventory]).snapshot();
    }

    // The model parser owns schema semantics; the source scanner owns exact
    // spans. Join both before attaching tags so normalized models do not invent
    // comment coordinates or erase the original declaration boundaries.
    const analyses = files.map((file) =>
      new EvidPrismaFileScanner(file.source).scan(),
    );
    const owned = this.units(inventory, models, analyses, files);
    this.materialize(inventory, analyses, owned);
    return new EvidInventory([inventory]).snapshot();
  }

  /**
   * Seeds inventory state while preserving discovery failures and dependencies.
   *
   * No declarations are certified at this stage; the schema-loading phase adds
   * semantic units only after it can interpret the complete selected schema.
   */
  private inventory(input: IEvidSourceSnapshot): IEvidInventory {
    return {
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
          "Restore access to every selected Prisma source before evaluating coverage.",
        location: { file: diagnostic.path },
      })),
      dependencies: input.dependencies,
      complete: input.complete,
    };
  }

  /**
   * Deduplicates physical schema files and chooses deterministic logical parser names.
   *
   * Multiple selected link spellings must not submit the same declarations twice.
   * All addresses are retained while the first sorted selected relative path names
   * the schema input supplied to the model loader.
   */
  private schemaFiles(sources: IEvidSourceFile[]): IEvidPrismaSchemaFile[] {
    const records = new Map<string, IEvidSourceFile>();
    for (const source of sources) {
      const previous = records.get(source.id);
      if (previous === undefined) records.set(source.id, source);
      else previous.addresses.push(...source.addresses);
    }
    return Array.from(records.values())
      .map((source) => {
        source.addresses = IEvidnventoryMerge.sourceAddresses(source.addresses);
        return {
          name:
            source.addresses
              .filter((address) => address.selected !== false)
              .map((address) => address.relative)
              .sort(IEvidnventoryMerge.compare)[0] ?? source.physicalPath,
          source,
        };
      })
      .sort((x, y) => IEvidnventoryMerge.compare(x.name, y.name));
  }

  private units(
    inventory: IEvidInventory,
    models: IEvidPrismaModel[],
    analyses: IEvidPrismaFileAnalysis[],
    files: IEvidPrismaSchemaFile[],
  ): Map<string, IEvidPrismaOwnedUnit> {
    const locations = new Map(
      analyses.flatMap((analysis) =>
        analysis.locations.map((location) => [
          location.key,
          { analysis, location },
        ]),
      ),
    );
    const first = files[0]?.source;
    const output = new Map<string, IEvidPrismaOwnedUnit>();
    for (const model of models) {
      const parent = this.unit(
        "model",
        [model.name],
        undefined,
        model.documentation,
        model.digest,
        locations,
        first,
      );
      this.publish(inventory, output, parent);
      for (const field of model.fields) {
        const child = this.unit(
          field.symbol,
          [model.name, field.name],
          parent.unit.id,
          field.documentation,
          field.digest,
          locations,
          first,
        );
        this.publish(inventory, output, child);
      }
    }
    return output;
  }

  private unit(
    symbol: EvidDatabaseSymbol,
    identity: string[],
    parentId: string | undefined,
    documentation: string,
    digest: string,
    locations: Map<string, IEvidPrismaLocatedDeclaration>,
    fallback: IEvidSourceFile | undefined,
  ): IEvidPrismaOwnedUnit {
    const key = identity.join(".");
    const found = locations.get(key);
    const source = found === undefined ? fallback : found.analysis.source;
    if (source === undefined)
      throw new Error("A parsed Prisma unit has no selected source file.");
    const text = new EvidSourceText(source.content);
    const range = found === undefined ? text.range(0, 0) : found.location.range;
    const id = `prisma:${key}`;
    const site: IEvidUnitSite = {
      id: `${id}:site:${source.id}:${range.start.offset}:${range.end.offset}`,
      file: source.physicalPath,
      range,
      content: [range],
    };
    const unit: IEvidUnit = {
      id,
      ...(parentId === undefined ? {} : { parentId }),
      type: "prisma",
      symbol,
      identity,
      name: key,
      contentDigest: digest,
      sites: [site],
      withdrawals: [],
    };
    return { key, documentation, unit, site };
  }

  private publish(
    inventory: IEvidInventory,
    units: Map<string, IEvidPrismaOwnedUnit>,
    owned: IEvidPrismaOwnedUnit,
  ): void {
    if (units.has(owned.key)) return;
    units.set(owned.key, owned);
    inventory.units.push(owned.unit);
    inventory.addresses.push({
      unitId: owned.unit.id,
      file: "prisma:",
      segments: owned.unit.identity,
    });
  }

  private materialize(
    inventory: IEvidInventory,
    analyses: IEvidPrismaFileAnalysis[],
    owned: Map<string, IEvidPrismaOwnedUnit>,
  ): void {
    const units = new Map(
      Array.from(owned.values()).map((entry) => [entry.unit.id, entry.unit]),
    );
    for (const analysis of analyses)
      for (const run of analysis.comments) {
        if (run.form !== "doc") continue;
        for (const range of run.commentRanges)
          inventory.annotationRanges.push({
            file: analysis.source.physicalPath,
            range,
          });
        const entry = owned.get(run.key);
        if (entry === undefined) continue;
        const parsed = this.parse(
          analysis.source,
          run,
          this.host(analysis.source, run, entry, true),
          true,
        );
        entry.unit.withdrawals.push(...parsed.withdrawals);
      }
    for (const entry of owned.values())
      if (entry.unit.withdrawals.length === 0) this.recoverWithdrawal(entry);

    const hidden = new Set(
      Array.from(owned.values())
        .filter((entry) => this.withdrawn(entry.unit.id, units, new Set()))
        .map((entry) => entry.unit.id),
    );
    const documented = new Set<string>();
    for (const analysis of analyses)
      for (const run of analysis.comments) {
        const entry = owned.get(run.key);
        if (run.form === "doc" && entry !== undefined)
          documented.add(entry.key);
        const annotation = this.annotation(run.text);
        const claimAnnotation = this.claimAnnotation(run.text);
        const attached =
          run.form === "doc" &&
          entry !== undefined &&
          !hidden.has(entry.unit.id);
        if (!attached && !run.fileLevel && !annotation) continue;
        if (
          run.form === "doc" &&
          entry !== undefined &&
          hidden.has(entry.unit.id) &&
          !claimAnnotation
        )
          continue;
        const host = this.host(analysis.source, run, entry, attached);
        inventory.hosts.push(host);
        const parsed = this.parse(analysis.source, run, host, attached);
        if (run.fileLevel) this.fileDeclarations(inventory, parsed);
        else inventory.declarations.push(...parsed.declarations);
        inventory.reviews.push(...parsed.reviews);
        inventory.diagnostics.push(...parsed.diagnostics);
        this.reportBuried(inventory, analysis.source, run);
      }
    for (const entry of owned.values()) {
      if (hidden.has(entry.unit.id) || documented.has(entry.key)) continue;
      const source = inventory.sources.find(
        (candidate) => candidate.physicalPath === entry.site.file,
      );
      inventory.hosts.push({
        id: `prisma:${entry.unit.id}:position`,
        file: entry.site.file,
        range: entry.site.range,
        ...(source === undefined
          ? {}
          : {
              origins: source.addresses.map((address) => address.absolute),
            }),
        siteId: entry.site.id,
        unitIds: [entry.unit.id],
        attachment: "attached",
      });
    }
  }

  private host(
    source: IEvidSourceFile,
    run: IEvidPrismaCommentRun,
    entry: IEvidPrismaOwnedUnit | undefined,
    attached: boolean,
  ): IEvidHost {
    const carrier = run.fileLevel;
    return {
      id: `prisma:${source.id}:comment:${run.range.start.offset}`,
      file: source.physicalPath,
      range: run.range,
      origins: source.addresses.map((address) => address.absolute),
      ...(attached && entry !== undefined ? { siteId: entry.site.id } : {}),
      unitIds: attached && entry !== undefined ? [entry.unit.id] : [],
      attachment: attached || carrier ? "attached" : "unsupported",
      ...(attached || carrier ? {} : { problem: this.hostProblem(run, entry) }),
    };
  }

  private parse(
    source: IEvidSourceFile,
    run: IEvidPrismaCommentRun,
    host: IEvidHost,
    allowWithdrawal: boolean,
  ): IEvidTagParseResult {
    const documentation: IEvidDocumentation = {
      hostId: host.id,
      text: run.text,
      offsets: run.offsets,
      ends: run.ends,
      tagBoundaries: false,
      allowWithdrawal,
    };
    return EvidTagParser.parse(source.content, host, documentation);
  }

  private fileDeclarations(
    inventory: IEvidInventory,
    parsed: IEvidTagParseResult,
  ): void {
    for (const declaration of parsed.declarations)
      if (declaration.kind === "evidenceExclude")
        inventory.declarations.push(declaration);
      else
        inventory.diagnostics.push({
          code: "prisma-file-evidence",
          severity: "error",
          message:
            "Positive evidence cannot be attached to a file-level Prisma exclusion carrier.",
          repair:
            "Move @evid directly above the model, column, or relation it describes.",
          location: declaration.location,
          hostId: declaration.hostId,
          target: declaration.target,
        });
  }

  private recoverWithdrawal(entry: IEvidPrismaOwnedUnit): void {
    for (const line of entry.documentation.split("\n")) {
      const match = /^@(internal|hidden|ignore)(?:[ \t]|$)/u.exec(line.trim());
      const tag = match?.[1];
      if (tag !== "internal" && tag !== "hidden" && tag !== "ignore") continue;
      entry.unit.withdrawals.push({
        tag,
        location: { file: entry.site.file, range: entry.site.range },
      });
      return;
    }
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

  private hostProblem(
    run: IEvidPrismaCommentRun,
    entry: IEvidPrismaOwnedUnit | undefined,
  ): string {
    if (run.form === "line")
      return "Write the citation in a '///' or '/* */' documentation comment; Prisma discards '//' comments.";
    if (run.key === "")
      return "Move the citation directly above a model, view, column, or relation; this comment documents no declaration.";
    if (entry === undefined)
      return `Move the citation to a model, view, column, or relation; '${run.key}' is outside the Prisma Evid population.`;
    return "Remove the citation from the withdrawn declaration or restore that declaration to the public schema surface.";
  }

  private annotation(text: string): boolean {
    return /(?:^|\n)[ \t]*(?:[/*]+[ \t]*)?@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
      text,
    );
  }

  private claimAnnotation(text: string): boolean {
    return /(?:^|\n)[ \t]*(?:[/*]+[ \t]*)?@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)\b/u.test(
      text,
    );
  }

  private reportBuried(
    inventory: IEvidInventory,
    source: IEvidSourceFile,
    run: IEvidPrismaCommentRun,
  ): void {
    const sourceText = new EvidSourceText(source.content);
    let offset = 0;
    for (const line of run.text.split("\n")) {
      const trimmed = line.trim();
      if (
        /^@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)\b/u.test(
          trimmed,
        )
      ) {
        offset += line.length + 1;
        continue;
      }
      const exposed = trimmed.replace(/^[/*]+[ \t]*/u, "");
      if (
        /^@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)\b/u.test(
          exposed,
        )
      ) {
        const first = line.search(/\S/u);
        const start = run.offsets[offset + Math.max(0, first)];
        const end = run.ends[offset + line.length - 1];
        inventory.diagnostics.push({
          code: "prisma-buried-annotation",
          severity: "error",
          message:
            "An Evid tag is buried behind extra comment punctuation.",
          repair:
            "Remove the extra leading slash or asterisk so the Evid tag opens its documentation line.",
          location: {
            file: source.physicalPath,
            range:
              start === undefined || end === undefined
                ? run.range
                : sourceText.range(start, end),
          },
        });
      }
      offset += line.length + 1;
    }
  }

  private message(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
