import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { EvidObjcDeclarationForm } from "./EvidObjcDeclarationForm";

/**
 * Represents one Objective-C declaration before interface and implementation
 * reconciliation.
 *
 * The adapter keeps declarations from headers, implementations, categories, and
 * extensions distinct until it can establish the one public semantic identity.
 */
export interface IEvidObjcDeclaration {
  /**
   * Physical declaration identity within the snapshot.
   *
   * Reconciliation uses this value to retain each contributing source site.
   */
  id: string;

  /**
   * Exact declaration name, including selector punctuation.
   *
   * Selector colons and method prefixes remain literal identity spelling.
   */
  name: string;

  /**
   * Public programming selector.
   *
   * Population selection uses this category independently of source form.
   */
  symbol: EvidProgrammingSymbol;

  /**
   * Source form governing exposure and merging.
   *
   * Interfaces, implementations, and extensions follow distinct publication
   * rules.
   */
  form: EvidObjcDeclarationForm;

  /**
   * Segmented identity in the configured declared-source boundary.
   *
   * This semantic path remains independent of public accessor spelling.
   */
  identity: string[];

  /**
   * Segmented file-qualified public accessor.
   *
   * Published addresses combine these literal segments with each selected file.
   */
  address: string[];

  /**
   * Original source declaration and fingerprint content ranges.
   *
   * Merged units preserve every site that contributes semantic content.
   */
  site: IEvidUnitSite;

  /**
   * Whether this declaration participates in the public inventory after
   * reconciliation.
   *
   * Private records can still become merge sites for a separately public
   * identity.
   */
  public: boolean;

  /**
   * Permits an implementation or extension site to join a public identity.
   *
   * The flag never makes a private declaration public by itself; it authorizes
   * reconciliation with the separately extracted interface declaration.
   */
  merge: boolean;

  /**
   * Marks a body or nominal implementation site that must be unique.
   *
   * Multiple declarations can describe a selector, but conflicting definitions
   * leave the analysis incomplete rather than choosing an arbitrary site.
   */
  definition: boolean;

  /**
   * Physical owner declaration, reconciled to a semantic parent later.
   *
   * Omission denotes a root declaration in the selected source.
   */
  ownerDeclarationId?: string;
}
