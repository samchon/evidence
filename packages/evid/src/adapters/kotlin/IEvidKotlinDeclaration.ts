import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { IEvidKotlinTypeReference } from "./IEvidKotlinTypeReference";

/**
 * Represents one Kotlin declaration before overload families become inventory
 * units.
 *
 * The scanner keeps source-level visibility, receiver, and alias information
 * here because snapshot-wide resolution can change the semantic owner of an
 * extension.
 */
export interface IEvidKotlinDeclaration {
  /**
   * Identifies this physical extraction record within the source snapshot.
   *
   * Receiver resolution and documentation attachments use this scanner-local
   * value before unit materialization assigns a semantic ID.
   */
  id: string;

  /**
   * Gives the literal Kotlin name decoded from the declaration.
   *
   * The scanner combines it with receiver and lexical paths while preserving
   * its source spelling for diagnostics.
   */
  name: string;

  /**
   * Classifies the declaration in Evid's language-independent selector
   * vocabulary.
   *
   * The adapter retains this category while reconciling package-scoped overload
   * families.
   */
  symbol: EvidProgrammingSymbol;

  /**
   * Lists type-parameter names visible at this declaration's lexical scope.
   *
   * Deferred receiver parsing uses these names to reject type-variable
   * receivers that static nominal lookup cannot resolve.
   */
  typeParameters: string[];

  /**
   * Holds the nominal target when this declaration introduces a type alias.
   *
   * Later receiver resolution expands it only in the source context where its
   * imports and file-private visibility rules are valid.
   */
  aliasTarget?: IEvidKotlinTypeReference;

  /**
   * Retains the declared extension receiver before nominal lookup.
   *
   * Extension members belong to the resolved receiver type rather than to the
   * file that happens to declare the extension.
   */
  receiver?: IEvidKotlinTypeReference;

  /**
   * Lists package and lexical ownership segments for the semantic unit.
   *
   * Receiver resolution may replace the extension's lexical owner with its
   * resolved nominal receiver.
   */
  identity: string[];

  /**
   * Lists public accessor segments as projected from the source file.
   *
   * These remain distinct from `identity` so consumers can cite the public
   * spelling of an extension declaration.
   */
  address: string[];

  /**
   * Retains the physical declaration site and content used by hosts and
   * fingerprints.
   *
   * A reconciled overload family can retain several of these source
   * occurrences.
   */
  site: IEvidUnitSite;

  /**
   * States whether this declaration and each containing owner are public.
   *
   * The adapter retains non-public records for receiver lookup but does not
   * publish their units or addresses.
   */
  public: boolean;

  /**
   * Records Kotlin file-private visibility for nominal lookup.
   *
   * A same-named declaration in another file must not satisfy a receiver or
   * alias reference that can only see this physical source.
   */
  filePrivate: boolean;

  /**
   * Identifies the containing declaration when this record is a member.
   *
   * Omission denotes a package-level declaration; materialization uses this
   * link to propagate ownership and withdrawals.
   */
  ownerDeclarationId?: string;
}
