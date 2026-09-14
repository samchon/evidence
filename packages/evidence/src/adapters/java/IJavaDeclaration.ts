import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { JavaDeclarationForm } from "./JavaDeclarationForm";

/**
 * Records one Java declaration before its public unit and overload family are materialized.
 *
 * JavaFileScanner creates these physical records, and JavaAdapter reconciles
 * compatible records into the language-independent Evidence inventory.
 */
export interface IJavaDeclaration {
  /**
   * Scanner-local declaration key for Javadoc attachments and reconciliation.
   *
   * It is replaced by a stable semantic unit ID during materialization.
   */
  id: string;

  /**
   * Unqualified source name used for unit display and member addressing.
   *
   * Package and enclosing type segments live in `identity`.
   */
  name: string;

  /**
   * Shared graph selector category for this Java declaration.
   *
   * It keeps Java syntax within the common programming-unit model.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Java declaration form that controls overload and type-family compatibility.
   *
   * Incompatible forms must remain visible as extraction failures.
   */
  form: JavaDeclarationForm;

  /**
   * Canonical package-qualified semantic path for family reconciliation.
   *
   * This identity remains independent of source file public addresses.
   */
  identity: string[];

  /**
   * Public accessor path emitted when the declaration is reachable.
   *
   * Segment boundaries preserve real structural containment.
   */
  address: string[];

  /**
   * Physical declaration site used for hosts and content fingerprints.
   *
   * Compatible records can contribute multiple sites to one unit.
   */
  site: IEvidenceUnitSite;

  /**
   * Whether Java visibility and ancestor context permit publication.
   *
   * The adapter does not expose private declarations merely because they parse.
   */
  public: boolean;

  /**
   * Scanner-local enclosing declaration for a member or nested type.
   *
   * Omission denotes a package-level declaration.
   */
  ownerDeclarationId?: string;
}
