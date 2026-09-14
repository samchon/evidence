import type { EvidenceSeverity } from "../typings/EvidenceSeverity";

import type { IEvidenceReference } from "./IEvidenceReference";

/** Common claim settings, parameterized by artifact type and symbol kind. */
export interface IEvidenceClaimBase<
  Type extends string,
  SymbolKind extends string,
> {
  /** Artifact type of the claim files. */
  type: Type;

  /** Optional label for diagnostics; it does not affect identity or coverage. */
  name?: string;

  /**
   * Overrides the root configuration severity. Omit or use `undefined` to inherit.
   * `"off"` disables this claim and its references.
   */
  severity?: EvidenceSeverity | undefined;

  /**
   * Skip this claim's populations, references, coverage obligations, and watched
   * inputs. Its configuration shape is still validated.
   *
   * @default false
   */
  disabled?: boolean;

  /**
   * Base directory for file globs.
   *
   * - Defaults to the directory containing evidence.config.ts; relative roots
   *   resolve from that directory.
   * - Accepts absolute paths, directory symlinks, and Windows junctions.
   * - Names one directory, not a glob. Windows drive-relative paths are invalid.
   */
  root?: string;

  /**
   * File globs relative to root.
   *
   * - Evaluate left to right: "!" removes matches; later positives may re-include.
   *   At least one positive pattern is required.
   * - "*" matches within one path segment, "**" crosses segments, and "?" matches
   *   one character. Both path separators are accepted; identity is case-sensitive.
   * - A bare directory does not include its children; use "src/**".
   * - Resolved patterns define watched inputs, including files outside the project.
   */
  files: string[];

  /**
   * Symbol kinds eligible to host evidence; accepts one kind or a nonempty array.
   * Omit to select every supported kind for the artifact:
   *
   * - Programming: the language's supported type, function, and property kinds.
   * - Database: model, column, relation.
   * - Markdown: file, h1, h2, h3, h4.
   * - Swagger: operation.
   *
   * This selects claim hosts; each reference selects the units they must cover.
   */
  symbol?: SymbolKind | SymbolKind[];

  /**
   * Globs restricting exclusion carriers within the claim's selected files.
   *
   * - Use the same root and glob rules as files; never widen that population.
   * - Omit to allow every eligible carrier. An exclusion outside these globs is
   *   reported and provides no coverage.
   * - Each reference may independently refuse all exclusions with noEvidenceExclude.
   * - A Markdown checklist permits these globs only with noEvidenceExclude.
   */
  evidenceExcludeCarriers?: string[];

  /**
   * One reference or a nonempty array, with any artifact family allowed for every
   * claim. Each reference requires complete coverage independently; coverage is
   * never pooled between references.
   */
  reference: IEvidenceReference | IEvidenceReference[];
}
