import type { EvidenceDatabaseSymbol } from "../typings/EvidenceDatabaseSymbol";
import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceClaimBase } from "./IEvidenceClaimBase";

/**
 * Database schema declarations that cite Evidence in documentation comments.
 *
 * The database adapter determines schema identity, structural relationships,
 * and eligible documentation carriers. Symbol selection then chooses which
 * models, columns, or relations owe Evidence; parsing failures retain an
 * incomplete population instead of removing requirements from the check.
 *
 * Prisma host rules:
 *
 * - Matching files form one schema regardless of extension. A physical file
 *   reached by multiple populations is parsed once.
 * - Triple-slash and block documentation comments attach to the next declaration.
 *   Ordinary double-slash comments do not host tags.
 * - A blank line before a top-level block detaches the comment. Comments above
 *   block attributes or closing braces also have no declaration host.
 * - evidence and exclusions require a target and nonempty reason. Invalid or detached
 *   declarations are reported.
 * - An unattached top-level triple-slash run may carry a file-level exclusion,
 *   independently of the symbol selector. It cannot carry ordinary Evidence.
 */
export interface IEvidenceDatabaseClaim extends IEvidenceClaimBase<
  EvidenceDatabaseType,
  EvidenceDatabaseSymbol
> {}
