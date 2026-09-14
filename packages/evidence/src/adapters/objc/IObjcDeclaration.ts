import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { ObjcDeclarationForm } from "./ObjcDeclarationForm";

/** One Objective-C declaration before public interface and implementation reconciliation. */
export interface IObjcDeclaration {
  /** Physical declaration identity within the snapshot. */
  id: string;

  /** Exact declaration name, including selector punctuation. */
  name: string;

  /** Public programming selector. */
  symbol: EvidenceProgrammingSymbol;

  /** Source form governing exposure and merging. */
  form: ObjcDeclarationForm;

  /** Segmented identity in the configured declared-source boundary. */
  identity: string[];

  /** Segmented file-qualified public accessor. */
  address: string[];

  /** Original source declaration and fingerprint content ranges. */
  site: IEvidenceUnitSite;

  /** Whether this declaration participates in the public inventory after reconciliation. */
  public: boolean;

  /** Allows implementation or extension sites to join an independently public identity. */
  merge: boolean;

  /** Whether this site defines a body or nominal implementation that must be unique. */
  definition: boolean;

  /** Physical owner declaration, reconciled to a semantic parent later. */
  ownerDeclarationId?: string;
}
