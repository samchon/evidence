import type { IEvidUnit } from "../../structures/IEvidUnit";
import type { IEvidCppAlias } from "./IEvidCppAlias";
import type { IEvidCppFileAnalysis } from "./IEvidCppFileAnalysis";

/**
 * Binds one public C++ alias to the selected semantic unit it uniquely resolves
 * to.
 *
 * `EvidCppAdapter.resolveAliases` creates this intermediate result after
 * declaration families are materialized. The adapter then publishes addresses
 * for `target` and its nested units while retaining `analysis` to report
 * address conflicts against the originating source file.
 */
export interface IEvidCppResolvedAlias {
  /**
   * Public namespace alias or using declaration whose target resolved
   * unambiguously.
   *
   * Its scope and spelling provide the address that the adapter publishes for
   * `target`.
   */
  alias: IEvidCppAlias;

  /**
   * File analysis that supplied `alias`.
   *
   * The adapter uses it as the source-context owner when alias publication
   * detects an address conflict.
   */
  analysis: IEvidCppFileAnalysis;

  /**
   * Selected semantic unit named by `alias`.
   *
   * Resolution emits this result only when the alias has exactly one candidate,
   * allowing the alias address to share the target unit's identity.
   */
  target: IEvidUnit;
}
