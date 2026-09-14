import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IKotlinTypeReference } from "./IKotlinTypeReference";

/**
 * Represents one Kotlin declaration before overload families become inventory units.
 *
 * The scanner keeps source-level visibility, receiver, and alias information here
 * because snapshot-wide resolution can change the semantic owner of an extension.
 */
export interface IKotlinDeclaration {
  /** Stable identity of this extraction record. */
  id: string;

  /** Literal declared Kotlin name. */
  name: string;

  /** Common programming selector for this declaration. */
  symbol: EvidenceProgrammingSymbol;

  /** Type parameter names visible in this declaration's lexical scope. */
  typeParameters: string[];

  /**
   * Holds the nominal target when this declaration introduces a type alias.
   *
   * Later receiver resolution expands it only in the source context where its
   * imports and file-private visibility rules are valid.
   */
  aliasTarget?: IKotlinTypeReference;

  /**
   * Retains the declared extension receiver before nominal lookup.
   *
   * Extension members belong to the resolved receiver type rather than to the
   * file that happens to declare the extension.
   */
  receiver?: IKotlinTypeReference;

  /** Package and lexical ownership segments of the semantic unit. */
  identity: string[];

  /** File-qualified public accessor segments. */
  address: string[];

  /** Original declaration site and fingerprint content. */
  site: IEvidenceUnitSite;

  /** Whether the declaration and every containing owner are public. */
  public: boolean;

  /**
   * Records Kotlin file-private visibility for nominal lookup.
   *
   * A same-named declaration in another file must not satisfy a receiver or
   * alias reference that can only see this physical source.
   */
  filePrivate: boolean;

  /** Explicit containing declaration, when present. */
  ownerDeclarationId?: string;
}
