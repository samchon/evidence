/**
 * Bounded UTF-8 response read from one configured Swagger URL.
 *
 * Remote loading owns the bytes and their digest together so later parsing and
 * caching describe the exact response that passed the size limit.
 */
export interface IEvidenceRemoteSwaggerSource {
  /**
   * Decoded response content.
   *
   * The reader accepts only valid UTF-8, so loaders may parse this text without
   * applying a replacement-character normalization.
   */
  content: string;

  /**
   * SHA-256 identity of the received bytes.
   *
   * This remains byte-based because semantically equal decoded strings can have
   * arrived from different invalid or normalized encodings.
   */
  digest: string;
}
