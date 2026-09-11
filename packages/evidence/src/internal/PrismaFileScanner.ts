import { SourceText } from "./SourceText";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IPrismaCommentRun } from "./IPrismaCommentRun";
import type { IPrismaBlockHead } from "./IPrismaBlockHead";
import type { IPrismaFileAnalysis } from "./IPrismaFileAnalysis";
import type { IPrismaLineParts } from "./IPrismaLineParts";
import type { IPrismaLocation } from "./IPrismaLocation";
import type { IPrismaPendingComment } from "./IPrismaPendingComment";
import type { ITrimmedMapping } from "./ITrimmedMapping";
import type { PrismaCommentForm } from "./PrismaCommentForm";
import { PrismaSyntax } from "./PrismaSyntax";

const BLOCK_KEYWORDS = new Set([
  "model",
  "view",
  "type",
  "enum",
  "datasource",
  "generator",
]);
const MEMBER_BLOCKS = new Set(["model", "view", "type"]);

/** Locates Prisma declarations without deciding which declarations exist. */
export class PrismaFileScanner {
  private readonly lines: string[];
  private readonly lineStarts: number[] = [];
  private readonly lineEnds: number[] = [];
  private readonly newlineOffsets: number[] = [];
  private readonly text: SourceText;

  public constructor(private readonly source: IEvidenceSourceFile) {
    this.text = new SourceText(source.content);
    this.lines = source.content.split("\n");
    let offset = 0;
    for (const raw of this.lines) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      this.lineStarts.push(offset);
      this.lineEnds.push(offset + line.length);
      this.newlineOffsets.push(offset + raw.length);
      offset += raw.length + 1;
    }
  }

  public scan(): IPrismaFileAnalysis {
    const locations = new Map<string, IPrismaLocation>();
    const comments: IPrismaCommentRun[] = [];
    let pending: IPrismaPendingComment[] = [];
    let depth = 0;
    let block = "";
    let addressable = false;
    let commented = false;

    const flush = (key: string): void => {
      comments.push(...this.runs(pending, key));
      pending = [];
    };
    const record = (key: string, line: number): void => {
      if (key === "" || locations.has(key)) return;
      locations.set(key, {
        key,
        range: this.text.range(
          this.lineStarts[line] ?? 0,
          this.lineEnds[line] ?? this.source.content.length,
        ),
      });
    };

    for (let index = 0; index < this.lines.length; ++index) {
      const parts = this.parts(index, commented);
      commented = parts.commented;
      const trimmed = parts.code.trim();
      if (parts.comment !== undefined) {
        parts.comment.topLevel = depth === 0;
        parts.comment.trailing = trimmed !== "";
        pending.push(parts.comment);
      }
      if (trimmed === "") {
        if (parts.comment === undefined && depth === 0) flush("");
        continue;
      }
      const opens = count(parts.code, "{");
      const closes = count(parts.code, "}");
      if (depth === 0 && opens !== 0) {
        const head = blockHead(trimmed);
        block = "";
        addressable = false;
        if (head === undefined) flush("");
        else {
          block = head.name;
          addressable = MEMBER_BLOCKS.has(head.keyword);
          if (addressable) record(head.name, index);
          flush(head.name);
        }
      } else if (depth === 1 && block !== "") {
        const member = memberName(trimmed);
        if (member === undefined) flush("");
        else {
          if (addressable) record(`${block}.${member}`, index);
          flush(`${block}.${member}`);
        }
      } else flush("");
      depth += opens - closes;
      if (depth <= 0) {
        depth = 0;
        block = "";
        addressable = false;
      }
    }
    flush("");
    return {
      source: this.source,
      locations: Array.from(locations.values()),
      comments,
    };
  }

  private parts(line: number, initiallyCommented: boolean): IPrismaLineParts {
    const raw = this.lines[line] ?? "";
    const content = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const start = this.lineStarts[line] ?? 0;
    let code = "";
    let form: PrismaCommentForm | undefined = initiallyCommented
      ? "block"
      : undefined;
    let commented = initiallyCommented;
    let quoted = false;
    let commentStart = -1;
    let commentEnd = -1;
    let comment = "";
    const offsets: number[] = [];
    const ends: number[] = [];

    for (let index = 0; index < content.length; ++index) {
      const character = content[index] ?? "";
      if (commented) {
        if (commentStart < 0) commentStart = index;
        if (character === "*" && content[index + 1] === "/") {
          commented = false;
          commentEnd = index + 2;
          ++index;
        } else {
          comment += character;
          offsets.push(start + index);
          ends.push(start + index + 1);
        }
        continue;
      }
      if (quoted) {
        if (character === "\\") ++index;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') {
        quoted = true;
        continue;
      }
      if (character === "/" && content[index + 1] === "/") {
        commentStart = commentStart < 0 ? index : commentStart;
        const documented = content[index + 2] === "/";
        form ??= documented ? "doc" : "line";
        index += documented ? 2 : 1;
        for (++index; index < content.length; ++index) {
          comment += content[index] ?? "";
          offsets.push(start + index);
          ends.push(start + index + 1);
        }
        commentEnd = content.length;
        break;
      }
      if (character === "/" && content[index + 1] === "*") {
        commentStart = commentStart < 0 ? index : commentStart;
        form ??= "block";
        commented = true;
        ++index;
        continue;
      }
      code += character;
    }
    if (form === undefined)
      return {
        code,
        commented,
      };
    if (commentEnd < 0) commentEnd = content.length;
    let trimmed = trimMapped(comment, offsets, ends);
    if (form === "block" && trimmed.text.startsWith("*"))
      trimmed = trimMapped(
        trimmed.text.slice(1),
        trimmed.offsets.slice(1),
        trimmed.ends.slice(1),
      );
    return {
      code,
      commented,
      comment: {
        form,
        line,
        text: trimmed.text,
        offsets: trimmed.offsets,
        ends: trimmed.ends,
        range: this.text.range(
          start + Math.max(0, commentStart),
          start + commentEnd,
        ),
        trailing: false,
        topLevel: false,
      },
    };
  }

  private runs(
    pending: IPrismaPendingComment[],
    key: string,
  ): IPrismaCommentRun[] {
    if (pending.length === 0) return [];
    const output: IPrismaCommentRun[] = [];
    const documenting = pending.filter(
      (comment) => comment.form !== "line" && !comment.trailing,
    );
    for (const comment of pending)
      if (comment.form === "line" || comment.trailing)
        output.push(this.run([comment], "", false, comment.form));
    if (documenting.length !== 0)
      output.push(
        this.run(
          documenting,
          key,
          key === "" &&
            documenting.every(
              (comment) => comment.topLevel && comment.form === "doc",
            ),
          "doc",
        ),
      );
    return output;
  }

  private run(
    comments: IPrismaPendingComment[],
    key: string,
    fileLevel: boolean,
    form: PrismaCommentForm,
  ): IPrismaCommentRun {
    const first = comments[0];
    const last = comments.at(-1);
    if (first === undefined || last === undefined)
      throw new Error("A Prisma comment run cannot be empty.");
    const byLine = new Map(comments.map((comment) => [comment.line, comment]));
    let text = "";
    const offsets: number[] = [];
    const ends: number[] = [];
    for (let line = first.line; line <= last.line; ++line) {
      const comment = byLine.get(line);
      if (comment !== undefined) {
        text += comment.text;
        offsets.push(...comment.offsets);
        ends.push(...comment.ends);
      }
      if (line !== last.line) {
        const newline = this.newlineOffsets[line] ?? this.source.content.length;
        text += "\n";
        offsets.push(newline);
        ends.push(Math.min(newline + 1, this.source.content.length));
      }
    }
    offsets.push(ends.at(-1) ?? last.range.end.offset);
    return {
      form,
      key,
      fileLevel,
      text,
      offsets,
      ends,
      range: this.text.range(first.range.start.offset, last.range.end.offset),
      commentRanges: comments.map((comment) => comment.range),
    };
  }
}

function blockHead(line: string): IPrismaBlockHead | undefined {
  const fields = line.split(/\s+/u);
  const keyword = fields[0];
  const second = fields[1];
  const name = second === undefined ? undefined : second.replace(/\{$/u, "");
  if (
    keyword === undefined ||
    name === undefined ||
    !BLOCK_KEYWORDS.has(keyword) ||
    !PrismaSyntax.identifier(name)
  )
    return undefined;
  return { keyword, name };
}

function memberName(line: string): string | undefined {
  if (line.startsWith("@") || line.startsWith("}")) return undefined;
  const name = line.split(/\s+/u)[0];
  return name !== undefined && PrismaSyntax.identifier(name) ? name : undefined;
}

function count(value: string, character: string): number {
  return Array.from(value).filter((candidate) => candidate === character)
    .length;
}

function trimMapped(
  text: string,
  offsets: number[],
  ends: number[],
): ITrimmedMapping {
  const start = text.search(/\S/u);
  if (start < 0) return { text: "", offsets: [], ends: [] };
  let end = text.length;
  while (end > start && /\s/u.test(text[end - 1] ?? "")) --end;
  return {
    text: text.slice(start, end),
    offsets: offsets.slice(start, end),
    ends: ends.slice(start, end),
  };
}
