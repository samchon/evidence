import { EvidenceDocumentation } from "../EvidenceDocumentation";
import { EvidenceTagParser } from "../EvidenceTagParser";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import type { IMarkdownComment } from "./IMarkdownComment";
import { MarkdownSyntax } from "./MarkdownSyntax";
import { SourceText } from "./SourceText";

/** Materializes one physical Markdown source and every selected logical alias. */
export class MarkdownScanner {
  private readonly text: SourceText;
  private readonly lineStarts = [0];
  private readonly lineEnds: number[] = [];
  private readonly fenced: boolean[] = [];
  private readonly rendered: boolean[] = [];
  private readonly commentOnly: boolean[] = [];
  private readonly comments: IMarkdownComment[] = [];
  private readonly owners: Array<string | undefined> = [];
  private readonly hostUnits: Array<string | undefined> = [];
  private readonly hostSites: Array<string | undefined> = [];
  private readonly hostProblems: Array<string | undefined> = [];
  private readonly sites = new Map<string, IEvidenceUnitSite>();
  private readonly unitSites = new Map<string, string>();

  public constructor(
    private readonly inventory: IEvidenceInventory,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
  }

  public scan(): void {
    this.splitLines();
    this.markExamples();
    this.findComments();
    this.materializeUnits();
    this.assignContent();
    this.materializeComments();
    this.reportRenderedAnnotations();
  }

  private splitLines(): void {
    for (let index = 0; index < this.source.content.length; ++index)
      if (this.source.content[index] === "\n") this.lineStarts.push(index + 1);
    for (let index = 0; index < this.lineStarts.length; ++index) {
      const next = this.lineStarts[index + 1];
      const rawEnd = next === undefined ? this.source.content.length : next - 1;
      this.lineEnds.push(
        this.source.content[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd,
      );
      this.fenced.push(false);
      this.rendered.push(false);
      this.commentOnly.push(false);
    }
  }

  private markExamples(): void {
    let fenceMarker: "`" | "~" | undefined;
    let fenceLength = 0;
    let rendered = false;
    let comment = false;
    for (let index = 0; index < this.lineStarts.length; ++index) {
      const line = this.line(index);
      if (fenceMarker !== undefined) {
        this.fenced[index] = true;
        const delimiter = MarkdownSyntax.fence(line);
        if (
          delimiter !== undefined &&
          delimiter.marker === fenceMarker &&
          delimiter.length >= fenceLength &&
          delimiter.remainder.trim() === ""
        ) {
          fenceMarker = undefined;
          fenceLength = 0;
        }
        continue;
      }
      if (rendered) {
        this.rendered[index] = true;
        const edge = MarkdownSyntax.renderedEdge(line);
        if (edge === "close" || edge === "both") rendered = false;
        continue;
      }
      if (comment) {
        this.commentOnly[index] = true;
        if (line.includes("-->")) comment = false;
        continue;
      }
      const delimiter = MarkdownSyntax.fence(line);
      if (delimiter !== undefined) {
        this.fenced[index] = true;
        fenceMarker = delimiter.marker;
        fenceLength = delimiter.length;
        continue;
      }
      if (MarkdownSyntax.indentedCode(line)) continue;
      const opening = line.indexOf("<!--");
      if (opening >= 0 && line.slice(0, opening).trim() === "") {
        this.commentOnly[index] = true;
        if (!line.slice(opening + 4).includes("-->")) comment = true;
        continue;
      }
      let outside = "";
      let cursor = 0;
      while (cursor < line.length) {
        const commentStart = line.indexOf("<!--", cursor);
        if (commentStart < 0) {
          outside += line.slice(cursor);
          cursor = line.length;
          continue;
        }
        outside += line.slice(cursor, commentStart);
        const commentEnd = line.indexOf("-->", commentStart + 4);
        if (commentEnd < 0) {
          comment = true;
          cursor = line.length;
          continue;
        }
        cursor = commentEnd + 3;
      }
      const edge = MarkdownSyntax.renderedEdge(outside);
      if (edge !== "none") {
        this.rendered[index] = true;
        rendered = edge === "open";
      }
    }
  }

  private findComments(): void {
    let cursor = 0;
    while (cursor < this.source.content.length) {
      const start = this.source.content.indexOf("<!--", cursor);
      if (start < 0) break;
      const closing = this.source.content.indexOf("-->", start + 4);
      if (closing < 0) break;
      const end = closing + 3;
      const startLine = this.lineAt(start);
      const endLine = this.lineAt(Math.max(start, end - 1));
      const example =
        this.fenced[startLine] === true ||
        this.rendered[startLine] === true ||
        MarkdownSyntax.indentedCode(this.line(startLine)) ||
        MarkdownSyntax.inlineCode(
          this.line(startLine),
          start - (this.lineStarts[startLine] ?? 0),
        );
      if (!example) {
        this.comments.push({ start, end, startLine, endLine });
        const prefixStart = this.lineStarts[startLine] ?? 0;
        if (this.source.content.slice(prefixStart, start).trim() === "")
          this.commentOnly[startLine] = true;
        for (let line = startLine + 1; line <= endLine; ++line)
          this.commentOnly[line] = true;
      }
      cursor = end > start ? end : start + 4;
    }
  }

  private materializeUnits(): void {
    const targetable = this.source.addresses.filter(
      (address) => !MarkdownSyntax.hasWhitespace(address.relative),
    );
    for (const address of this.source.addresses)
      if (MarkdownSyntax.hasWhitespace(address.relative))
        this.inventory.diagnostics.push({
          code: "markdown-path",
          severity: "error",
          message: `Markdown path '${address.relative}' cannot form one evidence target token.`,
          repair:
            "Rename the file so its population-relative path contains no whitespace.",
          location: { file: this.source.physicalPath },
        });
    const first = targetable[0];
    let fileId: string | undefined;
    let fileSiteId: string | undefined;
    if (first !== undefined) {
      fileId = `markdown:${this.source.id}:file`;
      fileSiteId = fileId + ":site";
      const site: IEvidenceUnitSite = {
        id: fileSiteId,
        file: this.source.physicalPath,
        range: this.text.range(0, this.source.content.length),
        content: [],
      };
      const unit: IEvidenceUnit = {
        id: fileId,
        type: "markdown",
        symbol: "file",
        identity: [],
        name: first.relative,
        sites: [site],
        withdrawals: [],
      };
      this.inventory.units.push(unit);
      this.sites.set(fileSiteId, site);
      this.unitSites.set(fileId, fileSiteId);
      for (const address of targetable)
        this.inventory.addresses.push({
          unitId: fileId,
          file: address.absolute,
          segments: [],
        });
    }

    const structural: Array<string | undefined> = [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ];
    const openSites: Array<string | undefined> = [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ];
    let digestOwner = fileId;
    let hostUnit = fileId;
    let hostSite = fileSiteId;
    let hostProblem =
      fileId === undefined
        ? "Rename the Markdown file so its relative path can form an evidence target."
        : undefined;
    for (let index = 0; index < this.lineStarts.length; ++index) {
      const heading =
        this.fenced[index] === true ||
        this.rendered[index] === true ||
        this.commentOnly[index] === true
          ? undefined
          : MarkdownSyntax.heading(this.line(index));
      if (heading !== undefined) {
        hostUnit = undefined;
        hostSite = undefined;
        hostProblem =
          heading.level > 4
            ? `Move the annotation under a Markdown file, H1, H2, H3, or H4 host; H${heading.level} is not an Evidence unit.`
            : "Give this heading a resolvable title or explicit {#anchor}, then attach the annotation to it.";
        if (heading.level <= 4) {
          for (let level = heading.level; level <= 4; ++level) {
            const open = openSites[level];
            if (open !== undefined) {
              const site = this.sites.get(open);
              if (site !== undefined)
                site.range = this.text.range(
                  site.range.start.offset,
                  this.lineStarts[index] ?? this.source.content.length,
                );
            }
            openSites[level] = undefined;
            structural[level] = undefined;
          }
        }
        const parent = this.parent(structural, heading.level, fileId);
        digestOwner = parent;
        if (
          heading.level <= 4 &&
          heading.anchor !== "" &&
          fileId !== undefined
        ) {
          const start = this.lineStarts[index] ?? 0;
          const id = `markdown:${this.source.id}:h${heading.level}:${start}`;
          const siteId = id + ":site";
          const site: IEvidenceUnitSite = {
            id: siteId,
            file: this.source.physicalPath,
            range: this.text.range(start, this.source.content.length),
            content: [],
          };
          const unit: IEvidenceUnit = {
            id,
            type: "markdown",
            symbol: MarkdownSyntax.symbol(heading.level),
            identity: [heading.anchor],
            name: heading.title,
            sites: [site],
            withdrawals: [],
            ...(parent === undefined ? {} : { parentId: parent }),
          };
          this.inventory.units.push(unit);
          this.sites.set(siteId, site);
          this.unitSites.set(id, siteId);
          structural[heading.level] = id;
          openSites[heading.level] = siteId;
          digestOwner = id;
          hostUnit = id;
          hostSite = siteId;
          hostProblem = undefined;
          for (const address of targetable)
            this.inventory.addresses.push({
              unitId: id,
              file: address.absolute,
              segments: [heading.anchor],
            });
        } else if (
          heading.level <= 4 &&
          heading.anchor === "" &&
          fileId !== undefined
        )
          this.inventory.diagnostics.push({
            code: "markdown-heading",
            severity: "error",
            message: `Markdown H${heading.level} has no resolvable anchor.`,
            repair:
              "Add a nonempty heading title or a valid explicit {#anchor} suffix.",
            location: {
              file: this.source.physicalPath,
              range: this.text.range(
                this.lineStarts[index] ?? 0,
                this.lineEnds[index] ?? this.source.content.length,
              ),
            },
          });
      }
      this.owners[index] = digestOwner;
      this.hostUnits[index] = hostUnit;
      this.hostSites[index] = hostSite;
      this.hostProblems[index] = hostProblem;
    }
    for (const siteId of openSites) {
      if (siteId === undefined) continue;
      const site = this.sites.get(siteId);
      if (site !== undefined)
        site.range = this.text.range(
          site.range.start.offset,
          this.source.content.length,
        );
    }
  }

  private assignContent(): void {
    for (let index = 0; index < this.lineStarts.length; ++index) {
      const owner = this.owners[index];
      if (owner === undefined || this.commentOnly[index] === true) continue;
      const siteId = this.unitSites.get(owner);
      const site = siteId === undefined ? undefined : this.sites.get(siteId);
      if (site === undefined) continue;
      site.content.push(
        this.text.range(
          this.lineStarts[index] ?? 0,
          this.lineEnds[index] ?? this.source.content.length,
        ),
      );
    }
  }

  private materializeComments(): void {
    const origins = this.source.addresses.map((address) => address.absolute);
    for (const comment of this.comments) {
      const unitId = this.hostUnits[comment.startLine];
      const siteId = this.hostSites[comment.startLine];
      const problem = this.hostProblems[comment.startLine];
      const attached = unitId !== undefined && siteId !== undefined;
      const host: IEvidenceHost = {
        id: `markdown:${this.source.id}:comment:${comment.start}`,
        file: this.source.physicalPath,
        range: this.text.range(comment.start, comment.end),
        origins,
        unitIds: attached ? [unitId] : [],
        attachment: attached ? "attached" : "unsupported",
        ...(attached ? { siteId } : {}),
        ...(!attached && problem !== undefined ? { problem } : {}),
      };
      this.inventory.hosts.push(host);
      const documentation = EvidenceDocumentation.read(
        this.source.content,
        host.id,
        host.range,
        {
          opening: "<!--",
          closing: "-->",
          tagBoundaries: false,
          allowWithdrawal: false,
        },
      );
      const parsed = EvidenceTagParser.parse(
        this.source.content,
        host,
        documentation,
      );
      this.inventory.declarations.push(...parsed.declarations);
      this.inventory.reviews.push(...parsed.reviews);
      this.inventory.diagnostics.push(...parsed.diagnostics);
    }
  }

  private reportRenderedAnnotations(): void {
    for (let index = 0; index < this.lineStarts.length; ++index) {
      const line = this.line(index);
      if (
        this.fenced[index] === true ||
        this.rendered[index] === true ||
        this.commentOnly[index] === true ||
        MarkdownSyntax.indentedCode(line)
      )
        continue;
      const marker = MarkdownSyntax.annotation(line);
      if (marker === undefined) continue;
      const at = line.indexOf(marker);
      const start = (this.lineStarts[index] ?? 0) + Math.max(0, at);
      this.inventory.diagnostics.push({
        code: "unsupported-annotation-host",
        severity: "error",
        message: `${marker} is rendered as Markdown prose, so it is not an Evidence annotation.`,
        repair: `Wrap it in an HTML comment such as '<!-- ${marker} <target> ${marker.endsWith("Review") ? "<what you checked>" : "<reason>"} -->'.`,
        location: {
          file: this.source.physicalPath,
          range: this.text.range(start, this.lineEnds[index] ?? start),
        },
      });
    }
  }

  private parent(
    structural: Array<string | undefined>,
    level: number,
    fileId: string | undefined,
  ): string | undefined {
    for (let ancestor = Math.min(level - 1, 4); ancestor >= 1; --ancestor) {
      const id = structural[ancestor];
      if (id !== undefined) return id;
    }
    return fileId;
  }

  private line(index: number): string {
    return this.source.content.slice(
      this.lineStarts[index] ?? 0,
      this.lineEnds[index] ?? this.source.content.length,
    );
  }

  private lineAt(offset: number): number {
    let left = 0;
    let right = this.lineStarts.length;
    while (left + 1 < right) {
      const middle = Math.floor((left + right) / 2);
      if ((this.lineStarts[middle] ?? 0) <= offset) left = middle;
      else right = middle;
    }
    return left;
  }
}
