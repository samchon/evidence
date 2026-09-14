import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { ICppAlias } from "./ICppAlias";
import type { ICppFileAnalysis } from "./ICppFileAnalysis";

/** A public C++ alias paired with its unique selected target unit. */
export interface ICppResolvedAlias {
  alias: ICppAlias;
  analysis: ICppFileAnalysis;
  target: IEvidenceUnit;
}
