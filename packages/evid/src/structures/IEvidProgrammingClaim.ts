import type { EvidProgrammingSymbol } from "../typings/EvidProgrammingSymbol";
import type { EvidProgrammingType } from "../typings/EvidProgrammingType";
import type { IEvidClaimBase } from "./IEvidClaimBase";

/**
 * Public programming declarations that cite evidence in documentation comments.
 *
 * The language adapter extracts declaration identity and documentation
 * ownership before the configured symbol selector chooses claim hosts. This
 * lets one policy require evidence from public functions while still
 * recognizing an exclusion authored on another eligible declaration in the
 * selected files.
 *
 * - Evid needs a target, a nonempty reason, and a selected declaration host.
 * - Exclusions may use any supported public declaration in a selected file,
 *   regardless of the claim's symbol selector.
 * - Unsupported or unexported declarations host neither form. A TypeScript
 *   variable statement containing callable and data declarations can host both
 *   function and property evidence.
 *
 * @example
 *   const claim: IEvidProgrammingClaim = {
 *     type: "typescript",
 *     files: ["src/*.ts"],
 *     symbol: "function",
 *     reference: { type: "markdown", files: ["requirements.md"] },
 *   };
 */
export interface IEvidProgrammingClaim extends IEvidClaimBase<
  EvidProgrammingType,
  EvidProgrammingSymbol
> {}
