import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { EvidenceTagParser } from "../../parsers/EvidenceTagParser";
import type { IEvidenceHost } from "../../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { IMarkdownComment } from "./IMarkdownComment";
import type { IMarkdownFence } from "./IMarkdownFence";
import type { IMarkdownHeading } from "./IMarkdownHeading";
import { MarkdownSyntax } from "./MarkdownSyntax";
import { SourceText } from "../../internal/SourceText";

/**
 * Materializes one Markdown source as a file unit and its heading units.
 *
 * The scanner also maps HTML-comment annotations while excluding rendered and
 * example content that must remain ordinary Markdown text.
 */
export class MarkdownScanner {
  /**
   * Maps UTF-16 offsets in the original source content to Evidence ranges.
   *
   * All sites, content ranges, and diagnostics use this source-preserving mapper.
   */
  private readonly text: SourceText;

  /**
   * Start offset of each physical source line.
   *
   * The first line always begins at zero; parallel line-state arrays use the
   * same index so classification never depends on normalized line endings.
   */
  private readonly lineStarts = [0];

  /**
   * End offset of each physical source line, excluding its line terminator.
   *
   * Content extraction uses these offsets while ranges retain the original
   * source positions recorded in {@link lineStarts}.
   */
  private readonly lineEnds: number[] = [];

  /**
   * Marks lines owned by a CommonMark fenced-code region.
   *
   * Fenced lines cannot create headings or active annotation hosts.
   */
  private readonly fenced: boolean[] = [];

  /**
   * Marks lines owned by a rendered-code region such as HTML `pre`.
   *
   * These regions remain part of Markdown content but are structurally inert to
   * the Evidence scanner.
   */
  private readonly rendered: boolean[] = [];

  /**
   * Marks lines whose semantic text consists entirely of HTML comments.
   *
   * Closed comment ranges are refined after discovery so prose beside a comment
   * remains fingerprinted and eligible for Markdown structure.
   */
  private readonly commentOnly: boolean[] = [];

  /**
   * Closed HTML-comment carriers discovered outside example regions.
   *
   * Each record preserves exact source offsets for tag mapping and for removing
   * annotations from semantic fingerprints.
   */
  private readonly comments: IMarkdownComment[] = [];

  /**
   * Column-preserving HTML-comment spans grouped by physical source line.
   *
   * Structural Markdown parsing replaces these spans with spaces so invisible
   * comment text cannot alter heading names, anchors, or rendered-prose checks.
   */
  private readonly commentMasks: Array<Array<readonly [number, number]>> = [];

  /**
   * Semantic fingerprint owner selected for each source line.
   *
   * Heading depth transitions update this array before content ranges are
   * assigned to the owning file or heading unit.
   */
  private readonly owners: Array<string | undefined> = [];

  /**
   * Annotation host unit selected for each source line.
   *
   * Unsupported headings clear this value so nearby comments cannot attach to a
   * targetable ancestor by accident.
   */
  private readonly hostUnits: Array<string | undefined> = [];

  /**
   * Physical site paired with each selected annotation host.
   *
   * Host construction needs both semantic unit ownership and the exact site that
   * contains the comment.
   */
  private readonly hostSites: Array<string | undefined> = [];

  /**
   * Repair explanation for lines that have no valid annotation host.
   *
   * Comment materialization uses this parallel state to emit the structural
   * failure at the comment location.
   */
  private readonly hostProblems: Array<string | undefined> = [];

  /**
   * Materialized sites indexed by their stable site identity.
   *
   * Later range-closing and fingerprint-content phases mutate the same records
   * already published through the destination inventory.
   */
  private readonly sites = new Map<string, IEvidenceUnitSite>();

  /**
   * Primary site identity for each Markdown unit.
   *
   * A Markdown file or heading currently has one site, and content assignment
   * resolves that site without rescanning the inventory.
   */
  private readonly unitSites = new Map<string, string>();

  /**
   * Binds the destination inventory and one physical Markdown source.
   *
   * Scan mutates only the supplied inventory with units, hosts, and diagnostics
   * from this source.
   */
  public constructor(
    private readonly inventory: IEvidenceInventory,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
  }

  /**
   * Scans Markdown structure, materializes units, and parses attached annotations.
   *
   * The phases run in source order because unit and host ownership depend on
   * line classification.
   */
  public scan(): void {
    this.splitLines();
    this.markExamples();
    this.materializeUnits();
    this.assignContent();
    this.materializeComments();
    this.reportRenderedAnnotations();
  }

  /**
   * Indexes physical source lines and initializes their classification state.
   *
   * Carriage returns are excluded from line content while offsets remain tied to
   * the original source.
   */
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
      this.commentMasks.push([]);
    }
  }

  /**
   * Marks examples and records real HTML comments before heading parsing.
   *
   * Comment, HTML `pre`, and MDX transitions share one ordered line scan so a
   * close followed by another opener cannot expose later example content.
   */
  private markExamples(): void {
    let fenceMarker: "`" | "~" | undefined;
    let fenceLength = 0;
    let rendered: "pre" | "template" | undefined;
    let commentStart: number | undefined;
    let commentStartLine: number | undefined;
    for (let index = 0; index < this.lineStarts.length; ++index) {
      const line: string = this.line(index);
      if (fenceMarker !== undefined) {
        this.fenced[index] = true;
        const delimiter: IMarkdownFence | undefined =
          MarkdownSyntax.fence(line);
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
      if (rendered === undefined && commentStart === undefined) {
        const delimiter: IMarkdownFence | undefined =
          MarkdownSyntax.fence(line);
        if (delimiter !== undefined) {
          this.fenced[index] = true;
          fenceMarker = delimiter.marker;
          fenceLength = delimiter.length;
          continue;
        }
        if (MarkdownSyntax.indentedCode(line)) continue;
      }
      let outside: string = "";
      let cursor: number = 0;
      let commentColumn: number | undefined =
        commentStart === undefined ? undefined : 0;
      if (commentStart !== undefined) this.commentOnly[index] = true;
      while (cursor < line.length) {
        if (commentStart !== undefined) {
          this.commentOnly[index] = true;
          const closing: number = line.indexOf("-->", cursor);
          if (closing < 0) break;
          const end: number = closing + 3;
          const masks: Array<readonly [number, number]> | undefined =
            this.commentMasks[index];
          if (masks !== undefined) masks.push([commentColumn ?? 0, end]);
          this.comments.push({
            start: commentStart,
            end: (this.lineStarts[index] ?? 0) + end,
            startLine: commentStartLine ?? index,
            endLine: index,
          });
          commentStart = undefined;
          commentStartLine = undefined;
          commentColumn = undefined;
          cursor = end;
          continue;
        }
        if (rendered !== undefined) {
          this.rendered[index] = true;
          const closing: number = this.renderedClosing(line, cursor, rendered);
          if (closing < 0) break;
          cursor = closing;
          rendered = undefined;
          continue;
        }

        const markup:
          | readonly [
              number,
              number,
              "comment" | "pre-open" | "pre-close" | "other",
            ]
          | undefined = this.markup(line, cursor);
        const templateOpen: number = line.indexOf("={`", cursor);
        const templateClose: number = line.indexOf("`}", cursor);
        const template:
          | readonly [number, number, "template-open" | "template-close"]
          | undefined =
          templateOpen >= 0 &&
          (templateClose < 0 || templateOpen <= templateClose)
            ? [templateOpen, templateOpen + 3, "template-open"]
            : templateClose >= 0
              ? [templateClose, templateClose + 2, "template-close"]
              : undefined;
        const token:
          | readonly [
              number,
              number,
              (
                | "comment"
                | "pre-open"
                | "pre-close"
                | "other"
                | "template-open"
                | "template-close"
              ),
            ]
          | undefined =
          markup === undefined
            ? template
            : template === undefined || markup[0] <= template[0]
              ? markup
              : template;
        if (token === undefined) {
          outside += line.slice(cursor);
          break;
        }
        const [start, end, kind]: readonly [
          number,
          number,
          (
            | "comment"
            | "pre-open"
            | "pre-close"
            | "other"
            | "template-open"
            | "template-close"
          ),
        ] = token;
        outside += line.slice(cursor, start);
        if (
          kind === "other" ||
          MarkdownSyntax.inlineCode(line, start) ||
          MarkdownSyntax.escaped(line, start)
        ) {
          outside += line.slice(start, end);
          cursor = end;
          continue;
        }
        if (kind === "comment") {
          if (outside.trim() === "") this.commentOnly[index] = true;
          commentStart = (this.lineStarts[index] ?? 0) + start;
          commentStartLine = index;
          commentColumn = start;
          cursor = end;
          continue;
        }
        if (kind === "pre-close" || kind === "template-close") {
          outside += line.slice(start, end);
          cursor = end;
          continue;
        }
        if (kind === "pre-open" && outside.trim() !== "") {
          outside += line.slice(start, end);
          cursor = end;
          continue;
        }
        this.rendered[index] = true;
        rendered = kind === "pre-open" ? "pre" : "template";
        cursor = end;
      }
      if (commentStart !== undefined && commentColumn !== undefined) {
        const masks: Array<readonly [number, number]> | undefined =
          this.commentMasks[index];
        if (masks !== undefined) masks.push([commentColumn, line.length]);
      }
    }
    this.refineCommentLines();
  }

  /**
   * Finds the next quote-aware HTML token on one physical line.
   *
   * Generic tags are returned as one span so comment and `pre` text inside quoted
   * attributes cannot become Markdown boundaries. An incomplete line-start `pre`
   * tag remains an opening token under the adapter's CommonMark boundary.
   */
  private markup(
    line: string,
    cursor: number,
  ):
    | readonly [number, number, "comment" | "pre-open" | "pre-close" | "other"]
    | undefined {
    for (let start: number = line.indexOf("<", cursor); start >= 0;) {
      if (line.startsWith("<!--", start)) return [start, start + 4, "comment"];
      let nameStart: number = start + 1;
      const closing: boolean = line[nameStart] === "/";
      if (closing) ++nameStart;
      if (!/[A-Za-z]/u.test(line[nameStart] ?? "")) {
        start = line.indexOf("<", start + 1);
        continue;
      }
      let nameEnd: number = nameStart + 1;
      while (/[A-Za-z0-9:-]/u.test(line[nameEnd] ?? "")) ++nameEnd;
      const name: string = line.slice(nameStart, nameEnd).toLowerCase();
      let quote: '"' | "'" | undefined;
      let end: number = nameEnd;
      let complete: boolean = false;
      for (; end < line.length; ++end) {
        const character: string | undefined = line[end];
        if (quote !== undefined) {
          if (character === quote) quote = undefined;
        } else if (character === '"' || character === "'") quote = character;
        else if (character === ">") {
          ++end;
          complete = true;
          break;
        }
      }
      const boundary: string | undefined = line[nameEnd];
      const pre: boolean =
        name === "pre" &&
        (boundary === undefined ||
          boundary === ">" ||
          boundary === "/" ||
          boundary === " " ||
          boundary === "\t");
      if (pre && !closing) return [start, end, "pre-open"];
      if (pre && closing && line.slice(start, end).toLowerCase() === "</pre>")
        return [start, end, "pre-close"];
      return [start, complete ? end : nameEnd, "other"];
    }
    return undefined;
  }

  /**
   * Locates the close belonging to the active rendered-region grammar.
   *
   * HTML and MDX terminators are not interchangeable. The returned offset points
   * after the matching delimiter so the caller can continue scanning the suffix
   * for another ordered region transition.
   */
  private renderedClosing(
    line: string,
    cursor: number,
    rendered: "pre" | "template",
  ): number {
    if (rendered === "template") {
      const closing: number = line.indexOf("`}", cursor);
      return closing < 0 ? -1 : closing + 2;
    }
    const relative: number = line.slice(cursor).search(/<\/pre>/iu);
    return relative < 0 ? -1 : cursor + relative + 6;
  }

  /**
   * Returns one physical line with only real HTML-comment spans removed.
   *
   * Heading syntax is established from the authored line first. This second
   * view supplies its visible title and anchor without collapsing whitespace or
   * joining tokens that were not an ATX heading in the original source.
   */
  private visibleLine(index: number): string {
    const line: string = this.line(index);
    let cursor: number = 0;
    let previous: string | undefined;
    const output: string[] = [];
    const masks: Array<readonly [number, number]> =
      this.commentMasks[index] ?? [];
    for (const [start, end] of masks) {
      const prefix: string = line.slice(cursor, start);
      output.push(prefix);
      if (prefix !== "") previous = prefix.at(-1);
      cursor = end;
      if (previous === " " || previous === "\t")
        while (line[cursor] === " " || line[cursor] === "\t") ++cursor;
    }
    output.push(line.slice(cursor));
    return output.join("");
  }

  /**
   * Returns one physical line with comment spans replaced by equal-width spaces.
   *
   * Rendered-annotation diagnostics need comment text to stay inert while their
   * marker columns continue to map to the original source line.
   */
  private maskedLine(index: number): string {
    let output: string = this.line(index);
    const masks: Array<readonly [number, number]> =
      this.commentMasks[index] ?? [];
    for (const [start, end] of masks)
      output =
        output.slice(0, start) + " ".repeat(end - start) + output.slice(end);
    return output;
  }

  /**
   * Distinguishes full-comment lines from comments beside semantic prose.
   *
   * Example marking conservatively suppresses every line inside a comment so
   * headings cannot escape it. Once exact closed ranges are known, this pass
   * restores lines with non-whitespace prefix or suffix content. Fingerprinting
   * can then remove the comment range without losing its surrounding prose.
   */
  private refineCommentLines(): void {
    const ranges: Map<number, Array<readonly [number, number]>> = new Map();
    for (const comment of this.comments) {
      for (let line = comment.startLine; line <= comment.endLine; ++line) {
        const start: number = this.lineStarts[line] ?? 0;
        const end: number = this.lineEnds[line] ?? this.source.content.length;
        const entries: Array<readonly [number, number]> =
          ranges.get(line) ?? [];
        entries.push([
          Math.max(start, comment.start),
          Math.min(end, comment.end),
        ]);
        ranges.set(line, entries);
      }
    }
    for (const [line, entries] of ranges) {
      const start: number = this.lineStarts[line] ?? 0;
      const end: number = this.lineEnds[line] ?? this.source.content.length;
      let cursor: number = start;
      let semantic: boolean = false;
      for (const [opening, closing] of entries) {
        if (opening > cursor)
          semantic ||= this.source.content.slice(cursor, opening).trim() !== "";
        cursor = Math.max(cursor, closing);
      }
      if (cursor < end)
        semantic ||= this.source.content.slice(cursor, end).trim() !== "";
      this.commentOnly[line] = !semantic;
    }
  }

  /**
   * Materializes file and supported heading units for every targetable address.
   *
   * Heading ownership is maintained by structural depth so content and
   * annotations attach consistently.
   */
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
      const authored: IMarkdownHeading | undefined =
        this.fenced[index] === true ||
        this.rendered[index] === true ||
        this.commentOnly[index] === true
          ? undefined
          : MarkdownSyntax.heading(this.line(index));
      const heading: IMarkdownHeading | undefined =
        authored === undefined || (this.commentMasks[index]?.length ?? 0) === 0
          ? authored
          : MarkdownSyntax.heading(this.visibleLine(index));
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

  /**
   * Assigns non-comment source lines to their current semantic unit sites.
   *
   * Annotation-only lines do not contribute to fingerprints of their documentation host.
   */
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

  /**
   * Creates annotation hosts and parses each recognized HTML comment.
   *
   * Unsupported attachment positions remain hosts so diagnostics retain their original location.
   */
  private materializeComments(): void {
    const origins = this.source.addresses.map((address) => address.absolute);
    for (const comment of this.comments) {
      this.inventory.annotationRanges.push({
        file: this.source.physicalPath,
        range: this.text.range(comment.start, comment.end),
      });
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

  /**
   * Diagnoses annotation markers rendered as ordinary Markdown prose.
   *
   * A visible marker is not an Evidence annotation until wrapped in an HTML comment.
   */
  private reportRenderedAnnotations(): void {
    for (let index = 0; index < this.lineStarts.length; ++index) {
      const line: string = this.maskedLine(index);
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

  /**
   * Finds the nearest structural heading ancestor for a newly materialized unit.
   *
   * The file unit is the fallback owner when no prior heading level remains open.
   */
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

  /**
   * Returns one indexed line without its line-ending characters.
   *
   * Classification helpers use this normalized view while source ranges retain original offsets.
   */
  private line(index: number): string {
    return this.source.content.slice(
      this.lineStarts[index] ?? 0,
      this.lineEnds[index] ?? this.source.content.length,
    );
  }
}
