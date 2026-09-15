import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";

/**
 * A local Evidence unit together with the binding path that owns it.
 *
 * The scanner creates this record before export resolution. The resolver uses
 * the root to match a local binding and the suffix to extend its public address
 * for nested declarations such as class members or namespace contents.
 */
export interface IEvidenceEcmaScriptOwnedUnit {
  /**
   * Semantic declaration extracted into the Evidence inventory.
   *
   * This identity remains one unit even when several public export paths expose
   * it through aliases or re-exports.
   */
  unit: IEvidenceUnit;

  /**
   * Outermost local binding through which this unit is owned.
   *
   * Export resolution compares a resolved local name with this root before
   * publishing the unit and its nested suffix.
   */
  root: string;

  /**
   * Segments below `root` in a public address.
   *
   * A root declaration has no suffix; members and nested namespace declarations
   * append their literal segments after the export name.
   */
  suffix: string[];

  /**
   * Whether this declaration exists in the TypeScript type space.
   *
   * A type-only export may publish this unit, while value-only units remain
   * unavailable through that path.
   */
  typeSpace: boolean;

  /**
   * Whether this declaration exists in the JavaScript value space.
   *
   * Merged declarations can occupy both spaces, and ordinary value exports
   * publish units regardless of this flag's counterpart.
   */
  valueSpace: boolean;
}
