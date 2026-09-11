import { EvidenceTargetBody } from "./internal/EvidenceTargetBody";
import type { IPendingEvidenceTag } from "./internal/IPendingEvidenceTag";
import { SourceText } from "./internal/SourceText";
import type { IEvidenceDocumentation } from "./structures/IEvidenceDocumentation";
import type { IEvidenceHost } from "./structures/IEvidenceHost";
import type { IEvidenceSourceLocation } from "./structures/IEvidenceSourceLocation";
import type { IEvidenceTagParseResult } from "./structures/IEvidenceTagParseResult";

/** Reads line-start annotations only from adapter-provided documentation, never from raw source scans. */
export namespace EvidenceTagParser {
  export function parse(
    content: string,
    host: IEvidenceHost,
    documentation: IEvidenceDocumentation,
  ): IEvidenceTagParseResult {
    const result: IEvidenceTagParseResult = {
      declarations: [],
      reviews: [],
      withdrawals: [],
      diagnostics: [],
    };
    const source = new SourceText(content);
    if (
      documentation.hostId !== host.id ||
      documentation.offsets.length !== documentation.text.length + 1 ||
      documentation.ends.length !== documentation.text.length ||
      !source.contains(host.range)
    )
      throw new Error(
        "The documentation map does not belong to its host or text.",
      );
    let previous = host.range.start.offset;
    for (const [index, offset] of documentation.offsets.entries()) {
      if (offset < previous || offset > host.range.end.offset)
        throw new Error("The documentation map escapes its source host.");
      source.position(offset);
      const end = documentation.ends[index] ?? offset;
      if (end < offset || end > host.range.end.offset)
        throw new Error("The documentation character escapes its source host.");
      source.position(end);
      previous = end;
    }
    let pending: IPendingEvidenceTag | undefined;
    let fence = "";
    let fenceLength = 0;

    function location(start: number, end: number): IEvidenceSourceLocation {
      const from = documentation.offsets[start];
      const until = end === start ? from : documentation.ends[end - 1];
      if (from === undefined || until === undefined)
        throw new Error("Missing documentation source boundary.");
      return { file: host.file, range: source.range(from, until) };
    }

    function problem(
      code: string,
      message: string,
      repair: string,
      where: IEvidenceSourceLocation,
    ): void {
      result.diagnostics.push({
        code,
        severity: "error",
        message,
        repair,
        location: where,
        hostId: host.id,
      });
    }

    function flush(): void {
      if (pending === undefined) return;
      const tag = pending;
      pending = undefined;
      const where = location(tag.start, tag.end);
      if (host.attachment !== "attached") {
        problem(
          "unsupported-annotation-host",
          "The annotation has no eligible declaration host.",
          host.problem ??
            "Attach the citation to documentation owned by the declaration that supplies the evidence, or remove it if stale.",
          where,
        );
        return;
      }
      if (/^\s*\{@link(?:code|plain)?\b/u.test(tag.body)) {
        problem(
          "unsupported-inline-link",
          "Compiler import-scoped inline links are unavailable in standalone Evidence.",
          "Use an explicit target such as @evidence ../calculator.ts#add Implements the arithmetic contract.",
          where,
        );
        return;
      }
      const body = EvidenceTargetBody.split(tag.body);
      try {
        EvidenceTargetBody.check(body.target, tag.kind === "link");
      } catch (cause) {
        problem(
          "malformed-target",
          "The annotation has a malformed target.",
          cause instanceof Error
            ? cause.message
            : "Use a valid artifact target or file-qualified accessor.",
          where,
        );
        return;
      }
      const id = JSON.stringify([
        host.id,
        documentation.offsets[tag.start],
        tag.kind,
      ]);
      if (
        tag.kind === "evidenceReview" ||
        tag.kind === "evidenceExcludeReview"
      ) {
        let description = body.remainder;
        let fingerprint: string | undefined;
        if (description.startsWith("#")) {
          const token = description.split(/\s/u)[0] ?? "";
          const prose = description.slice(token.length).trim();
          if (/^#[0-9a-f]{7}$/.test(token)) {
            fingerprint = token.slice(1);
            description = prose;
          } else if (prose === "") {
            problem(
              "malformed-fingerprint",
              "The review contains only an invalid fingerprint-like token.",
              "Write a seven-character lowercase hexadecimal fingerprint after '#', followed by a description of the review.",
              where,
            );
            return;
          }
        }
        if (description === "") {
          problem(
            "missing-review-description",
            "The review does not explain what was checked.",
            "Describe the verification after the target and optional fingerprint.",
            where,
          );
          return;
        }
        result.reviews.push({
          id,
          hostId: host.id,
          reviews:
            tag.kind === "evidenceReview" ? "evidence" : "evidenceExclude",
          target: body.target,
          description,
          location: where,
          ...(fingerprint === undefined ? {} : { fingerprint }),
        });
      } else if (body.remainder === "")
        problem(
          "missing-evidence-reason",
          "The acknowledgement does not state a reason.",
          "Explain how the host supplies the cited evidence or why the target does not apply.",
          where,
        );
      else
        result.declarations.push({
          id,
          hostId: host.id,
          kind: tag.kind === "evidenceExclude" ? "evidenceExclude" : "evidence",
          target: body.target,
          reason: body.remainder,
          location: where,
        });
    }

    let cursor = 0;
    for (const rawLine of documentation.text.split("\n")) {
      const line = rawLine.trim();
      const start = cursor + rawLine.indexOf(line);
      const end = start + line.length;
      cursor += rawLine.length + 1;
      const delimiter = /^(`{3,}|~{3,})(.*)$/.exec(line);
      if (delimiter !== null) {
        const marker = delimiter[1] ?? "";
        if (fence === "") {
          fence = marker[0] ?? "";
          fenceLength = marker.length;
        } else if (
          marker[0] === fence &&
          marker.length >= fenceLength &&
          (delimiter[2] ?? "").trim() === ""
        )
          fence = "";
        if (pending !== undefined) {
          pending.body += "\n" + line;
          pending.end = end;
        }
        continue;
      }
      if (fence !== "") {
        if (pending !== undefined) {
          pending.body += "\n" + line;
          pending.end = end;
        }
        continue;
      }
      const marker =
        /^@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)(?:[ \t]|$)/.exec(
          line,
        );
      if (marker !== null) {
        flush();
        const kind = marker[1];
        if (
          kind === "evidenceExcludeReview" ||
          kind === "evidenceReview" ||
          kind === "evidenceExclude" ||
          kind === "evidence" ||
          kind === "link"
        )
          pending = {
            kind,
            body: line.slice(marker[0].length).trim(),
            start,
            end,
          };
        continue;
      }
      const hidden = /^@(internal|hidden|ignore)(?:[ \t]|$)/.exec(line);
      if (hidden !== null && documentation.allowWithdrawal) {
        flush();
        const tag = hidden[1];
        if (
          host.attachment === "attached" &&
          (tag === "internal" || tag === "hidden" || tag === "ignore")
        )
          result.withdrawals.push({ tag, location: location(start, end) });
        continue;
      }
      if (
        line.startsWith("@") &&
        (documentation.tagBoundaries ||
          pending?.kind === "evidenceReview" ||
          pending?.kind === "evidenceExcludeReview")
      ) {
        flush();
        continue;
      }
      if (pending !== undefined) {
        pending.body += "\n" + line;
        pending.end = end;
      }
    }
    flush();
    return result;
  }
}
