import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { ICppAlias } from "./ICppAlias";
import type { ICppFileAnalysis } from "./ICppFileAnalysis";

/** Binds one public C++ alias to the selected semantic unit it uniquely resolves to.
 *
 * `CppAdapter.resolveAliases` creates this intermediate result after declaration families are materialized. The adapter then publishes addresses for `target` and its nested units while retaining `analysis` to report address conflicts against the originating source file.
 */
export interface ICppResolvedAlias {
  /** Public namespace alias or using declaration whose target resolved unambiguously.
   *
   * Its scope and spelling provide the address that the adapter publishes for `target`.
   */
  alias: ICppAlias;

  /** File analysis that supplied `alias`.
   *
   * The adapter uses it as the source-context owner when alias publication detects an address conflict.
   */
  analysis: ICppFileAnalysis;

  /** Selected semantic unit named by `alias`.
   *
   * Resolution emits this result only when the alias has exactly one candidate, allowing the alias address to share the target unit's identity.
   */
  target: IEvidenceUnit;
}
