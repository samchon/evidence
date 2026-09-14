import { EvidenceAccessor } from "../targets/EvidenceAccessor";
import type { IEvidenceTargetBody } from "./IEvidenceTargetBody";

/** Lexical target boundaries; artifact-specific path resolution happens after population selection. */
export namespace EvidenceTargetBody {
  export function split(value: string): IEvidenceTargetBody {
    const body = value.trim();
    let cursor = 0;
    let quoted = false;
    let escaped = false;
    while (cursor < body.length) {
      const character = body[cursor] ?? "";
      if (escaped) escaped = false;
      else if (quoted && character === "\\") escaped = true;
      else if (character === '"') quoted = !quoted;
      else if (!quoted && /\s/u.test(character)) break;
      ++cursor;
    }
    return {
      target: body.slice(0, cursor),
      remainder: body.slice(cursor).trim(),
    };
  }

  export function check(target: string, forcedFile: boolean): void {
    if (target === "")
      throw new Error("Name the target before explaining the acknowledgement.");
    if (!forcedFile) return;
    const hash = target.indexOf("#");
    if (hash < 0) {
      throw new Error(
        "Write a file path followed by '#' and a public accessor, such as ../calculator.ts#add.",
      );
    }
    const file = target.slice(0, hash);
    if (file === "") throw new Error("Name the file before '#'.");
    const decoded = decodeURIComponent(file);
    if (
      decoded.includes("\0") ||
      decoded.includes("\r") ||
      decoded.includes("\n")
    )
      throw new Error("Target paths cannot contain NUL or line breaks.");
    EvidenceAccessor.parse(target.slice(hash + 1));
  }
}
