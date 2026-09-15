import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { EvidCSharpAccessibility } from "./EvidCSharpAccessibility";
import type { EvidCSharpDeclarationForm } from "./EvidCSharpDeclarationForm";
import type { IEvidCSharpDeclarationAddress } from "./IEvidCSharpDeclarationAddress";

/**
 * Records one physical C# declaration before adapter-level family
 * reconciliation.
 *
 * `EvidCSharpFileScanner` creates this record with the declaration's
 * syntax-derived identity, addresses, visibility inputs, and documentation
 * site. `EvidCSharpAdapter` groups compatible records into semantic units, so
 * partial declarations and overloads can retain their distinct source
 * attachments while sharing one unit.
 */
export interface IEvidCSharpDeclaration {
  /**
   * Scanner-local key used by documentation attachments and family grouping.
   *
   * The adapter replaces it with one semantic unit ID during materialization.
   */
  id: string;

  /**
   * Unqualified source name displayed for the materialized unit.
   *
   * Containment belongs to `identity` and public path candidates.
   */
  name: string;

  /**
   * Graph selector category assigned to this C# declaration.
   *
   * It keeps language-specific syntax within the shared programming vocabulary.
   */
  symbol: EvidProgrammingSymbol;

  /**
   * Declaration form used to reconcile compatible partials and overloads.
   *
   * Incompatible forms for the same identity remain extraction failures.
   */
  form: EvidCSharpDeclarationForm;

  /**
   * Canonical semantic path independent of aliases and physical source
   * location.
   *
   * The adapter uses it to merge one declaration family.
   */
  identity: string[];

  /**
   * Address candidates carrying canonical and alias-prefix provenance.
   *
   * This structure prevents aliases from obscuring the real public owner.
   */
  addresses: IEvidCSharpDeclarationAddress[];

  /**
   * Source location retained as an eligible documentation host and fingerprint
   * site.
   *
   * Partial declarations can contribute several sites to one unit.
   */
  site: IEvidUnitSite;

  /**
   * Explicit accessibility extracted from C# modifiers.
   *
   * Publication combines it with context-sensitive implicit accessibility.
   */
  accessibility: EvidCSharpAccessibility;

  /**
   * Whether C# supplies public accessibility when no modifier was written.
   *
   * This preserves language defaults without treating every omission as public.
   */
  implicitPublic: boolean;

  /**
   * Whether this declaration participates in C# partial-type materialization.
   *
   * The adapter merges compatible parts while retaining their physical sites.
   */
  partial: boolean;

  /**
   * Whether the member has an explicit interface implementation.
   *
   * Such members do not expose the ordinary public address spelling.
   */
  explicitInterface: boolean;

  /**
   * Enclosing declaration record for a nested member.
   *
   * Omission identifies a namespace-level declaration.
   */
  ownerDeclarationId?: string;
}
