import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceClaimBase } from "./IEvidenceClaimBase";

/**
 * Public programming declarations that cite evidence in documentation comments.
 *
 * The language adapter extracts declaration identity and documentation
 * ownership before the configured symbol selector chooses claim hosts. This
 * lets one policy require evidence from public functions while still
 * recognizing an exclusion authored on another eligible declaration in the
 * selected files.
 *
 * - Evidence needs a target, a nonempty reason, and a selected declaration host.
 * - Exclusions may use any supported public declaration in a selected file,
 *   regardless of the claim's symbol selector.
 * - Unsupported or unexported declarations host neither form. A TypeScript
 *   variable statement containing callable and data declarations can host both
 *   function and property evidence.
 *
 * @example
 *   const claim: IEvidenceProgrammingClaim = {
 *     type: "typescript",
 *     files: ["src/*.ts"],
 *     symbol: "function",
 *     reference: { type: "markdown", files: ["requirements.md"] },
 *   };
 */
export interface IEvidenceProgrammingClaim extends IEvidenceClaimBase<
  EvidenceProgrammingType,
  EvidenceProgrammingSymbol
> {}
