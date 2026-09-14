import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IKotlinTypeReference } from "./IKotlinTypeReference";

/** One Kotlin declaration before overload families and public units are materialized. */
export interface IKotlinDeclaration {
  /** Stable identity of this extraction record. */
  id: string;

  /** Literal declared Kotlin name. */
  name: string;

  /** Common programming selector for this declaration. */
  symbol: EvidenceProgrammingSymbol;

  /** Type parameter names visible in this declaration's lexical scope. */
  typeParameters: string[];

  /** Nominal type-alias target, when this declaration is a type alias. */
  aliasTarget?: IKotlinTypeReference;

  /** Declared extension receiver requiring snapshot-wide nominal resolution. */
  receiver?: IKotlinTypeReference;

  /** Package and lexical ownership segments of the semantic unit. */
  identity: string[];

  /** File-qualified public accessor segments. */
  address: string[];

  /** Original declaration site and fingerprint content. */
  site: IEvidenceUnitSite;

  /** Whether the declaration and every containing owner are public. */
  public: boolean;

  /** Whether this type name is confined to its physical source file. */
  filePrivate: boolean;

  /** Explicit containing declaration, when present. */
  ownerDeclarationId?: string;
}
