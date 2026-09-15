import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { EvidCppDeclarationForm } from "./EvidCppDeclarationForm";
import type { EvidCppVisibility } from "./EvidCppVisibility";

/**
 * Captures one supported C++ declaration before semantic units are materialized.
 *
 * EvidCppFileScanner records source occurrences in this form; EvidCppAdapterBase groups
 * compatible occurrences by identity, validates their declaration family, and
 * publishes the resulting unit's addresses and sites. The record therefore
 * keeps physical source facts separate from the semantic identity shared by
 * declarations, definitions, and overloads.
 */
export interface IEvidCppDeclaration {
  /** Scanner-local key for attachments and family reconciliation.
   *
   * The adapter replaces this physical-record ID with a semantic unit ID. */
  id: string;

  /** Unqualified source spelling used in diagnostics and the published unit.
   *
   * Enclosing scopes remain in `identity` and `addresses`. */
  name: string;

  /** Evid symbol category assigned after declaration-family materialization.
   *
   * It preserves the graph's language-independent selector vocabulary. */
  symbol: EvidProgrammingSymbol;

  /** C++ declaration form that controls compatibility within one family.
   *
   * Definitions and overloads are reconciled only among compatible forms. */
  form: EvidCppDeclarationForm;

  /** Semantic qualified path used to merge compatible source occurrences.
   *
   * This identity is distinct from every public alias spelling. */
  identity: string[];

  /** Public accessor candidates projected from namespaces and using declarations.
   *
   * Each nested array retains segment boundaries for target resolution. */
  addresses: string[][];

  /** Physical declaration span retained for hosts and content fingerprints.
   *
   * A merged unit may retain several sites from compatible declarations. */
  site: IEvidUnitSite;

  /** Visibility result before public-address publication.
   *
   * Qualified declarations remain distinguishable until their owner is known. */
  visibility: EvidCppVisibility;

  /** Whether this occurrence contributes an implementation body.
   *
   * Multiple bodies for one applicable family make the inventory incomplete. */
  definition: boolean;

  /** Semantic parent path for a member or enumerator.
   *
   * Omission denotes a declaration that owns its own top-level unit. */
  parentIdentity?: string[];
}
