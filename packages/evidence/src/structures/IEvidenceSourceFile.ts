import type { IEvidenceSourceAddress } from "./IEvidenceSourceAddress";
import type { IEvidenceSourceFingerprintRoot } from "./IEvidenceSourceFingerprintRoot";

/**
 * Captured UTF-8 file content with every selected logical address preserved.
 *
 * Discovery deduplicates filesystem identity while retaining aliases, so linked
 * paths do not create duplicate source populations or disappear from citation
 * lookup. Hard links can share an ID even when their canonical paths differ.
 * Adapters read `content` rather than reopening those paths after discovery.
 *
 * The source digest covers original bytes for change detection. Review
 * fingerprints instead describe semantic units and exclude accepted annotation
 * ranges; substituting a whole-file digest would give them the wrong boundary.
 */
export interface IEvidenceSourceFile {
  /**
   * Filesystem identity used to deduplicate the captured source.
   *
   * Discovery uses device/inode identity where available and falls back to realpath.
   * Logical aliases and hard links can therefore share this ID without losing paths.
   */
  id: string;

  /**
   * Canonical path used to read this file's bytes.
   *
   * This path anchors physical declaration sites. Hard-linked paths may share the
   * same source ID, while logical citation paths remain in `addresses`.
   */
  physicalPath: string;

  /**
   * Checkout-stable declaring path used by semantic review fingerprints.
   *
   * Filesystem discovery selects a deterministic logical address relative to the
   * configuration directory. It stays independent of device/inode identity and
   * canonical link targets while still distinguishing separate declaring files.
   */
  fingerprintPath: string;

  /**
   * Portable mapping for an adapter-owned physical population root.
   *
   * Filesystem snapshots provide this when the configured root was resolved.
   * Remote and caller-authored snapshots may omit it when their unit IDs do not
   * contain a physical root or when file-derived normalization is sufficient.
   */
  fingerprintRoot?: IEvidenceSourceFingerprintRoot;

  /**
   * Decoded source text with its original line endings and byte-order mark.
   *
   * Declaration ranges and documentation mappings refer to this exact string.
   * Normalize only where a later semantic digest requires it, not before extraction.
   */
  content: string;

  /**
   * SHA-256 of the original file bytes for cache invalidation.
   *
   * This detects source changes, including edits irrelevant to one unit's semantic
   * fingerprint. Review tokens are constructed separately from unit content.
   */
  digest: string;

  /**
   * Logical addresses retained in deterministic path order.
   *
   * Physical deduplication must preserve each selected alias for target lookup.
   * Address metadata distinguishes selection spelling from the canonical read path.
   */
  addresses: IEvidenceSourceAddress[];
}
