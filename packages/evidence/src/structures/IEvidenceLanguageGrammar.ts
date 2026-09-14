/**
 * Logical filename rules selecting one pinned grammar variant.
 *
 * Selection first respects the configured artifact family, then matches exact
 * filename or extension spellings within that family. This supports variants such
 * as TSX and named Ruby files without treating ambiguous extensions as languages.
 */
export interface IEvidenceLanguageGrammar {
  /**
   * Key of the pinned grammar provenance entry.
   *
   * Parser acquisition uses this key after filename selection chooses the variant.
   */
  id: string;

  /**
   * Accepted case-sensitive suffixes, including their leading dots.
   *
   * The logical selected filename determines the match even when a link points
   * to a physical file with another spelling.
   */
  extensions: string[];

  /**
   * Accepted exact basenames that need no conventional extension.
   *
   * Named files such as Gemfile retain case-sensitive matching; an empty list
   * means this variant relies on its extension rules.
   */
  filenames: string[];
}
