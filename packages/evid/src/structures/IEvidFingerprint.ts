/**
 * Versioned content identity of a cited declaration and its structural subtree.
 *
 * Fingerprinting derives each unit's own content from an adapter digest or its
 * source ranges, excludes accepted annotation spans, then combines explicit
 * descendants. A review token belongs to the cited scope, independently of a
 * reference's symbol selector or the public alias used to reach it.
 *
 * Own content and subtree content remain separate so callers can distinguish a
 * declaration edit from changes below it. Neither digest is a whole-file cache
 * key: evidence prose can change without expiring its own recorded review.
 */
export interface IEvidFingerprint {
  /**
   * Version of the fingerprint construction algorithm.
   *
   * This identifies normalization and scope semantics for the token,
   * independently of the inventory schema version or parser grammar revision.
   */
  version: number;

  /**
   * Semantic identity at the root of the cited scope.
   *
   * Aliases resolve to this same unit before fingerprinting. Reference
   * selectors do not change which identity owns the token.
   */
  unitId: string;

  /**
   * Digest of the root unit's own normalized content.
   *
   * Structural descendants are combined separately in `scopeDigest`. Accepted
   * annotation spans are excluded from source-derived content.
   */
  contentDigest: string;

  /**
   * Digest combining the root unit with its complete structural subtree.
   *
   * The scope follows explicit ownership and does not shrink to a reference's
   * selected kinds. A descendant edit can therefore expire an aggregate
   * review.
   */
  scopeDigest: string;

  /**
   * Review token representing this versioned content scope.
   *
   * Authors record the current token in review annotations. Graph evaluation
   * compares it with the recomputed token when review freshness is required.
   */
  fingerprint: string;
}
