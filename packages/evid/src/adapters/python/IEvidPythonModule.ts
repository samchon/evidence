import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidPythonAll } from "./IEvidPythonAll";
import type { IEvidPythonBinding } from "./IEvidPythonBinding";
import type { IEvidPythonOwnedUnit } from "./IEvidPythonOwnedUnit";

/**
 * Provides one selected Python module to the bounded export resolver.
 *
 * It combines file-local extraction with a mutable name index, allowing imports
 * and re-exports to resolve without reopening parser sessions or executing code.
 */
export interface IEvidPythonModule {
  /**
   * Source identity and path used to resolve relative module specifiers.
   *
   * The resolver never follows a module that is absent from the selected snapshot.
   */
  source: IEvidSourceFile;

  /**
   * Explicit-export state governing this module's public names.
   *
   * Dynamic `__all__` keeps the enclosing inventory incomplete.
   */
  all: IEvidPythonAll;

  /**
   * Local and imported bindings in their source order.
   *
   * These records encode Python's overwrite behavior for a requested name.
   */
  bindings: IEvidPythonBinding[];

  /**
   * Scanned declaration roots that may be published through a reachable binding.
   *
   * Their semantic identities remain independent of the aliases that expose them.
   */
  units: IEvidPythonOwnedUnit[];

  /**
   * Names currently being resolved through this module.
   *
   * The set detects import cycles before recursive traversal can invent a complete result.
   */
  names: Set<string>;
}
