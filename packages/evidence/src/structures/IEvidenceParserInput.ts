import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";

/**
 * Immutable source values supplied to a borrowed Tree-sitter parse session.
 *
 * The artifact type and logical filename select the syntax variant, while content
 * comes from the source snapshot rather than another filesystem read. Keeping
 * that boundary prevents parsing newer bytes than the inventory fingerprints.
 */
export interface IEvidenceParserInput {
  /**
   * Programming or database family whose grammar should parse the source.
   *
   * The language registry combines this family with the filename to select variants
   * such as TypeScript versus TSX.
   */
  type: EvidenceProgrammingType | EvidenceDatabaseType;

  /**
   * Logical source filename used for grammar selection and error attribution.
   *
   * A selected symlink can have a different extension from its physical target;
   * the selected spelling determines the syntax variant.
   */
  file: string;

  /**
   * Decoded snapshot text to parse without further file I/O.
   *
   * Session ranges address UTF-16 positions in this exact string.
   */
  content: string;
}
