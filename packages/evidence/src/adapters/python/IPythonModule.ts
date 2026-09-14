import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPythonAll } from "./IPythonAll";
import type { IPythonBinding } from "./IPythonBinding";
import type { IPythonOwnedUnit } from "./IPythonOwnedUnit";

/**
 * Provides one selected Python module to the bounded export resolver.
 *
 * It combines file-local extraction with a mutable name index, allowing imports
 * and re-exports to resolve without reopening parser sessions or executing code.
 */
export interface IPythonModule {
  /**
   * Source identity and path used to resolve relative module specifiers.
   *
   * The resolver never follows a module that is absent from the selected snapshot.
   */
  source: IEvidenceSourceFile;

  /**
   * Explicit-export state governing this module's public names.
   *
   * Dynamic `__all__` keeps the enclosing inventory incomplete.
   */
  all: IPythonAll;

  /**
   * Local and imported bindings in their source order.
   *
   * These records encode Python's overwrite behavior for a requested name.
   */
  bindings: IPythonBinding[];

  /**
   * Scanned declaration roots that may be published through a reachable binding.
   *
   * Their semantic identities remain independent of the aliases that expose them.
   */
  units: IPythonOwnedUnit[];

  /**
   * Names currently being resolved through this module.
   *
   * The set detects import cycles before recursive traversal can invent a complete result.
   */
  names: Set<string>;
}
