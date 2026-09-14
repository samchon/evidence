import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";

/** One local declaration and the suffix exported through its root binding. */
export interface IEcmaScriptOwnedUnit {
  unit: IEvidenceUnit;
  root: string;
  suffix: string[];
  typeSpace: boolean;
  valueSpace: boolean;
}
