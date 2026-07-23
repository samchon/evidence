/**
 * Options for the project-scoped evidence index.
 *
 * The index is the identity source every reference resolves against. It must be
 * configured in an entry without `files`; an entry with `files` is rejected
 * even when it is empty or `off`.
 *
 * Turning it off is not a way to relax enforcement. It silences every other
 * evidence rule because, without an index, there is nothing to resolve against;
 * reporting anyway would blame authors for the rule's own blindness.
 */
export interface IEvidenceIndexOptions {
  /**
   * Project-relative globs of markdown to index. Defaults to `["**\/*.md"]`.
   *
   * Supports `**`, `*`, and `?`. Matching is case-sensitive even on a
   * case-insensitive filesystem, because a path has one true spelling and
   * admitting another yields references the index cannot resolve. A directory
   * entry includes everything below it, so `docs`, `docs/`, and `docs/**` all
   * include `docs/spec.md`.
   *
   * `node_modules`, `.git`, `lib`, `dist`, and `coverage` are never walked:
   * they hold other people's markdown, and a citation resolving against a
   * dependency's README proves nothing.
   */
  documents?: readonly string[];
}
