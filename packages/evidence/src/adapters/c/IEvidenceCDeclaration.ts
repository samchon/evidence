import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { EvidenceCDeclarationForm } from "./EvidenceCDeclarationForm";
import type { IEvidenceCDeclarationAddress } from "./IEvidenceCDeclarationAddress";

/**
 * Captures one supported C declaration before file-local identity
 * reconciliation.
 *
 * `EvidenceCFileScanner` creates this record without retaining a Tree-sitter
 * node. The adapter later groups compatible records by `identity`, expands
 * their public addresses, and uses `site` to retain the physical source
 * location that may host a Doxygen annotation.
 */
export interface IEvidenceCDeclaration {
  /**
   * Stable scanner-local key used by documentation attachments and grouping.
   *
   * Materialization replaces this physical-record key with the group's semantic
   * unit ID.
   */
  id: string;

  /**
   * Source spelling of this declared entity, without its enclosing path.
   *
   * The adapter uses `identity` and `addresses` for the enclosing semantic and
   * public paths.
   */
  name: string;

  /**
   * Graph symbol category published when the declaration becomes a unit.
   *
   * It preserves evidence's language-independent target selection vocabulary.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * C source form that determines conflict and alias reconciliation rules.
   *
   * Only compatible forms may contribute to one materialized declaration
   * family.
   */
  form: EvidenceCDeclarationForm;

  /**
   * Canonical semantic path used to group compatible declarations in one file.
   *
   * It is distinct from alias spellings that may appear in `addresses`.
   */
  identity: string[];

  /**
   * Public spelling candidates, including supported tag and typedef aliases.
   *
   * Materialization publishes only unambiguous candidates under its
   * canonical-prefix rules.
   */
  addresses: IEvidenceCDeclarationAddress[];

  /**
   * Source position and content span preserved for fingerprinting and hosts.
   *
   * Compatible declarations may contribute distinct physical sites to one unit.
   */
  site: IEvidenceUnitSite;

  /**
   * Whether this occurrence supplies a body rather than only a declaration.
   *
   * Repeated bodies in an otherwise incompatible family make the inventory
   * incomplete.
   */
  definition: boolean;

  /**
   * Owning aggregate declaration when this record is a field or enumerator.
   *
   * Omission identifies a declaration that owns a top-level unit.
   */
  ownerDeclarationId?: string;

  /**
   * Struct, union, or enum tag when that namespace names this declaration.
   *
   * The tag can provide a public address separate from the ordinary identifier.
   */
  tagName?: string;
}
