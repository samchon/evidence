import type { IEvidenceTagContext } from "../contexts/IEvidenceTagContext";
import { EvidenceTargetBody } from "../internal/EvidenceTargetBody";
import { EvidenceDocumentationExamples } from "../parsers/EvidenceDocumentationExamples";
import type { IEvidenceDocumentationFence } from "../parsers/IEvidenceDocumentationFence";
import type { IEvidenceSourceLocation } from "../structures/IEvidenceSourceLocation";
import type { IEvidenceTagParseResult } from "../structures/IEvidenceTagParseResult";

/**
 * Parses evidence annotations from documentation already mapped to a source host.
 *
 * Adapters own comment syntax and provide a normalized documentation map; this
 * namespace owns only evidence tag semantics. Its mutable context carries a pending
 * multiline tag, fenced-code state, and parse result so every emitted
 * annotation can retain coordinates in the original source file.
 *
 * @example
 *   const result = EvidenceTagProgrammer.parse(context);
 *   // result.declarations contains valid @Evidence and @link annotations.
 */
export namespace EvidenceTagProgrammer {
  /**
   * Parses valid evidence tags and diagnostics from one mapped documentation block.
   *
   * The function consumes no text outside {@link IEvidenceTagContext.documentation}.
   * It preserves multiline tag bodies, ignores apparent tags inside fenced code
   * or HTML comments, and flushes a pending annotation at every boundary that
   * makes continuation impossible. Invalid tags become diagnostics rather than
   * aborting sibling tags.
   */
  export function parse(context: IEvidenceTagContext): IEvidenceTagParseResult {
    validate(context);
    const characters: string[] = context.documentation.text.split("");
    EvidenceDocumentationExamples.maskHtmlComments(
      characters,
      context.documentation.text,
    );
    const input: string = characters.join("");
    const lines: string[] = input.split("\n");
    const documentBaseline: number = EvidenceDocumentationExamples.baseline(input);
    let cursor = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Coordinates must point at trimmed annotation text while cursor advances
      // across the untrimmed mapped documentation, including blank-line bytes.
      const start = cursor + rawLine.indexOf(line);
      const end = start + line.length;
      cursor += rawLine.length + 1;
      const delimiter: IEvidenceDocumentationFence | undefined =
        EvidenceDocumentationExamples.fence(rawLine, documentBaseline);
      if (delimiter !== undefined) {
        if (context.fence === "") {
          // An opening fence ends prose continuation before example text can
          // satisfy or alter an annotation's reason or review description.
          flush(context);
          context.fence = delimiter.marker;
          context.fenceLength = delimiter.length;
        } else if (
          // Closing fences must use the opening marker character and at least its
          // length; a shorter marker remains literal code inside the fenced block.
          delimiter.marker === context.fence &&
          delimiter.length >= context.fenceLength &&
          delimiter.remainder.trim() === ""
        )
          context.fence = "";
        continue;
      }
      if (context.fence !== "") continue;
      const marker =
        /^@(EvidenceExcludeReview|EvidenceReview|EvidenceExclude|Evidence|link)(?:[ \t]|$)/.exec(
          line,
        );
      if (marker !== null) {
        flush(context);
        const kind = marker[1];
        if (
          kind === "EvidenceExcludeReview" ||
          kind === "EvidenceReview" ||
          kind === "EvidenceExclude" ||
          kind === "Evidence" ||
          kind === "link"
        )
          context.pending = {
            kind,
            body: line.slice(marker[0].length).trim(),
            start,
            end,
          };
        continue;
      }
      const hidden = /^@(internal|hidden|ignore)(?:[ \t]|$)/.exec(line);
      if (hidden !== null && context.documentation.allowWithdrawal) {
        flush(context);
        const tag = hidden[1];
        if (
          context.host.attachment === "attached" &&
          (tag === "internal" || tag === "hidden" || tag === "ignore")
        )
          context.result.withdrawals.push({
            tag,
            location: location(context, start, end),
          });
        continue;
      }
      if (
        line.startsWith("@") &&
        (context.documentation.tagBoundaries ||
          context.pending?.kind === "EvidenceReview" ||
          context.pending?.kind === "EvidenceExcludeReview")
      ) {
        flush(context);
        continue;
      }
      if (context.pending !== undefined) {
        context.pending.body += "\n" + line;
        context.pending.end = end;
      }
    }
    flush(context);
    return context.result;
  }

  /**
   * Verifies that a documentation map belongs to its declared source host.
   *
   * Offset and end arrays must cover the normalized text exactly and remain
   * monotonic inside the host range. The source lookup also validates that
   * every retained boundary can be converted into a public line-and-column
   * location. Violations are adapter bugs, so this function throws instead of
   * producing a user-facing annotation diagnostic.
   */
  function validate(context: IEvidenceTagContext): void {
    if (
      context.documentation.hostId !== context.host.id ||
      context.documentation.offsets.length !==
        context.documentation.text.length + 1 ||
      context.documentation.ends.length !== context.documentation.text.length ||
      !context.source.contains(context.host.range)
    )
      throw new Error(
        "The documentation map does not belong to its host or text.",
      );
    let previous = context.host.range.start.offset;
    for (const [index, offset] of context.documentation.offsets.entries()) {
      if (offset < previous || offset > context.host.range.end.offset)
        throw new Error("The documentation map escapes its source host.");
      context.source.position(offset);
      const end = context.documentation.ends[index] ?? offset;
      if (end < offset || end > context.host.range.end.offset)
        throw new Error("The documentation character escapes its source host.");
      context.source.position(end);
      previous = end;
    }
  }

  /**
   * Converts a half-open documentation-text span to an original source
   * location.
   *
   * The documentation map can omit or transform syntax such as comment
   * prefixes, so source offsets cannot be derived from character counts. The
   * final character uses its mapped end boundary; an empty span uses its mapped
   * start boundary.
   */
  function location(
    context: IEvidenceTagContext,
    start: number,
    end: number,
  ): IEvidenceSourceLocation {
    const from = context.documentation.offsets[start];
    const until = end === start ? from : context.documentation.ends[end - 1];
    if (from === undefined || until === undefined)
      throw new Error("Missing documentation source boundary.");
    return {
      file: context.host.file,
      range: context.source.range(from, until),
    };
  }

  /**
   * Appends a source-located tag diagnostic for the current host.
   *
   * Centralizing this projection guarantees parser errors carry the same
   * severity and host identity as later graph diagnostics, while callers supply
   * the actionable repair text appropriate to the failed tag rule.
   */
  function problem(
    context: IEvidenceTagContext,
    code: string,
    message: string,
    repair: string,
    where: IEvidenceSourceLocation,
  ): void {
    context.result.diagnostics.push({
      code,
      severity: "error",
      message,
      repair,
      location: where,
      hostId: context.host.id,
    });
  }

  /**
   * Finalizes the pending tag, appending an annotation or an explanatory
   * diagnostic.
   *
   * Pending state is cleared before validation so a failing tag cannot be
   * emitted again at a later boundary. Attachment, inline-link, target,
   * review-fingerprint, and reason requirements are checked in that order
   * because each later rule assumes the preceding source and target
   * interpretation is valid.
   */
  function flush(context: IEvidenceTagContext): void {
    if (context.pending === undefined) return;
    const tag = context.pending;
    context.pending = undefined;
    const where = location(context, tag.start, tag.end);
    // Detached comments never provide Evidence, even if their tag syntax is valid.
    if (context.host.attachment !== "attached") {
      problem(
        context,
        "unsupported-annotation-host",
        "The annotation has no eligible declaration host.",
        context.host.problem ??
          "Attach the citation to documentation owned by the declaration that supplies the Evidence, or remove it if stale.",
        where,
      );
      return;
    }
    if (/^\s*\{@link(?:code|plain)?\b/u.test(tag.body)) {
      problem(
        context,
        "unsupported-inline-link",
        "Compiler import-scoped inline links are unavailable in standalone evidence.",
        "Use an explicit target such as @Evidence ../calculator.ts#add Implements the arithmetic contract.",
        where,
      );
      return;
    }
    const body = EvidenceTargetBody.split(tag.body);
    try {
      EvidenceTargetBody.check(body.target, tag.kind === "link");
    } catch (cause) {
      problem(
        context,
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
      context.host.id,
      context.documentation.offsets[tag.start],
      tag.kind,
    ]);
    if (tag.kind === "EvidenceReview" || tag.kind === "EvidenceExcludeReview") {
      let description = body.remainder;
      let fingerprint: string | undefined;
      if (description.startsWith("#")) {
        const token = description.split(/\s/u)[0] ?? "";
        const prose = description.slice(token.length).trim();
        // A fingerprint is only consumed when it has the precise short-hash form;
        // ordinary prose beginning with '#' remains part of the review description.
        if (/^#[0-9a-f]{7}$/.test(token)) {
          fingerprint = token.slice(1);
          description = prose;
        } else if (prose === "") {
          problem(
            context,
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
          context,
          "missing-review-description",
          "The review does not explain what was checked.",
          "Describe the verification after the target and optional fingerprint.",
          where,
        );
        return;
      }
      context.result.reviews.push({
        id,
        hostId: context.host.id,
        reviews: tag.kind === "EvidenceReview" ? "Evidence" : "EvidenceExclude",
        target: body.target,
        description,
        location: where,
        ...(fingerprint === undefined ? {} : { fingerprint }),
      });
    } else if (body.remainder === "")
      problem(
        context,
        "missing-Evidence-reason",
        "The acknowledgement does not state a reason.",
        "Explain how the host supplies the cited Evidence or why the target does not apply.",
        where,
      );
    else
      context.result.declarations.push({
        id,
        hostId: context.host.id,
        kind: tag.kind === "EvidenceExclude" ? "EvidenceExclude" : "Evidence",
        target: body.target,
        reason: body.remainder,
        location: where,
      });
  }
}
